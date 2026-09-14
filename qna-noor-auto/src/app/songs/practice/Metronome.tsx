"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { logPractice } from "./actions";

type SongOption = {
  id: string;
  title: string;
};

const STORAGE_KEY = "vx_metronome_v1";

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function Metronome({ songs }: { songs: SongOption[] }) {
  const [bpm, setBpm] = useState(100);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [volume, setVolume] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [timerStatus, setTimerStatus] = useState<"idle" | "running" | "paused">("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [error, setError] = useState("");
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerBar);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const preferencesLoadedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  const tapTimesRef = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
    beatsRef.current = beatsPerBar;
    volumeRef.current = volume;
    mutedRef.current = muted;
    if (preferencesLoadedRef.current) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ bpm, beats: beatsPerBar }),
      );
    }
  }, [bpm, beatsPerBar, volume, muted]);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        bpm?: number;
        beats?: number;
      };
      preferencesLoadedRef.current = true;
      timer = window.setTimeout(() => {
        if (saved.bpm && saved.bpm >= 40 && saved.bpm <= 240) setBpm(saved.bpm);
        if (saved.beats && [2, 3, 4, 6].includes(saved.beats)) {
          setBeatsPerBar(saved.beats);
        }
      }, 0);
    } catch {
      // Ignore malformed local preferences.
      preferencesLoadedRef.current = true;
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (timerStatus !== "running") return;
    const interval = setInterval(() => setElapsedSec((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [timerStatus]);

  useEffect(() => {
    return () => {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  function updateBpm(next: number) {
    setBpm(Math.min(240, Math.max(40, next)));
  }

  function startTimerIfIdle() {
    if (timerStatus === "idle") setTimerStatus("running");
  }

  function scheduleClick(beat: number, time: number) {
    const context = audioContextRef.current;
    if (!context) return;
    window.setTimeout(
      () => setCurrentBeat(beat),
      Math.max(0, (time - context.currentTime) * 1000),
    );
    if (mutedRef.current) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = beat === 0 ? 1000 : 800;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volumeRef.current * 0.15),
      time + 0.005,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.035);
  }

  function schedule() {
    const context = audioContextRef.current;
    if (!context) return;
    while (nextNoteTimeRef.current < context.currentTime + 0.1) {
      const beat = beatRef.current;
      scheduleClick(beat, nextNoteTimeRef.current);
      nextNoteTimeRef.current += 60 / bpmRef.current;
      beatRef.current = (beat + 1) % beatsRef.current;
    }
  }

  async function startMetronome() {
    setError("");
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    await context.resume();
    nextNoteTimeRef.current = context.currentTime + 0.05;
    beatRef.current = 0;
    schedule();
    schedulerRef.current = setInterval(schedule, 25);
    setMetronomeRunning(true);
    startTimerIfIdle();
  }

  function stopMetronome() {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    setMetronomeRunning(false);
    setCurrentBeat(-1);
    if (timerStatus === "running") setTimerStatus("paused");
    setShowFinish(true);
  }

  function finishSession() {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    setMetronomeRunning(false);
    setCurrentBeat(-1);
    if (timerStatus === "running") setTimerStatus("paused");
    setShowFinish(true);
  }

  function resetTimer() {
    setTimerStatus("idle");
    setElapsedSec(0);
    setShowFinish(false);
    setError("");
  }

  function tapTempo() {
    const now = Date.now();
    const taps = [...tapTimesRef.current, now].slice(-4);
    tapTimesRef.current = taps;
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((tap, index) => tap - taps[index]);
      updateBpm(Math.round(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length)));
    }
  }

  async function saveSession(formData: FormData) {
    setError("");
    try {
      await logPractice(formData);
      resetTimer();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save practice.");
    }
  }

  return (
    <Card className="p-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Metronome</h2>
              <p className="mt-1 text-xs text-zinc-500">Find your pocket, then log the work.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <Input
                type="number"
                min={40}
                max={240}
                value={bpm}
                onChange={(event) => updateBpm(Number(event.target.value))}
                aria-label="BPM number"
                className="w-24 text-3xl font-semibold tabular-nums"
              />
              BPM
            </label>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => updateBpm(bpm - 5)}>−5</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => updateBpm(bpm - 1)}>−1</Button>
            <Input type="range" min={40} max={240} value={bpm} onChange={(event) => updateBpm(Number(event.target.value))} aria-label="BPM" className="min-w-0 flex-1" />
            <Button type="button" size="sm" variant="secondary" onClick={() => updateBpm(bpm + 1)}>+1</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => updateBpm(bpm + 5)}>+5</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={tapTempo}>Tap tempo</Button>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Beats
              <Select value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))} className="w-20 text-xs">
                {[2, 3, 4, 6].map((beats) => <option key={beats} value={beats}>{beats}/4</option>)}
              </Select>
            </label>
            <label className="flex min-w-40 items-center gap-2 text-xs text-zinc-600">
              Volume
              <Input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label="Volume" />
            </label>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMuted((value) => !value)}>{muted ? "Unmute" : "Mute"}</Button>
          </div>
          <div className="mt-5 flex items-center gap-2" aria-label="Beat indicator">
            {Array.from({ length: beatsPerBar }, (_, beat) => (
              <span key={beat} className={`h-3 w-3 rounded-full ${currentBeat === beat ? "bg-[var(--vx-accent-600)]" : "bg-zinc-200"}`} />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={metronomeRunning ? stopMetronome : startMetronome}>{metronomeRunning ? "Stop" : "Start"}</Button>
            <Button type="button" variant="secondary" onClick={() => setTimerStatus((value) => value === "running" ? "paused" : "running")}>{timerStatus === "running" ? "Pause timer" : "Start timer"}</Button>
            <Button type="button" variant="ghost" onClick={resetTimer}>Reset</Button>
            <Button type="button" variant="ghost" onClick={finishSession}>Finish session</Button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Practice timer</p>
          <p className="mt-2 text-5xl font-semibold tabular-nums text-zinc-900">{formatTimer(elapsedSec)}</p>
          <p className="mt-2 text-xs text-zinc-500">{timerStatus === "running" ? "Timer running" : timerStatus === "paused" ? "Paused" : "Ready when you are."}</p>
        </div>
      </div>
      {showFinish && (
        <form action={saveSession} className="mt-6 space-y-3 border-t border-zinc-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Finish session</h3>
            <span className="text-xs text-zinc-500">{formatTimer(elapsedSec)} · {bpm} BPM</span>
          </div>
          {elapsedSec < 30 ? (
            <p className="text-xs text-zinc-500">Sessions under 30 seconds are not saved.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select name="songId" aria-label="Song">
                  <option value="">No song</option>
                  {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
                </Select>
                <input type="hidden" name="durationSec" value={elapsedSec} />
                <input type="hidden" name="bpm" value={bpm} />
              </div>
              <Textarea name="notes" placeholder="What did you work on?" rows={3} />
              <Button type="submit">Save session</Button>
            </>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </form>
      )}
    </Card>
  );
}
