"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { ensureRunning, unlockMediaRoute } from "../audioUnlock";
import { scheduleMetronomeClick } from "../practice/metronomeClick";

const FONT_KEY = "vx.rehearsal.font";
const COUNT_IN_KEY = "vx.rehearsal.countin";

type RehearsalModeProps = {
  sections: Array<{ name: string; index: number }>;
  lyrics: string | null;
  songId: string | null;
  bpm: number;
  beatsPerBar: number;
  playing: boolean;
  activeSectionIndex: number;
  onStart: (sectionIndex: number) => Promise<void>;
  onQueueSection: (sectionIndex: number) => void;
  onStop: () => void;
  onClose: () => void;
};

type LyricBlock = {
  label: string | null;
  lines: string[];
  key: string;
};

function parseBlocks(lyrics: string | null): LyricBlock[] {
  if (!lyrics?.trim()) return [];
  return lyrics
    .split(/\r?\n\s*\r?\n/)
    .map((rawBlock, index) => {
      const lines = rawBlock.trim().split(/\r?\n/);
      const match = lines[0]?.match(/^\[([^\]]+)\]$/);
      return {
        label: match ? match[1].trim() : null,
        lines: match ? lines.slice(1) : lines,
        key: `${index}-${rawBlock}`,
      };
    })
    .filter((block) => block.lines.some((line) => line.trim()) || block.label);
}

