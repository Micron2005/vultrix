"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BeatEngine, type BeatDocument, type BeatPlaybackMode } from "./engine";
import {
  TRACK_KIND_COLORS,
  sectionSequence,
  stepsFor,
} from "./kits";

type BeatPlayerProps = {
  beat: BeatDocument;
};

function downloadWav(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.trim() || "beat"}.wav`;
  link.click();
  URL.revokeObjectURL(url);
}

export function BeatPlayer({ beat }: BeatPlayerProps) {
  const [engine] = useState(() => new BeatEngine());
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<BeatPlaybackMode>(
    beat.data.sections.length ? "song" : "pattern",
  );
  const [selectedPatternId, setSelectedPatternId] = useState(
    beat.data.patterns[0]?.id ?? "",
  );
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(-1);
  const [activeStep, setActiveStep] = useState(-1);
  const modeRef = useRef(mode);
  const selectedPatternRef = useRef(selectedPatternId);
  const sequence = useMemo(() => sectionSequence(beat.data), [beat.data]);
  const selectedPattern =
    beat.data.patterns.find((pattern) => pattern.id === selectedPatternId) ??
    beat.data.patterns[0];

  useEffect(() => {
    modeRef.current = mode;
    selectedPatternRef.current = selectedPatternId;
  }, [mode, selectedPatternId]);

  useEffect(() => () => engine.stop(), [engine]);

  async function togglePlayback() {
    if (playing) {
      engine.stop();
      setPlaying(false);
      setActiveStep(-1);
      setActiveSequenceIndex(-1);
      return;
    }
    await engine.play(
      () => beat,
      () => ({
        mode: modeRef.current,
        patternId: selectedPatternRef.current,
      }),
      (sequenceIndex, step) => {
        setActiveStep(step);
        if (modeRef.current !== "song" || !sequence.length) {
          setActiveSequenceIndex(-1);
          return;
        }
        const index = sequenceIndex % sequence.length;
        setActiveSequenceIndex(index);
        const item = sequence[index];
        if (item && item.pattern.id !== selectedPatternRef.current) {
          setSelectedPatternId(item.pattern.id);
        }
      },
      setLoading,
    );
    setPlaying(true);
  }

  async function downloadWavFile() {
    const blob = await engine.renderWav(
      beat,
      mode === "pattern" ? selectedPatternId : undefined,
    );
    downloadWav(blob, beat.title);
  }

  const patternSteps = selectedPattern ? stepsFor(selectedPattern) : 0;
  const activeSectionIndex =
    activeSequenceIndex >= 0
      ? sequence[activeSequenceIndex]?.sectionIndex
      : undefined;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => void togglePlayback()}
        disabled={loading}
        className="h-12 w-full rounded-lg bg-[var(--vx-accent-600)] px-4 text-sm font-semibold text-[var(--vx-accent-fg)] shadow-sm hover:bg-[var(--vx-accent-700)]"
      >
        {loading ? "Loading…" : playing ? "Stop" : "Play"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
          {(["pattern", "song"] as const).map((item) => {
            const disabled = item === "song" && !beat.data.sections.length;
            return (
              <button
                key={item}
                type="button"
                disabled={disabled}
                title={disabled ? "No arrangement" : undefined}
                onClick={() => setMode(item)}
                className={`min-h-9 px-3 text-xs font-medium ${
                  mode === item
                    ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                    : "text-zinc-300 hover:bg-zinc-800"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {item === "pattern" ? "Loop" : "Song"}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void downloadWavFile()}
          className="min-h-9 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
        >
          Download WAV
        </button>
      </div>

      {beat.data.sections.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Arrangement
          </p>
          <div className="flex flex-wrap gap-2">
            {beat.data.sections.map((section, index) => (
              <div
                key={section.id}
                className={`rounded-md border px-3 py-2 text-xs ${
                  activeSectionIndex === index
                    ? "border-[var(--vx-accent-500)] bg-[var(--vx-accent-600)]/20 text-white"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300"
                }`}
              >
                {section.name} ×{section.repeats}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {beat.data.patterns.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => setSelectedPatternId(pattern.id)}
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                selectedPattern?.id === pattern.id
                  ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {pattern.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Position
        </p>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(patternSteps, 1)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: patternSteps }, (_, step) => (
            <div
              key={step}
              className={`h-2 rounded-sm ${
                activeStep === step
                  ? "bg-[var(--vx-accent-500)]"
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tracks
        </p>
        <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/60">
          {beat.data.tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${TRACK_KIND_COLORS[track.kind]}`}
                aria-hidden="true"
              />
              <span className="truncate text-zinc-200">{track.name}</span>
            </div>
          ))}
        </div>
      </div>

      {playing && (
        <p className="text-xs text-zinc-500">
          No sound? Turn up the volume and flip the ringer switch off silent.
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Instrument sounds: FluidR3 GM soundfont by Frank Wen (
        <a
          href="https://creativecommons.org/licenses/by/3.0/us/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-zinc-300"
        >
          CC BY 3.0
        </a>
        )
      </p>
    </div>
  );
}
