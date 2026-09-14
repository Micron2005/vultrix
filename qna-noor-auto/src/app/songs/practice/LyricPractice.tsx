"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Select } from "@/components/ui";
import { parseLyrics, parseLyricsMeta } from "@/lib/lyrics";

type PracticeSong = {
  id: string;
  title: string;
  bpm: number | null;
  lyrics: string | null;
  lyricsMeta: string | null;
};

const FONT_STORAGE_KEY = "vx_lyric_practice_v1";

export function LyricPractice({
  songs,
  selectedSong,
  bpm,
  beatsPerBar,
  metronomeRunning,
  currentBeat,
  onSongChange,
}: {
  songs: PracticeSong[];
  selectedSong: PracticeSong | null;
  bpm: number;
  beatsPerBar: number;
  metronomeRunning: boolean;
  currentBeat: number;
  onSongChange: (id: string) => void;
}) {
  const [fontScale, setFontScale] = useState(1);
  const [currentLine, setCurrentLine] = useState(0);
  const [barCounter, setBarCounter] = useState(0);
  const [loopLine, setLoopLine] = useState(false);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const fontLoadedRef = useRef(false);

  const parsed = useMemo(
    () => parseLyrics(selectedSong?.lyrics ?? ""),
    [selectedSong?.lyrics],
  );
  const meta = useMemo(
    () => parseLyricsMeta(selectedSong?.lyricsMeta ?? null),
    [selectedSong?.lyricsMeta],
  );
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

  const barsFor = useCallback((index: number) => {
    const text = contentLines[index]?.item.text;
    return text ? meta.lines[text]?.bars ?? 2 : 2;
  }, [contentLines, meta.lines]);

  const lineForBar = useCallback((counter: number) => {
    if (loopLine) return currentLine;
    const contentBar = Math.max(0, counter - 1);
    let offset = 0;
    for (let index = 0; index < contentLines.length; index += 1) {
      offset += barsFor(index);
      if (contentBar < offset) return index;
    }
    return Math.max(0, contentLines.length - 1);
  }, [barsFor, contentLines.length, currentLine, loopLine]);

  function barAtLine(index: number) {
    return 1 + contentLines
      .slice(0, index)
      .reduce((sum, _line, lineIndex) => sum + barsFor(lineIndex), 0);
  }

  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(FONT_STORAGE_KEY));
      if (stored >= 0.8 && stored <= 1.4) {
        window.setTimeout(() => setFontScale(stored), 0);
      }
    } catch {
      // Ignore malformed local preferences.
    }
    fontLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!fontLoadedRef.current) return;
    localStorage.setItem(FONT_STORAGE_KEY, String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    if (metronomeRunning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBarCounter(0);
      setCurrentLine(0);
    }
  }, [metronomeRunning, selectedSong?.id]);

  useEffect(() => {
    if (!metronomeRunning || currentBeat !== 0 || contentLines.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBarCounter((counter) => counter + 1);
  }, [contentLines.length, currentBeat, metronomeRunning]);

  useEffect(() => {
    if (!metronomeRunning || contentLines.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentLine(lineForBar(barCounter));
  }, [barCounter, contentLines.length, lineForBar, metronomeRunning]);

  useEffect(() => {
    lineRefs.current[currentLine]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentLine]);

  function chooseLine(index: number) {
    if (metronomeRunning) return;
    setCurrentLine(index);
    setBarCounter(barAtLine(index));
  }

  function moveLine(offset: number) {
    const next = Math.min(
      contentLines.length - 1,
      Math.max(0, currentLine + offset),
    );
    setCurrentLine(next);
    setBarCounter(barAtLine(next));
  }

  if (!selectedSong || !selectedSong.lyrics?.trim()) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Follow along</h2>
        <p className="mt-2 text-sm text-zinc-500">Write lyrics on the song page</p>
        {selectedSong && (
          <Link href={`/songs/${selectedSong.id}`} className="mt-4 inline-flex">
            <Button type="button" size="sm">Write lyrics on the song page</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Follow along</h2>
          <p className="mt-1 text-xs text-zinc-500">Practice at {bpm} BPM · {beatsPerBar}/4</p>
        </div>
        <Select
          value={selectedSong.id}
          onChange={(event) => onSongChange(event.target.value)}
          aria-label="Practice song"
          className="min-w-44"
        >
          {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
        </Select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-zinc-100 py-3">
        <Button type="button" size="sm" variant="secondary" onClick={() => { setCurrentLine(0); setBarCounter(0); }}>
          Start from top
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => moveLine(-1)} aria-label="Previous lyric line">◀</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => moveLine(1)} aria-label="Next lyric line">▶</Button>
        <Button type="button" size="sm" variant={loopLine ? "primary" : "ghost"} onClick={() => setLoopLine((value) => !value)}>
          Loop line
        </Button>
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontScale((value) => Math.max(0.8, value - 0.1))}>A−</Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontScale((value) => Math.min(1.4, value + 0.1))}>A+</Button>
        </span>
        <Link href={`/songs/${selectedSong.id}`} className="text-xs font-medium text-[var(--vx-accent-700)] underline">Edit lyrics</Link>
      </div>
      <div className="mt-4 max-h-[36rem] overflow-y-auto pr-2">
        <div className="space-y-5">
          {parsed.map((item, sourceIndex) => {
            if (item.kind === "blank") return <div key={sourceIndex} className="h-2" />;
            if (item.kind === "section") {
              return <p key={sourceIndex} className="pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vx-accent-700)]">{item.label}</p>;
            }
            const lineIndex = contentLines.findIndex((entry) => entry.sourceIndex === sourceIndex);
            const bars = barsFor(lineIndex);
            const dots = bars * beatsPerBar;
            const active = lineIndex === currentLine;
            const activeDot = active && metronomeRunning && currentBeat >= 0
              ? ((Math.max(0, barCounter - 2) % bars) * beatsPerBar) + currentBeat
              : -1;
            return (
              <div
                key={`${sourceIndex}-${item.text}`}
                ref={(node) => { lineRefs.current[lineIndex] = node; }}
                className={`rounded-lg px-3 py-2 transition-colors ${active ? "bg-[var(--vx-accent-50)]" : ""}`}
                onClick={() => chooseLine(lineIndex)}
              >
                <p className={`whitespace-pre-wrap font-semibold leading-snug ${active ? "text-[var(--vx-accent-700)]" : "text-zinc-900"}`} style={{ fontSize: `${1.5 * fontScale}rem` }}>
                  {item.text}
                </p>
                {meta.lines[item.text]?.note && <p className="mt-1 text-sm italic text-zinc-500">{meta.lines[item.text].note}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1" aria-label={`${bars} bars`}>
                    {Array.from({ length: dots }, (_, dot) => (
                      <span
                        key={dot}
                        className={`h-2.5 w-2.5 rounded-full ${dot % beatsPerBar === 0 ? "h-3.5 w-3.5" : ""} ${activeDot === dot ? "bg-[var(--vx-accent-600)]" : "bg-zinc-200"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {item.syllables} syl · {bars} bars · ~{(item.syllables / (bars * beatsPerBar)).toFixed(1)} syl/beat
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
