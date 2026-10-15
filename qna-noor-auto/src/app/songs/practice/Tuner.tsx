"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { detectPitch, nearestGuitarString, noteFromFrequency } from "@/lib/pitch";
import { ensureRunning, unlockMediaRoute } from "../audioUnlock";

const A4_STORAGE_KEY = "vx_tuner_a4_v1";

type Reading = {
  hz: number;
  noteName: string;
  octave: number;
  cents: number;
  stringName: string;
  stringCents: number;
};

export function Tuner() {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"voice" | "guitar">("voice");
  const [a4, setA4] = useState(440);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const readingsRef = useRef<number[]>([]);
  const lastGoodAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const a4Ref = useRef(440);
  const preferencesLoadedRef = useRef(false);

  useEffect(() => {
    let saved: number | null = null;
    try {
      const stored = Number(localStorage.getItem(A4_STORAGE_KEY));
      if (stored >= 430 && stored <= 450) saved = stored;
    } catch {}
    const timer = window.setTimeout(() => {
      if (saved !== null) setA4(saved);
      a4Ref.current = saved ?? 440;
      preferencesLoadedRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    a4Ref.current = a4;
    if (!preferencesLoadedRef.current) return;
    try {
      localStorage.setItem(A4_STORAGE_KEY, String(a4));
    } catch {}
  }, [a4]);

  function stopTuner(updateState = true) {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    readingsRef.current = [];
    lastGoodAtRef.current = 0;
    if (updateState) {
      setRunning(false);
      setReading(null);
    }
  }

  useEffect(() => () => stopTuner(false), []);

  async function startTuner() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is not available in this browser.");
      }
      unlockMediaRoute();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      await ensureRunning(context);
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      analyserRef.current = analyser;
      const samples = new Float32Array(analyser.fftSize);
      lastFrameAtRef.current = 0;
      setReading(null);
      setRunning(true);

      const readFrame = (now: number) => {
        if (now - lastFrameAtRef.current >= 50) {
          lastFrameAtRef.current = now;
          analyser.getFloatTimeDomainData(samples);
          const pitch = detectPitch(samples, context.sampleRate);
          if (pitch) {
            const recent = [...readingsRef.current, pitch.hz].slice(-5);
            readingsRef.current = recent;
            const medianHz = [...recent].sort((left, right) => left - right)[
              Math.floor(recent.length / 2)
            ];
            const note = noteFromFrequency(medianHz, a4Ref.current);
            const string = nearestGuitarString(medianHz, a4Ref.current);
            lastGoodAtRef.current = now;
            setReading({
              hz: medianHz,
              noteName: note.name,
              octave: note.octave,
              cents: note.cents,
              stringName: string.name,
              stringCents: string.cents,
            });
          } else if (lastGoodAtRef.current && now - lastGoodAtRef.current > 1000) {
            readingsRef.current = [];
            setReading(null);
          }
        }
        frameRef.current = requestAnimationFrame(readFrame);
      };
      frameRef.current = requestAnimationFrame(readFrame);
    } catch {
      stopTuner(false);
      setRunning(false);
      setReading(null);
      setError("Allow microphone access to use the tuner.");
    }
  }

  const cents = reading
    ? mode === "guitar"
      ? reading.stringCents
      : reading.cents
    : null;
  const needlePosition = cents === null ? 50 : Math.max(0, Math.min(100, cents + 50));
  const inTune = cents !== null && Math.abs(cents) <= 5;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Tuner</h2>
          <p className="mt-1 text-xs text-zinc-500">Tune by voice or guitar string.</p>
        </div>
        <div className="flex rounded-md border border-zinc-300 p-0.5">
          {(["voice", "guitar"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`min-h-10 rounded px-3 text-xs font-medium capitalize ${
                mode === value
                  ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Button type="button" onClick={running ? () => stopTuner() : () => void startTuner()}>
          {running ? "Stop" : "Start"}
        </Button>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>A4</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Lower A4 reference"
            disabled={a4 <= 430}
            onClick={() => setA4((value) => Math.max(430, value - 1))}
          >
            −
          </Button>
          <span className="min-w-10 text-center tabular-nums">{a4} Hz</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Raise A4 reference"
            disabled={a4 >= 450}
            onClick={() => setA4((value) => Math.min(450, value + 1))}
          >
            +
          </Button>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center">
        <p className="text-5xl font-semibold leading-none tabular-nums text-zinc-900">
          {reading
            ? mode === "guitar"
              ? reading.stringName
              : `${reading.noteName}${reading.octave}`
            : "—"}
        </p>
        <p className="mt-2 text-sm tabular-nums text-zinc-600">
          {reading ? `${reading.hz.toFixed(1)} Hz` : "Listening for a note"}
        </p>
        <div
          className="relative mt-5 h-3 rounded-full bg-zinc-200"
          role="img"
          aria-label={cents === null ? "No pitch detected" : `${cents} cents`}
        >
          <span className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-zinc-500" />
          {cents !== null && (
            <span
              className={`absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full ${
                inTune ? "bg-emerald-500" : "bg-[var(--vx-accent-600)]"
              }`}
              style={{ left: `${needlePosition}%` }}
            />
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
          <span>−50</span>
          <span>{cents === null ? "—" : `${cents > 0 ? "+" : ""}${cents} cents`}</span>
          <span>+50</span>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-zinc-600">{error}</p>}
    </Card>
  );
}
