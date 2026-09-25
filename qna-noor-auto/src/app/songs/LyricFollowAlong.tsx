"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { parseLyrics, parseLyricsMeta } from "@/lib/lyrics";

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
  const [fontScale, setFontScale] = useState(1);
  const [currentLine, setCurrentLine] = useState(0);
  const fontLoadedRef = useRef(false);
  const parsed = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const meta = useMemo(() => parseLyricsMeta(lyricsMeta), [lyricsMeta]);
  const contentLines = useMemo(
    () =>
      parsed
        .map((item, sourceIndex) => ({ item, sourceIndex }))
        .filter(
          (entry): entry is {
            item: Extract<(typeof parsed)[number], { kind: "line" }>;
            sourceIndex: number;
          } => entry.item.kind === "line",
        ),
    [parsed],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(storageKey));
        if (stored >= 0.8 && stored <= 1.4) setFontScale(stored);
      } catch {
        setFontScale(1);
      }
      fontLoadedRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (fontLoadedRef.current) localStorage.setItem(storageKey, String(fontScale));
  }, [fontScale, storageKey]);

  function moveLine(offset: number) {
    setCurrentLine((line) =>
      Math.min(Math.max(contentLines.length - 1, 0), Math.max(0, line + offset)),
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-zinc-100 py-3">
        <Button type="button" size="sm" variant="secondary" onClick={() => setCurrentLine(0)}>
          Start from top
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => moveLine(-1)} aria-label="Previous lyric line">
          ◀
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => moveLine(1)} aria-label="Next lyric line">
          ▶
        </Button>
        <span className="ml-auto flex items-center gap-1">
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
            const lineIndex = contentLines.findIndex((entry) => entry.sourceIndex === sourceIndex);
            const active = lineIndex === currentLine;
            return (
              <button
                key={`${sourceIndex}-${item.text}`}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${active ? "bg-[var(--vx-accent-50)]" : ""}`}
                onClick={() => setCurrentLine(lineIndex)}
              >
                <span className={`block whitespace-pre-wrap font-semibold leading-snug ${active ? "text-[var(--vx-accent-700)]" : "text-zinc-900"}`} style={{ fontSize: `${1.5 * fontScale}rem` }}>
                  {item.text}
                </span>
                {meta.lines[item.text]?.note && (
                  <span className="mt-1 block text-sm italic text-zinc-500">{meta.lines[item.text].note}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
