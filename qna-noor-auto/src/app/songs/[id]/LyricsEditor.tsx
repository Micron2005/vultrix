"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Select, Textarea } from "@/components/ui";
import {
  LYRIC_SECTIONS,
  parseLyrics,
  type LyricsMeta,
} from "@/lib/lyrics";
import { saveLyrics } from "../actions";

const BAR_OPTIONS = [1, 2, 4, 8] as const;

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LyricsEditor({
  songId,
  initialLyrics,
  initialMeta,
  bpm,
}: {
  songId: string;
  initialLyrics: string;
  initialMeta: LyricsMeta;
  bpm: number | null;
}) {
  const [lyrics, setLyrics] = useState(initialLyrics);
  const [meta, setMeta] = useState<LyricsMeta>(initialMeta);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const initializedRef = useRef(false);

  const parsed = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const lineStats = useMemo(() => {
    let lines = 0;
    let syllables = 0;
    let bars = 0;
    for (const item of parsed) {
      if (item.kind !== "line") continue;
      lines += 1;
      syllables += item.syllables;
      bars += meta.lines[item.text]?.bars ?? 2;
    }
    return { lines, syllables, bars };
  }, [meta.lines, parsed]);
  const duration =
    bpm && lineStats.bars
      ? formatDuration(Math.round((lineStats.bars * 4 * 60) / bpm))
      : null;

  const sectionStats = useMemo(() => {
    const stats = new Map<string, { lines: number; syllables: number; bars: number }>();
    let current = "Lyrics";
    for (const item of parsed) {
      if (item.kind === "section") {
        current = item.label;
        if (!stats.has(current)) stats.set(current, { lines: 0, syllables: 0, bars: 0 });
      } else if (item.kind === "line") {
        const value = stats.get(current) ?? { lines: 0, syllables: 0, bars: 0 };
        value.lines += 1;
        value.syllables += item.syllables;
        value.bars += meta.lines[item.text]?.bars ?? 2;
        stats.set(current, value);
      }
    }
    return stats;
  }, [meta.lines, parsed]);

  async function persist() {
    setSaving(true);
    try {
      await saveLyrics(songId, { lyrics, lyricsMeta: meta });
      setSaved(true);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 240)}px`;
  }, [lyrics]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    const timeout = window.setTimeout(() => {
      void persist();
    }, 1500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyrics, meta]);

  function insertSection(label: string) {
    if (!label) return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? lyrics.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = start > 0 && lyrics[start - 1] !== "\n" ? "\n" : "";
    const inserted = `${prefix}[${label}]\n`;
    const next = `${lyrics.slice(0, start)}${inserted}${lyrics.slice(end)}`;
    setLyrics(next);
    setSaved(false);
    setSection("");
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const cursor = start + inserted.length;
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function updateLineMeta(key: string, patch: { bars?: 1 | 2 | 4 | 8; note?: string }) {
    setMeta((current) => ({
      v: 1,
      lines: {
        ...current.lines,
        [key]: { ...current.lines[key], ...patch },
      },
    }));
    setSaved(false);
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Lyrics</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {lineStats.lines} lines · {lineStats.syllables} syllables
            {duration ? ` · Estimated length ${duration}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {saving ? "Saving…" : saved ? "Saved" : "Unsaved changes"}
          </span>
          <Button type="button" size="sm" onClick={() => void persist()} disabled={saving}>
            Save
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select
          value={section}
          onChange={(event) => insertSection(event.target.value)}
          aria-label="Insert lyric section"
          className="w-44"
        >
          <option value="">Insert section…</option>
          {LYRIC_SECTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <span className="text-xs text-zinc-500">Click a syllable count to set bars and phrasing.</span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex min-h-60 overflow-hidden rounded-lg border border-zinc-300 bg-white">
            <pre
              ref={gutterRef}
              aria-label="Syllable counts"
              className="w-12 shrink-0 overflow-hidden border-r border-zinc-200 bg-zinc-50 px-2 py-3 text-right font-mono text-[11px] leading-6 text-zinc-400"
            >
              {parsed.map((item, index) => (
                <span key={`${index}-${item.kind}`} className="block h-6">
                  {item.kind === "line" ? (
                    <button
                      type="button"
                      className={`w-full rounded text-right hover:text-[var(--vx-accent-700)] ${
                        selectedLine === item.text ? "font-semibold text-[var(--vx-accent-700)]" : ""
                      }`}
                      onClick={() => setSelectedLine(item.text)}
                      aria-label={`Set lyric line options for ${item.text}`}
                    >
                      {item.syllables}
                    </button>
                  ) : null}
                </span>
              ))}
            </pre>
            <Textarea
              ref={textareaRef}
              value={lyrics}
              onChange={(event) => {
                setLyrics(event.target.value.slice(0, 20_000));
                setSaved(false);
              }}
              onScroll={(event) => {
                if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
              spellCheck
              aria-label="Lyrics editor"
              className="min-h-60 flex-1 resize-none overflow-hidden rounded-none border-0 bg-transparent px-3 py-3 font-mono text-sm leading-6 shadow-none focus:ring-0"
              placeholder={"[Verse 1]\nWrite your first line here…"}
            />
          </div>
          {selectedLine && (
            <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="max-w-[32rem] truncate text-xs font-medium text-zinc-700">{selectedLine}</p>
                <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setSelectedLine(null)}>
                  Close
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">Bars</span>
                <div className="flex rounded-md bg-zinc-100 p-0.5">
                  {BAR_OPTIONS.map((bars) => (
                    <button
                      key={bars}
                      type="button"
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        (meta.lines[selectedLine]?.bars ?? 2) === bars
                          ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] shadow-sm"
                          : "text-zinc-600"
                      }`}
                      onClick={() => updateLineMeta(selectedLine, { bars })}
                    >
                      {bars}
                    </button>
                  ))}
                </div>
              </div>
              <input
                value={meta.lines[selectedLine]?.note ?? ""}
                onChange={(event) => updateLineMeta(selectedLine, { note: event.target.value.slice(0, 300) })}
                placeholder="Phrasing note (pronunciation, beat placement…)"
                className="mt-3 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-[var(--vx-accent-600)]"
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview</h3>
          <div className="mt-4 space-y-4">
            {parsed.every((item) => item.kind === "blank") ? (
              <p className="text-sm text-zinc-500">Write lyrics to preview them here.</p>
            ) : (
              parsed.map((item, index) => {
                if (item.kind === "blank") return <div key={index} className="h-2" />;
                if (item.kind === "section") {
                  const stats = sectionStats.get(item.label);
                  return (
                    <div key={index}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vx-accent-700)]">{item.label}</p>
                      {stats && <p className="mt-1 text-[11px] text-zinc-400">{item.label} · {stats.lines} lines · {stats.syllables} syl · {stats.bars} bars</p>}
                    </div>
                  );
                }
                return (
                  <div key={`${index}-${item.text}`} className="border-b border-zinc-100 pb-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{item.text}</p>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">{item.syllables}</span>
                    </div>
                    {meta.lines[item.text]?.note && <p className="mt-1 text-xs italic text-zinc-500">{meta.lines[item.text].note}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Need to revise the words?{" "}
        <Link href={`/songs/${songId}`} className="font-medium text-[var(--vx-accent-700)] underline">
          Keep editing the song
        </Link>
      </p>
    </section>
  );
}
