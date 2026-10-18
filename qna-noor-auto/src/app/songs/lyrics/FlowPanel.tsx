"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import {
  bestGridForTaps,
  fitCheck,
  quantizeTaps,
  splitSyllables,
  suggestPatterns,
  type FlowGrid,
  type FlowSyllable,
  type LineFlow,
} from "@/lib/flow";
import { parseLyrics, type LyricsMeta } from "@/lib/lyrics";
import { ensureRunning, unlockMediaRoute } from "../audioUnlock";
import { applyFlowToLines, saveLineFlow } from "./actions";

type ScheduledEvent = { beat: number; kind: "beat" | "hit"; slot?: number };
type PlaybackStatus = "idle" | "count-in" | "guide" | "tap-count-in" | "tapping";
type Playback = {
  mode: "guide" | "tap";
  playingId: string;
  lineStart: number;
  lineDuration: number;
  beatDuration: number;
  events: ScheduledEvent[];
  eventIndex: number;
  loopIndex: number;
  loop: boolean;
};
type TapResult = { raw: number[]; bars: 1 | 2; grid: FlowGrid };

function outputDelay(context: AudioContext) {
  const latencyContext = context as AudioContext & { outputLatency?: number };
  return Math.max(
    0,
    Math.min(0.5, latencyContext.outputLatency ?? context.baseLatency ?? 0),
  );
}

function scheduleTone(context: AudioContext, time: number, frequency: number, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.035);
}

function flowEvents(flow: LineFlow, includeHits: boolean): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  for (let beat = 0; beat < flow.bars * 4; beat += 1) {
    events.push({ beat, kind: "beat" });
  }
  if (includeHits) {
    for (const slot of flow.hits) {
      events.push({ beat: (slot * 4) / flow.grid, kind: "hit", slot });
    }
  }
  return events.sort(
    (a, b) =>
      a.beat - b.beat ||
      (a.kind === b.kind ? 0 : a.kind === "beat" ? -1 : 1),
  );
}

