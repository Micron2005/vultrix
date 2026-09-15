"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import {
  deleteBeatTake,
  saveBeatTake,
  updateBeatTake,
} from "./actions";
import {
  BeatEngine,
  type BeatDocument,
  type BeatPlaybackMode,
  type BeatTakeAudio,
} from "./engine";

export type Take = {
  id: string;
  name: string;
  audioDataUrl: string;
  audioMimeType: string;
  durationSec: number;
  offsetMs: number;
  gain: number;
  muted: boolean;
  createdAt: string;
};

type VocalsPanelProps = {
  beatId: string;
  title: string;
  engine: BeatEngine;
  getDocument: () => BeatDocument;
  getPlayback: () => { mode: BeatPlaybackMode; patternId: string };
  onStep: (index: number, step: number) => void;
  playing: boolean;
  setPlaying: (value: boolean) => void;
  startBeat: () => Promise<void>;
  stopBeat: () => void;
  initialTakes: Take[];
};

const MAX_RECORDING_SECONDS = 180;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function audioDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read recording."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export function VocalsPanel({
  beatId,
  title,
  engine,
  getDocument,
  getPlayback,
  playing,
  setPlaying,
  startBeat,
  stopBeat,
  initialTakes,
}: VocalsPanelProps) {
  const [takes, setTakes] = useState(initialTakes);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [soloSrc, setSoloSrc] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingOffsetRef = useRef(0);
  const offsetTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const decodedTakesRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const soloAudioRef = useRef<HTMLAudioElement | null>(null);

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    const offsetTimers = offsetTimersRef.current;
    const soloAudio = soloAudioRef.current;
    return () => {
      clearTimer();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
      soloAudio?.pause();
      Object.values(offsetTimers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!soloSrc || !soloAudioRef.current) return;
    void soloAudioRef.current.play();
  }, [soloSrc]);

  async function startRecording() {
    setError("");
    if (playing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microphone not available.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingStartedAtRef.current = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        clearTimer();
        setRecording(false);
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        try {
          const dataUrl = await audioDataUrl(blob);
          const durationSec = Math.max(
            1,
            Math.min(
              MAX_RECORDING_SECONDS,
              Math.round((performance.now() - recordingStartedAtRef.current) / 1000),
            ),
          );
          const saved = await saveBeatTake(beatId, {
            name: `Take ${takes.length + 1}`,
            audioDataUrl: dataUrl,
            audioMimeType: blob.type,
            durationSec,
            offsetMs: recordingOffsetRef.current,
          });
          setTakes((current) => [
            ...current,
            { ...saved, createdAt: saved.createdAt.toISOString() },
          ]);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Unable to save take.");
        }
      };
      recorder.start(250);
      recordingOffsetRef.current = 0;
      const recStartAt = engine.currentTime;
      setRecording(true);
      setRecordingSeconds(0);
      await startBeat();
      const startTime = engine.startTime;
      if (startTime !== null) {
        recordingOffsetRef.current = Math.round((recStartAt - startTime) * 1000);
      }
      timerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS && recorder.state === "recording") {
            recorder.stop();
            stopBeat();
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone not available.");
      stopStream();
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    stopBeat();
  }

  function updateTakeLocal(id: string, patch: Partial<Take>) {
    setTakes((current) =>
      current.map((take) => (take.id === id ? { ...take, ...patch } : take)),
    );
  }

  async function updateTake(id: string, patch: Partial<Take>) {
    updateTakeLocal(id, patch);
    await updateBeatTake(id, patch);
  }

  function nudgeTake(take: Take, amount: number) {
    const offsetMs = Math.max(-2000, Math.min(2000, take.offsetMs + amount));
    updateTakeLocal(take.id, { offsetMs });
    const currentTimer = offsetTimersRef.current[take.id];
    if (currentTimer) clearTimeout(currentTimer);
    offsetTimersRef.current[take.id] = setTimeout(() => {
      void updateBeatTake(take.id, { offsetMs });
    }, 400);
  }

  function beginRename(take: Take) {
    setEditingId(take.id);
    setEditingName(take.name);
  }

  async function finishRename(id: string) {
    setEditingId(null);
    const name = editingName.trim();
    if (!name) return;
    await updateTake(id, { name });
  }

  async function removeTake(take: Take) {
    if (!window.confirm(`Delete "${take.name}"?`)) return;
    await deleteBeatTake(take.id);
    setTakes((current) => current.filter((item) => item.id !== take.id));
  }

  function soloTake(take: Take) {
    soloAudioRef.current?.pause();
    setSoloSrc(take.audioDataUrl);
  }

  function decodeTake(take: Take) {
    const cached = decodedTakesRef.current.get(take.id);
    if (cached) return cached;
    const decoded = fetch(take.audioDataUrl)
      .then((response) => response.arrayBuffer())
      .then((data) => engine.audioContext.decodeAudioData(data));
    decodedTakesRef.current.set(take.id, decoded);
    return decoded;
  }

  async function decodedAudioTakes(): Promise<BeatTakeAudio[]> {
    const activeTakes = takes.filter((take) => !take.muted);
    const buffers = await Promise.all(activeTakes.map((take) => decodeTake(take)));
    return activeTakes.map((take, index) => ({
      buffer: buffers[index],
      offsetMs: take.offsetMs,
      gain: take.gain,
      muted: take.muted,
    }));
  }

  async function playWithVocals() {
    setError("");
    try {
      const decoded = await decodedAudioTakes();
      await startBeat();
      if (engine.startTime !== null) engine.playTakes(decoded, engine.startTime);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to play takes.");
      setPlaying(false);
      stopBeat();
    }
  }

  function downloadWav(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportWithVocals() {
    setError("");
    try {
      const decoded = await decodedAudioTakes();
      const playback = getPlayback();
      const blob = await engine.renderWav(getDocument(), playback.patternId, decoded);
      downloadWav(blob, `${title.trim() || "beat"} (with vocals).wav`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to export takes.");
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Vocals</h2>
        <p className="text-xs text-zinc-500">
          Use headphones so the beat doesn&apos;t bleed into the mic.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {recording ? (
          <Button type="button" variant="danger" className="h-11" onClick={stopRecording}>
            ■ Stop
          </Button>
        ) : (
          <Button type="button" className="h-11" onClick={() => void startRecording()} disabled={playing}>
            ● Record
          </Button>
        )}
        {recording && (
          <span className="text-sm font-semibold text-red-600">
            REC {formatDuration(recordingSeconds)}
          </span>
        )}
        {!recording && takes.length > 0 && (
          <>
            <Button type="button" variant="secondary" onClick={() => void playWithVocals()} disabled={playing}>
              ▶ Play with vocals
            </Button>
            <Button type="button" variant="secondary" onClick={() => void exportWithVocals()}>
              Export with vocals
            </Button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {takes.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">
          No takes yet. Put headphones on, hit Record, and the beat starts playing while you sing or rap.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {takes.map((take) => (
            <div key={take.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
              {editingId === take.id ? (
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onBlur={() => void finishRename(take.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-8 min-w-32 flex-1 text-xs"
                />
              ) : (
                <button type="button" className="min-w-24 flex-1 truncate text-left text-xs font-medium text-zinc-900 hover:underline" onClick={() => beginRename(take)}>
                  {take.name}
                </button>
              )}
              <span className="text-xs tabular-nums text-zinc-500">{formatDuration(take.durationSec)}</span>
              <Button type="button" size="sm" variant={take.muted ? "secondary" : "ghost"} onClick={() => void updateTake(take.id, { muted: !take.muted })}>
                M
              </Button>
              <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                Vol
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={take.gain}
                  onChange={(event) => updateTakeLocal(take.id, { gain: Number(event.target.value) })}
                  onMouseUp={(event) => void updateTake(take.id, { gain: Number(event.currentTarget.value) })}
                  onTouchEnd={(event) => void updateTake(take.id, { gain: Number(event.currentTarget.value) })}
                  aria-label={`${take.name} volume`}
                />
                <span className="w-7 tabular-nums">{take.gain}</span>
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => nudgeTake(take, -10)}>
                ◂ 10ms
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => nudgeTake(take, 10)}>
                10ms ▸
              </Button>
              <span className="text-[10px] tabular-nums text-zinc-500">
                offset {take.offsetMs < 0 ? "−" : ""}{Math.abs(take.offsetMs)} ms
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => soloTake(take)}>
                ▶
              </Button>
              <Button type="button" size="sm" variant="danger" onClick={() => void removeTake(take)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
      <audio ref={soloAudioRef} className="hidden" />
    </Card>
  );
}