export function RehearsalMode({
  sections,
  lyrics,
  songId,
  bpm,
  beatsPerBar,
  playing,
  activeSectionIndex,
  onStart,
  onQueueSection,
  onStop,
  onClose,
}: RehearsalModeProps) {
  const [fontScale, setFontScale] = useState(1);
  const [countInEnabled, setCountInEnabled] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [queuedSection, setQueuedSection] = useState<number | null>(null);
  const fontLoadedRef = useRef(false);
  const countInLoadedRef = useRef(false);
  const countInTokenRef = useRef(0);
  const countInTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blocks = useMemo(() => parseBlocks(lyrics), [lyrics]);
  const activeSection = sections.find((section) => section.index === activeSectionIndex);
  const currentSectionIndex = activeSection?.index ?? sections[0]?.index ?? -1;
  const pendingSection = queuedSection !== activeSectionIndex ? queuedSection : null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    fontLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(FONT_KEY));
        if (stored >= 0.8 && stored <= 1.4) setFontScale(stored);
      } catch {
        setFontScale(1);
      } finally {
        fontLoadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fontLoadedRef.current) return;
    localStorage.setItem(FONT_KEY, String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    countInLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        setCountInEnabled(localStorage.getItem(COUNT_IN_KEY) !== "false");
      } catch {
        setCountInEnabled(true);
      } finally {
        countInLoadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!countInLoadedRef.current) return;
    localStorage.setItem(COUNT_IN_KEY, String(countInEnabled));
  }, [countInEnabled]);

  useEffect(() => {
    if (!activeSection) return;
    const block = blocks.find(
      (item) => item.label?.toLowerCase() === activeSection.name.toLowerCase(),
    );
    if (block) {
      blockRefs.current[block.key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSection, blocks]);

  function cancelCountIn() {
    countInTokenRef.current += 1;
    if (countInTimerRef.current !== null) {
      window.clearTimeout(countInTimerRef.current);
      countInTimerRef.current = null;
    }
    setCountdown(null);
  }

  function waitForBeat(ms: number, token: number) {
    return new Promise<boolean>((resolve) => {
      countInTimerRef.current = window.setTimeout(() => {
        countInTimerRef.current = null;
        resolve(countInTokenRef.current === token);
      }, ms);
    });
  }

  async function start() {
    cancelCountIn();
    const token = countInTokenRef.current;
    if (playing) onStop();
    if (countInEnabled) {
      unlockMediaRoute();
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await ensureRunning(context);
      const intervalMs = (60_000 / Math.max(40, bpm));
      for (let beat = 0; beat < beatsPerBar; beat += 1) {
        if (countInTokenRef.current !== token) return;
        setCountdown(beatsPerBar - beat);
        scheduleMetronomeClick(
          context,
          context.currentTime + 0.02,
          beat === 0,
          beat === 0 ? 0.2 : 0.15,
        );
        if (!(await waitForBeat(intervalMs, token))) return;
      }
      setCountdown(null);
    }
    if (countInTokenRef.current === token && currentSectionIndex >= 0) {
      await onStart(currentSectionIndex);
    }
  }

  function stop() {
    cancelCountIn();
    onStop();
  }

  function close() {
    cancelCountIn();
    onStop();
    onClose();
  }

  function queueSection(sectionIndex: number) {
    setQueuedSection(sectionIndex);
    onQueueSection(sectionIndex);
  }

  function moveSection(direction: -1 | 1) {
    if (!sections.length) return;
    const currentPosition = Math.max(
      0,
      sections.findIndex((section) => section.index === currentSectionIndex),
    );
    const nextPosition = (currentPosition + direction + sections.length) % sections.length;
    queueSection(sections[nextPosition].index);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const isFormControl = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLButtonElement;
      if (isFormControl && event.key !== "Escape") return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.code === "Space") {
        event.preventDefault();
        if (countdown !== null) stop();
        else if (playing) stop();
        else void start();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSection(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSection(-1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => () => {
    cancelCountIn();
    audioContextRef.current?.close();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Rehearsal</p>
          <h2 className="truncate text-2xl font-semibold">{activeSection?.name ?? sections[0]?.name ?? "Song"}</h2>
          {pendingSection !== null && (
            <p className="text-xs text-violet-300">
              Next: {sections.find((section) => section.index === pendingSection)?.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => moveSection(-1)}>Prev</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => moveSection(1)}>Next section</Button>
          <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-xl text-white/70 hover:bg-white/10" aria-label="Close rehearsal">×</button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-10">
        {blocks.length ? (
          <div className="mx-auto max-w-4xl space-y-10">
            {blocks.map((block) => (
              <div
                key={block.key}
                ref={(element) => { blockRefs.current[block.key] = element; }}
              >
                {block.label && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">{block.label}</p>}
                {block.lines.map((line, index) => (
                  <p key={`${block.key}-${index}`} className="whitespace-pre-wrap text-2xl font-semibold leading-snug text-white md:text-4xl">
                    <span style={{ fontSize: `${fontScale}em` }}>{line}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto max-w-xl py-16 text-center">
            <p className="text-lg text-white/70">No lyrics linked — add them in Lyrics</p>
            <Link href={songId ? `/songs/lyrics?song=${songId}` : "/songs/lyrics"} className="mt-3 inline-block text-sm text-violet-300 underline">
              Open Lyrics
            </Link>
          </div>
        )}
      </main>

      <footer className="border-t border-white/10 bg-zinc-950/95 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="secondary" onClick={() => setFontScale((value) => Math.max(0.8, value - 0.1))}>A−</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setFontScale((value) => Math.min(1.4, value + 0.1))}>A+</Button>
            <label className="ml-2 flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={countInEnabled}
                onChange={(event) => setCountInEnabled(event.target.checked)}
              />
              1 bar
            </label>
          </div>
          <div className="relative">
            {countdown !== null && <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 text-6xl font-bold tabular-nums text-violet-300">{countdown}</div>}
            <Button type="button" className="min-h-14 min-w-44 text-lg" onClick={playing || countdown !== null ? stop : () => void start()}>
              {playing || countdown !== null ? "■ Stop" : "▶ Start"}
            </Button>
          </div>
          <p className="text-xs text-white/50">{Math.round(bpm)} BPM · {beatsPerBar}/4</p>
        </div>
      </footer>
    </div>
  );
}