function GridView({
  flow,
  syllables,
  currentHit,
  compact = false,
}: {
  flow: LineFlow;
  syllables: FlowSyllable[];
  currentHit: number | null;
  compact?: boolean;
}) {
  return (
    <div className="w-full max-w-full overflow-x-auto pb-1">
      <div className="flex w-max gap-1">
        {Array.from({ length: flow.grid * flow.bars }, (_, slot) => {
          const hitIndex = flow.hits.indexOf(slot);
          const isBeat = slot % (flow.grid / 4) === 0;
          const active = currentHit === slot;
          return (
            <div
              key={slot}
              aria-label={hitIndex >= 0 ? `Slot ${slot + 1}: ${syllables[hitIndex]?.text ?? "empty hit"}` : `Slot ${slot + 1}`}
              className={`flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border ${
                compact ? "h-8 w-5" : "h-12 w-9"
              } ${
                active
                  ? "border-[var(--vx-accent-600)] bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                  : hitIndex >= 0
                    ? "border-[var(--vx-accent-300)] bg-[var(--vx-accent-100)] text-[var(--vx-accent-700)]"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400"
              }`}
            >
              <span className={`leading-none ${compact ? "text-[7px]" : "text-[8px]"}`}>
                {isBeat ? ((Math.floor(slot / (flow.grid / 4)) % 4) + 1) : ""}
              </span>
              {!compact && hitIndex >= 0 && (
                <span className="max-w-full truncate px-0.5 text-[9px] font-semibold leading-tight">
                  {syllables[hitIndex]?.text ?? ""}
                </span>
              )}
              {compact && hitIndex >= 0 && <span className="text-[9px] leading-none">●</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function gridName(grid: FlowGrid) {
  return grid === 8 ? "8ths" : grid === 12 ? "Triplets" : "16ths";
}

function fitLabel(verdict: ReturnType<typeof fitCheck>["verdict"]) {
  if (verdict === "8ths") return "8ths";
  if (verdict === "triplets") return "Triplets";
  if (verdict === "16ths") return "16ths";
  if (verdict === "too-many") return "Too long";
  return "Roomy";
}

export function FlowPanel({
  songId,
  bpm,
  lyrics,
  meta,
}: {
  songId: string;
  bpm: number;
  lyrics: string;
  meta: LyricsMeta;
}) {
  const router = useRouter();
  const songBpm = bpm ?? 90;
  const [bpmInput, setBpmInput] = useState(String(songBpm));
  const [currentBpm, setCurrentBpm] = useState(songBpm);
  const [localMeta, setLocalMeta] = useState(meta);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [barOverrides, setBarOverrides] = useState<Record<string, 1 | 2>>({});
  const [loop, setLoop] = useState(true);
  const [pending, setPending] = useState<"save" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [playbackRecord, setPlaybackRecord] = useState<{
    lineText: string | null;
    status: PlaybackStatus;
  }>({ lineText: null, status: "idle" });
  const [currentHitRecord, setCurrentHitRecord] = useState<{
    lineKey: number | null;
    lineText: string | null;
    playingId: string | null;
    slot: number | null;
  }>({ lineKey: null, lineText: null, playingId: null, slot: null });
  const [tapCount, setTapCount] = useState(0);
  const [tapResultRecord, setTapResultRecord] = useState<{
    lineText: string;
    result: TapResult;
  } | null>(null);
  const [reuseState, setReuseState] = useState<{
    key: string;
    choices: Record<string, boolean>;
  }>({ key: "", choices: {} });
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const playbackRef = useRef<Playback | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const tapLineStartRef = useRef(0);
  const tapBeatDurationRef = useRef(0);
  const tapBarsRef = useRef<1 | 2>(1);
  const currentHitRef = useRef<{ playingId: string; slot: number } | null>(null);

  const lyricItems = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const lines = useMemo(
    () => lyricItems.flatMap((item, key) =>
      item.kind === "line"
        ? [{ key, text: item.text, syllables: splitSyllables(item.text) }]
        : [],
    ),
    [lyricItems],
  );
  const selectedLine = lines.find((line) => line.key === selectedKey) ?? lines[0] ?? null;
  const currentHitFor = (playingId: string) =>
    currentHitRecord.lineKey === selectedLine?.key &&
    currentHitRecord.lineText === selectedLine?.text &&
    currentHitRecord.playingId === playingId
      ? currentHitRecord.slot
      : null;
  const setCurrentHit = useCallback((playingId: string | null, slot: number | null) => {
    setCurrentHitRecord({
      lineKey: selectedLine?.key ?? null,
      lineText: selectedLine?.text ?? null,
      playingId,
      slot,
    });
  }, [selectedLine?.key, selectedLine?.text]);
  const playbackState =
    playbackRecord.lineText === (selectedLine?.text ?? null) ? playbackRecord.status : "idle";
  const setPlaybackState = useCallback((status: PlaybackStatus) => {
    setPlaybackRecord({ lineText: selectedLine?.text ?? null, status });
  }, [selectedLine?.text]);
  const selectedFlow = selectedLine ? localMeta.lines[selectedLine.text]?.flow ?? null : null;
  const bars = selectedLine
    ? barOverrides[selectedLine.text] ?? selectedFlow?.bars ?? 1
    : 1;
  const patterns = useMemo(
    () => selectedLine ? suggestPatterns(selectedLine.syllables, bars) : [],
    [selectedLine, bars],
  );
  const otherLines = useMemo(() => {
    const seen = new Set<string>();
    return lines.filter((line) => {
      if (line.text === selectedLine?.text || seen.has(line.text)) return false;
      seen.add(line.text);
      return true;
    });
  }, [lines, selectedLine?.text]);
  const reuseKey = JSON.stringify([
    selectedLine?.text,
    selectedFlow?.grid,
    selectedFlow?.bars,
    selectedFlow?.hits.length,
    otherLines.map((line) => [line.text, line.syllables.length]),
  ]);
  const reuseDefaults = Object.fromEntries(
    otherLines
      .filter((line) => line.syllables.length === (selectedFlow?.hits.length ?? -1))
      .map((line) => [line.text, true]),
  );
  const reuseSelection =
    reuseState.key === reuseKey ? reuseState.choices : reuseDefaults;
  const tapResult =
    tapResultRecord?.lineText === selectedLine?.text ? tapResultRecord.result : null;
  const tapFlow = useMemo<LineFlow | null>(() => {
    if (!tapResult) return null;
    return {
      grid: tapResult.grid,
      bars: tapResult.bars,
      hits: quantizeTaps(tapResult.raw, tapResult.grid, tapResult.bars),
      source: "tap",
      label: "Tapped",
    };
  }, [tapResult]);

  const later = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timer);
      callback();
    }, Math.max(0, delay));
    timeoutIdsRef.current.push(timer);
    return timer;
  }, []);

  const stopPlayback = useCallback(() => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    for (const timer of timeoutIdsRef.current) window.clearTimeout(timer);
    timeoutIdsRef.current = [];
    playbackRef.current = null;
    tapTimesRef.current = [];
    currentHitRef.current = null;
    setCurrentHit(null, null);
    setPlaybackState("idle");
  }, [setCurrentHit, setPlaybackState]);

  const scheduleEvents = useCallback(() => {
    const context = audioContextRef.current;
    const playback = playbackRef.current;
    if (!context || !playback) return;
    const now = context.currentTime;
    const horizon = now + 0.1;
    while (playbackRef.current === playback) {
      if (playback.eventIndex >= playback.events.length) {
        if (playback.mode === "guide" && playback.loop) {
          playback.loopIndex += 1;
          playback.eventIndex = 0;
        } else {
          break;
        }
      }
      const event = playback.events[playback.eventIndex];
      if (!event) break;
      const time =
        playback.lineStart +
        playback.loopIndex * playback.lineDuration +
        event.beat * playback.beatDuration;
      if (time >= horizon) break;
      playback.eventIndex += 1;
      if (time < now - 0.01) continue;
      if (event.kind === "hit") {
        scheduleTone(context, time, 1500, 0.11);
        const slot = event.slot!;
        const playingId = playback.playingId;
        later(() => {
          currentHitRef.current = { playingId, slot };
          setCurrentHit(playingId, slot);
          later(() => {
            if (
              currentHitRef.current?.playingId === playingId &&
              currentHitRef.current.slot === slot
            ) {
              currentHitRef.current = null;
              setCurrentHit(playingId, null);
            }
          }, 90);
        }, (time + outputDelay(context) - context.currentTime) * 1000);
      } else {
        scheduleTone(context, time, 850, 0.1);
      }
    }
    const lineEnd =
      playback.lineStart + (playback.loopIndex + 1) * playback.lineDuration;
    if (now >= lineEnd && !playback.loop) {
      if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
      playbackRef.current = null;
      if (playback.mode === "guide") setPlaybackState("idle");
    }
  }, [later, setCurrentHit, setPlaybackState]);

  const startGuide = useCallback(async (flow: LineFlow, playingId: string) => {
    unlockMediaRoute();
    stopPlayback();
    setError("");
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await ensureRunning(context);
      const beatDuration = 60 / currentBpm;
      const countInStart = context.currentTime + 0.05;
      for (let beat = 0; beat < 4; beat += 1) {
        scheduleTone(context, countInStart + beat * beatDuration, beat === 0 ? 1200 : 900, 0.14);
      }
      const lineStart = countInStart + 4 * beatDuration;
      const playback: Playback = {
        mode: "guide",
        playingId,
        lineStart,
        lineDuration: flow.bars * 4 * beatDuration,
        beatDuration,
        events: flowEvents(flow, true),
        eventIndex: 0,
        loopIndex: 0,
        loop,
      };
      playbackRef.current = playback;
      setPlaybackState("count-in");
      later(() => setPlaybackState("guide"), (lineStart + outputDelay(context) - context.currentTime) * 1000);
      schedulerRef.current = window.setInterval(scheduleEvents, 25);
      scheduleEvents();
    } catch {
      setPlaybackState("idle");
      setError("Audio playback unavailable.");
    }
  }, [currentBpm, loop, later, scheduleEvents, setPlaybackState, stopPlayback]);

  const finishTapCapture = useCallback(() => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    playbackRef.current = null;
    const raw = [...tapTimesRef.current];
    const capturedBars = tapBarsRef.current;
    const grid = bestGridForTaps(raw, capturedBars);
    const lineText = selectedLine?.text;
    if (lineText) setTapResultRecord({ lineText, result: { raw, bars: capturedBars, grid } });
    setPlaybackState("idle");
    currentHitRef.current = null;
    setCurrentHit(null, null);
  }, [selectedLine?.text, setCurrentHit, setPlaybackState]);

  const startTapCapture = useCallback(async () => {
    unlockMediaRoute();
    stopPlayback();
    setError("");
    setTapResultRecord(null);
    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      await ensureRunning(context);
      const beatDuration = 60 / currentBpm;
      const countInStart = context.currentTime + 0.05;
      for (let beat = 0; beat < 4; beat += 1) {
        scheduleTone(context, countInStart + beat * beatDuration, beat === 0 ? 1200 : 900, 0.14);
      }
      const lineStart = countInStart + 4 * beatDuration;
      const duration = bars * 4 * beatDuration;
      tapTimesRef.current = [];
      setTapCount(0);
      tapLineStartRef.current = lineStart;
      tapBeatDurationRef.current = beatDuration;
      tapBarsRef.current = bars;
      const beatFlow: LineFlow = { grid: 8, bars, hits: [], source: "tap" };
      playbackRef.current = {
        mode: "tap",
        playingId: "tap",
        lineStart,
        lineDuration: duration,
        beatDuration,
        events: flowEvents(beatFlow, false),
        eventIndex: 0,
        loopIndex: 0,
        loop: false,
      };
      setPlaybackState("tap-count-in");
      later(() => setPlaybackState("tapping"), (lineStart + outputDelay(context) - context.currentTime) * 1000);
      later(finishTapCapture, (lineStart + duration + outputDelay(context) - context.currentTime) * 1000);
      schedulerRef.current = window.setInterval(scheduleEvents, 25);
      scheduleEvents();
    } catch {
      setPlaybackState("idle");
      setError("Audio playback unavailable.");
    }
  }, [bars, currentBpm, finishTapCapture, later, scheduleEvents, setPlaybackState, stopPlayback]);

  useEffect(() => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    for (const timer of timeoutIdsRef.current) window.clearTimeout(timer);
    timeoutIdsRef.current = [];
    playbackRef.current = null;
    tapTimesRef.current = [];
    currentHitRef.current = null;
  }, [selectedLine?.text]);

  useEffect(() => () => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    for (const timer of timeoutIdsRef.current) window.clearTimeout(timer);
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  function setLocalFlow(lineText: string, flow: LineFlow | null) {
    setLocalMeta((current) => {
      const lines = { ...current.lines };
      const entry = { ...(lines[lineText] ?? {}) };
      if (flow) entry.flow = flow;
      else delete entry.flow;
      if (Object.keys(entry).length) lines[lineText] = entry;
      else delete lines[lineText];
      return { ...current, lines };
    });
  }

  async function saveFlow(lineText: string, flow: LineFlow | null) {
    const previous = localMeta;
    setError("");
    setLocalFlow(lineText, flow);
    setPending("save");
    try {
      await saveLineFlow(songId, lineText, flow);
      router.refresh();
    } catch (caught) {
      setLocalMeta(previous);
      setError(caught instanceof Error ? caught.message : "Unable to save flow.");
    } finally {
      setPending(null);
    }
  }

  async function applyFlowToSelectedLines() {
    if (!selectedFlow) return;
    const selectedTexts = otherLines
      .filter((line) => reuseSelection[line.text])
      .map((line) => line.text);
    if (!selectedTexts.length) return;
    const previous = localMeta;
    setError("");
    setLocalMeta((current) => {
      const lines = { ...current.lines };
      for (const text of selectedTexts) {
        lines[text] = { ...(lines[text] ?? {}), flow: selectedFlow };
      }
      return { ...current, lines };
    });
    setPending("apply");
    try {
      await applyFlowToLines(songId, selectedFlow, selectedTexts);
      router.refresh();
    } catch (caught) {
      setLocalMeta(previous);
      setError(caught instanceof Error ? caught.message : "Unable to apply flow.");
    } finally {
      setPending(null);
    }
  }

  function recordTap() {
    const context = audioContextRef.current;
    if (!context || playbackState !== "tapping") return;
    const heardTime = context.currentTime - outputDelay(context);
    const beat = (heardTime - tapLineStartRef.current) / tapBeatDurationRef.current;
    if (beat >= 0 && beat <= tapBarsRef.current * 4) {
      tapTimesRef.current.push(beat);
      setTapCount((current) => current + 1);
    }
  }

  const selectedFit = selectedLine
    ? fitCheck(selectedLine.syllables.length, bars)
    : null;
  const isPlaying = playbackState === "count-in" || playbackState === "guide";
  const isTapping = playbackState === "tap-count-in" || playbackState === "tapping";
  const bpmUnchanged = Number(bpmInput) === songBpm;

  return (
    <section className="mt-3 min-w-0 max-w-full space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5" aria-label="Lyric flow">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Find your flow</h3>
          <p className="mt-1 text-xs text-zinc-500">Fit the words to the tempo, then try a rhythm.</p>
        </div>
        <label className="flex items-end gap-2 text-xs text-zinc-500">
          <span>
            <span className="mb-1 block font-medium">BPM</span>
            <Input
              type="number"
              min={40}
              max={220}
              inputMode="numeric"
              value={bpmInput}
              onChange={(event) => setBpmInput(event.target.value)}
              onBlur={() => {
                const value = Number(bpmInput);
                const next = Number.isFinite(value)
                  ? Math.max(40, Math.min(220, Math.round(value)))
                  : songBpm;
                setCurrentBpm(next);
                setBpmInput(String(next));
              }}
              aria-label="Flow BPM"
              className="w-24 tabular-nums"
            />
          </span>
          {bpmUnchanged && <span className="pb-2">Uses the song’s BPM</span>}
        </label>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fit check</h4>
        {lines.length ? (
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-2">
            {lyricItems.map((item, index) => {
              if (item.kind === "section") {
                return (
                  <p key={`section-${index}`} className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {item.label}
                  </p>
                );
              }
              if (item.kind !== "line") return null;
              const line = lines.find((candidate) => candidate.key === index);
              if (!line) return null;
              const lineFlow = localMeta.lines[line.text]?.flow;
              const lineBars = barOverrides[line.text] ?? lineFlow?.bars ?? 1;
              const fit = fitCheck(line.syllables.length, lineBars);
              const active = line.key === selectedLine?.key;
              return (
                <button
                  key={`line-${index}`}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    if (line.key !== selectedKey) {
                      stopPlayback();
                      setTapResultRecord(null);
                      setSelectedKey(line.key);
                    }
                  }}
                  aria-pressed={active}
                  className={`w-full min-w-0 max-w-full rounded-lg border p-2.5 text-left transition ${
                    active
                      ? "border-[var(--vx-accent-500)] bg-[var(--vx-accent-50)]"
                      : "border-transparent bg-zinc-50 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 break-words text-sm font-medium text-zinc-800">{line.text}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{line.syllables.length} syl</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                        fit.verdict === "too-many"
                          ? "bg-red-100 text-red-700"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {fitLabel(fit.verdict)}
                    </span>
                  </div>
                  {lineFlow && (
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {gridName(lineFlow.grid)} · {lineFlow.bars} bar{lineFlow.bars === 1 ? "" : "s"}
                      </span>
                      <div className="min-w-0 max-w-full flex-1">
                        <GridView flow={lineFlow} syllables={line.syllables} currentHit={null} compact />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">Add a lyric line to start shaping its flow.</p>
        )}
      </div>

      {selectedLine && selectedFit && (
        <div className="space-y-3 border-t border-zinc-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-zinc-900">Selected line</h4>
            <div className="flex rounded-lg border border-zinc-300 p-0.5" aria-label="Flow bars">
              {([1, 2] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={bars === count}
                  disabled={pending !== null || isPlaying || isTapping}
                  onClick={() => {
                    if (selectedLine) {
                      setBarOverrides((current) => ({ ...current, [selectedLine.text]: count }));
                    }
                  }}
                  className={`min-h-9 rounded-md px-3 text-xs font-medium ${
                    bars === count ? "bg-zinc-200 text-zinc-900" : "text-zinc-600"
                  }`}
                >
                  {count} bar{count === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Syllables">
            {selectedLine.syllables.map((syllable, index) => (
              <span
                key={`${syllable.word}-${index}`}
                className={`rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 ${
                  syllable.stressed ? "font-bold text-zinc-900" : ""
                }`}
              >
                {syllable.text}
              </span>
            ))}
          </div>
          <p className={`text-xs ${selectedFit.verdict === "too-many" ? "text-red-600" : "text-zinc-600"}`}>
            {selectedFit.message}
          </p>

          {patterns.length ? (
            <div className="space-y-2">
              {patterns.map(({ id, label, flow }) => (
                <div key={id} className="min-w-0 max-w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">{label}</p>
                      <p className="text-[10px] text-zinc-500">{gridName(flow.grid)} · {flow.bars} bar{flow.bars === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-10"
                        disabled={pending !== null || isTapping}
                        onClick={() => void startGuide(flow, id)}
                      >
                        ▶ Try
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-10"
                        disabled={pending !== null || isTapping}
                        onClick={() => void saveFlow(selectedLine.text, flow)}
                      >
                        Use this
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 min-w-0 max-w-full">
                    <GridView flow={flow} syllables={selectedLine.syllables} currentHit={currentHitFor(id)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700">
              {bars === 1
                ? "Too many syllables for 1 bar — try 2 bars or split the line."
                : "Too many syllables for 2 bars — split the line."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-10"
              disabled={pending !== null || isPlaying || isTapping}
              onClick={() => void startTapCapture()}
            >
              Tap your flow
            </Button>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={loop}
                onChange={(event) => setLoop(event.target.checked)}
                disabled={isPlaying || isTapping}
                className="h-4 w-4 accent-[var(--vx-accent-600)]"
              />
              Loop
            </label>
            {(isPlaying || isTapping) && (
              <Button type="button" size="sm" variant="danger" className="min-h-10" onClick={stopPlayback}>
                Stop
              </Button>
            )}
          </div>
          {playbackState === "count-in" && <p className="text-xs text-zinc-500">Count-in…</p>}
          {playbackState === "tap-count-in" && <p className="text-xs text-zinc-500">Count-in, then tap each syllable.</p>}
          {playbackState === "tapping" && (
            <div className="space-y-2">
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  recordTap();
                }}
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    recordTap();
                  }
                }}
                className="min-h-36 w-full touch-manipulation rounded-2xl border-2 border-[var(--vx-accent-500)] bg-[var(--vx-accent-50)] px-5 py-8 text-center text-lg font-semibold text-zinc-900 active:scale-[0.99]"
                aria-label="Tap each syllable"
              >
                Tap each syllable
                <span className="mt-1 block text-xs font-normal text-zinc-600">
                  {tapCount} taps · Space also works
                </span>
              </button>
              <p className="text-[11px] text-zinc-500">Say the line while the beat clicks continue.</p>
            </div>
          )}

          {tapResult && tapFlow && !isTapping && (
            <div className="min-w-0 max-w-full space-y-3 rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h5 className="text-sm font-semibold text-zinc-900">Your tapped flow</h5>
                  <p className="text-[11px] text-zinc-500">{tapFlow.hits.length} hits · {gridName(tapFlow.grid)}</p>
                </div>
                <div className="flex gap-1" aria-label="Tap grid">
                  {([8, 12, 16] as const).map((grid) => (
                    <Button
                      key={grid}
                      type="button"
                      size="sm"
                      variant={tapResult.grid === grid ? "secondary" : "ghost"}
                      className="min-h-10"
                      disabled={pending !== null}
                      onClick={() =>
                        setTapResultRecord((current) =>
                          current
                            ? { ...current, result: { ...current.result, grid } }
                            : current,
                        )
                      }
                    >
                      {gridName(grid)}
                    </Button>
                  ))}
                </div>
              </div>
              <GridView flow={tapFlow} syllables={selectedLine.syllables} currentHit={currentHitFor("tap")} />
              {selectedLine.syllables.length > tapFlow.hits.length && (
                <p className="text-xs text-zinc-600">
                  +{selectedLine.syllables.length - tapFlow.hits.length} not tapped
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-10"
                  disabled={pending !== null}
                  onClick={() => void startGuide(tapFlow, "tap")}
                >
                  ▶ Try
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-10"
                  disabled={pending !== null}
                  onClick={() => void saveFlow(selectedLine.text, tapFlow)}
                >
                  Save to line
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  disabled={pending !== null || isPlaying}
                  onClick={() => void startTapCapture()}
                >
                  Redo
                </Button>
              </div>
            </div>
          )}

          {selectedFlow && (
            <div className="min-w-0 max-w-full space-y-3 rounded-lg border border-[var(--vx-accent-300)] bg-[var(--vx-accent-50)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h5 className="text-sm font-semibold text-zinc-900">Saved flow</h5>
                  <p className="text-xs text-zinc-600">{gridName(selectedFlow.grid)} · {selectedFlow.bars} bar{selectedFlow.bars === 1 ? "" : "s"}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-10"
                    disabled={pending !== null || isTapping}
                    onClick={() => void startGuide(selectedFlow, "saved")}
                  >
                    ▶ Try
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="min-h-10"
                    disabled={pending !== null}
                    onClick={() => void saveFlow(selectedLine.text, null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <GridView flow={selectedFlow} syllables={selectedLine.syllables} currentHit={currentHitFor("saved")} />
              {otherLines.length > 0 && (
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium text-zinc-800">
                    Use on other lines…
                  </summary>
                  <div className="space-y-1">
                    {otherLines.map((line) => {
                      const needs = Math.max(0, line.syllables.length - selectedFlow.hits.length);
                      return (
                        <label key={line.text} className="flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-md bg-white px-2 py-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            checked={Boolean(reuseSelection[line.text])}
                            disabled={needs > 0 || pending !== null}
                            onChange={(event) =>
                              setReuseState({
                                key: reuseKey,
                                choices: { ...reuseSelection, [line.text]: event.target.checked },
                              })
                            }
                            className="h-4 w-4 accent-[var(--vx-accent-600)]"
                          />
                          <span className="min-w-0 flex-1 break-words">{line.text}</span>
                          <span className="shrink-0 text-[10px] text-zinc-500">
                            {needs > 0 ? `needs ${needs} hits` : `${line.syllables.length} syl`}
                          </span>
                        </label>
                      );
                    })}
                    <Button
                      type="button"
                      size="sm"
                      className="mt-2 min-h-10"
                      disabled={
                        pending !== null ||
                        !otherLines.some((line) => reuseSelection[line.text] && line.syllables.length <= selectedFlow.hits.length)
                      }
                      onClick={() => void applyFlowToSelectedLines()}
                    >
                      {pending === "apply" ? "Applying…" : "Apply to selected lines"}
                    </Button>
                  </div>
                </details>
              )}
            </div>
          )}
          <p className="text-[11px] text-zinc-500">
            Change a line&apos;s words and you&apos;ll need to redo its flow.
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {pending && <p className="text-xs text-zinc-500">{pending === "apply" ? "Applying…" : "Saving…"}</p>}
    </section>
  );
}
