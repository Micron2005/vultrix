"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { parseLyrics } from "@/lib/lyrics";

export function LyricFollowAlong({
  songId,
  lyrics,
  lyricsMeta,
  maxHeightClass = "max-h-[36rem]",
  storageKey = "vx_lyric_sheet_v1",
}: {
  songId: string;
  lyrics: string;
  lyricsMeta: string | null;
  maxHeightClass?: string;
  storageKey?: string;
}) {
  void lyricsMeta;
  const [fontScale, setFontScale] = useState(1);
  const fontLoadedRef = useRef(false);
  const parsed = parseLyrics(lyrics);

  useEffect(() => {
    fontLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(storageKey));
        if (stored >= 0.8 && stored <= 1.4) setFontScale(stored);
      } catch {
        setFontScale(1);
      } finally {
        fontLoadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!fontLoadedRef.current) return;
    localStorage.setItem(storageKey, String(fontScale));
  }, [fontScale, storageKey]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-zinc-100 py-3">
        <span className="flex items-center gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontScale((value) => Math.max(0.8, value - 0.1))}>A−</Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontScale((value) => Math.min(1.4, value + 0.1))}>A+</Button>
        </span>
        <Link href={`/songs/lyrics?song=${songId}`} className="text-xs font-medium text-[var(--vx-accent-700)] underline">
          Edit in Lyrics
        </Link>
      </div>
      <div className={`mt-4 ${maxHeightClass} overflow-y-auto pr-2`}>
        <div className="space-y-5">
          {parsed.map((item, sourceIndex) => {
            if (item.kind === "blank") return <div key={sourceIndex} className="h-2" />;
            if (item.kind === "section") {
              return (
                <p key={sourceIndex} className="pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vx-accent-700)]">
                  {item.label}
                </p>
              );
            }
            return (
              <p
                key={`${sourceIndex}-${item.text}`}
                className="whitespace-pre-wrap px-3 py-2 font-semibold leading-snug text-zinc-900"
                style={{ fontSize: `${1.5 * fontScale}rem` }}
              >
                {item.text}
              </p>
            );
          })}
        </div>
      </div>
    </>
  );
}
