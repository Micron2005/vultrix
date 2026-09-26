"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, LinkButton, Select } from "@/components/ui";
import {
  attachBeatToSong,
  appendBeatTakeChunk,
  beginBeatTake,
  createBeatVocalLayer,
  discardBeatTake,
  deleteBeatTake,
  deleteBeatVocalLayer,
  finishBeatTake,
  updateBeatVocalLayer,
  updateBeatTake,
} from "./actions";
import { copySongTakeToBeat } from "../lyrics/actions";
import { TAKE_AUDIO_BITS_PER_SECOND, saveTakeErrorMessage, uploadInChunks } from "../uploadTake";
import { LyricFollowAlong } from "../LyricFollowAlong";
import {
  BeatEngine,
  type BeatDocument,
  type BeatPlaybackMode,
  type BeatTakeAudio,
} from "./engine";

export type Take = {
  id: string;
  name: string;
  audioMimeType: string;
  durationSec: number;
  offsetMs: number;
  gain: number;
  muted: boolean;
  layerId: string | null;
  createdAt: string;
};

export type VocalLayer = {
  id: string;
  name: string;
  gain: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  sortOrder: number;
};

type SongVocalTake = {
  id: string;
  songId: string;
  name: string;
  audioMimeType: string;
  durationSec: number;
  createdAt: string;
};

type VocalsPanelProps = {
  beatId: string;
  title: string;
  song: {
    id: string;
    title: string;
    lyrics: string | null;
    lyricsMeta: string | null;
  } | null;
  songs: Array<{
    id: string;
    title: string;
    lyrics: string | null;
    lyricsMeta: string | null;
  }>;
  engine: BeatEngine;
  getDocument: () => BeatDocument;
  getPlayback: () => { mode: BeatPlaybackMode; patternId: string };
  playing: boolean;
  setPlaying: (value: boolean) => void;
  startBeat: () => Promise<void>;
  stopBeat: () => void;
  initialTakes: Take[];
  initialLayers: VocalLayer[];
  songVocalTakes: SongVocalTake[];
};

const MAX_RECORDING_SECONDS = 900;

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
  song,
  songs,
  engine,
  getDocument,
  getPlayback,
  playing,
  setPlaying,
  startBeat,
  stopBeat,
  initialTakes,
  initialLayers,
  songVocalTakes,
}: VocalsPanelProps) {
  const [takes, setTakes] = useState(initialTakes);
  const [layers, setLayers] = useState(
    [...initialLayers].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState("");
  const [newLayerName, setNewLayerName] = useState("");
  const [recordLayerId, setRecordLayerId] = useState(initialLayers[0]?.id ?? "");
  const [songLayerId, setSongLayerId] = useState(initialLayers[0]?.id ?? "");
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
  const cancelLayerBlurRef = useRef(false);

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

  async function startRecording(layerId = recordLayerId || layers[0]?.id) {
    setError("");
    if (!layerId) {
      setError("Add a vocal layer first.");
      return;
    }
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
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: TAKE_AUDIO_BITS_PER_SECOND })
        : new MediaRecorder(stream, { audioBitsPerSecond: TAKE_AUDIO_BITS_PER_SECOND });
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
          const pending = await beginBeatTake(beatId, {
            name: `Take ${takes.length + 1}`,
            audioMimeType: blob.type,
            durationSec,
            offsetMs: recordingOffsetRef.current,
            layerId,
          });
          try {
            setUploadProgress(0);
            await uploadInChunks(
              dataUrl,
              (chunk) => appendBeatTakeChunk(pending.id, chunk),
              setUploadProgress,
            );
            const saved = await finishBeatTake(pending.id);
            setTakes((current) => [
              ...current,
              { ...saved, createdAt: saved.createdAt.toISOString() },
            ]);
          } catch (caught) {
            await discardBeatTake(pending.id).catch(() => undefined);
            throw caught;
          } finally {
            setUploadProgress(null);
          }
        } catch (caught) {
          setError(saveTakeErrorMessage(caught));
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
            setError("Recording stopped at the 15 minute limit — saved as a take");
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

  function updateLayerLocal(id: string, patch: Partial<VocalLayer>) {
    setLayers((current) =>
      current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    );
  }

  async function updateLayer(id: string, patch: Partial<VocalLayer>) {
    updateLayerLocal(id, patch);
    await updateBeatVocalLayer(id, patch);
  }

  function beginLayerRename(layer: VocalLayer) {
    setEditingLayerId(layer.id);
    setEditingLayerName(layer.name);
  }

  async function finishLayerRename(id: string) {
    if (cancelLayerBlurRef.current) {
      cancelLayerBlurRef.current = false;
      return;
    }
    setEditingLayerId(null);
    const name = editingLayerName.trim();
    if (!name) return;
    await updateLayer(id, { name });
  }

  async function addLayer() {
    const name = newLayerName.trim();
    if (!name) return;
    setError("");
    try {
      const saved = await createBeatVocalLayer(beatId, name);
      setLayers((current) => [...current, saved].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewLayerName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add layer.");
    }
  }

  async function removeLayer(layer: VocalLayer) {
    if (
      layers.length <= 1 ||
      !window.confirm(`Delete "${layer.name}"? Takes will move to the first remaining layer.`)
    ) return;
    const target = layers.find((item) => item.id !== layer.id);
    if (!target) return;
    try {
      await deleteBeatVocalLayer(layer.id);
      setLayers((current) => current.filter((item) => item.id !== layer.id));
      if (recordLayerId === layer.id) setRecordLayerId(target.id);
      if (songLayerId === layer.id) setSongLayerId(target.id);
      setTakes((current) =>
        current.map((take) => (
          take.layerId === layer.id ? { ...take, layerId: target.id } : take
        )),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete layer.");
    }
  }

  async function moveLayer(layer: VocalLayer, direction: -1 | 1) {
    const index = layers.findIndex((item) => item.id === layer.id);
    const other = layers[index + direction];
    if (!other) return;
    const next = [...layers];
    next[index] = { ...other, sortOrder: layer.sortOrder };
    next[index + direction] = { ...layer, sortOrder: other.sortOrder };
    setLayers(next);
    await Promise.all([
      updateBeatVocalLayer(layer.id, { sortOrder: other.sortOrder }),
      updateBeatVocalLayer(other.id, { sortOrder: layer.sortOrder }),
    ]);
  }

  async function removeTake(take: Take) {
    if (!window.confirm(`Delete "${take.name}"?`)) return;
    await deleteBeatTake(take.id);
    setTakes((current) => current.filter((item) => item.id !== take.id));
  }

  function soloTake(take: Take) {
    soloAudioRef.current?.pause();
    setSoloSrc(`/songs/audio/beat/${take.id}`);
  }

  function decodeTake(take: Take) {
    const cached = decodedTakesRef.current.get(take.id);
    if (cached) return cached;
    const decoded = fetch(`/songs/audio/beat/${take.id}`)
      .then((response) => response.arrayBuffer())
      .then((data) => engine.audioContext.decodeAudioData(data));
    decodedTakesRef.current.set(take.id, decoded);
    return decoded;
  }

  async function decodedAudioTakes(): Promise<BeatTakeAudio[]> {
    const anyLayerSolo = layers.some((layer) => layer.solo);
    const buffers = await Promise.all(takes.map((take) => decodeTake(take)));
    return takes.map((take, index) => {
      const layer = layers.find((item) => item.id === take.layerId) ?? layers[0];
      const muted = take.muted
        || !layer
        || layer.muted
        || (anyLayerSolo && !layer.solo);
      return {
      buffer: buffers[index],
      offsetMs: take.offsetMs,
      gain: Math.round(take.gain * (layer?.gain ?? 100) / 100),
      pan: layer?.pan ?? 0,
      muted,
      };
    });
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

  async function addSongTake(take: SongVocalTake) {
    setError("");
    try {
      const saved = await copySongTakeToBeat(take.id, beatId, songLayerId);
      setTakes((current) => [
        ...current,
        { ...saved, createdAt: saved.createdAt.toISOString() },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add vocal take.");
    }
  }

  function renderTakeRow(take: Take) {
    return (
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
              if (event.key === "Escape") {
                setEditingId(null);
                event.currentTarget.blur();
              }
            }}
            className="h-8 min-w-32 flex-1 text-xs"
          />
        ) : (
          <button
            type="button"
            className="min-w-24 flex-1 truncate text-left text-xs font-medium text-zinc-900 hover:underline"
            onClick={() => beginRename(take)}
          >
            {take.name}
          </button>
        )}
        <span className="text-xs tabular-nums text-zinc-500">{formatDuration(take.durationSec)}</span>
        <Button type="button" size="sm" variant={take.muted ? "secondary" : "ghost"} onClick={() => void updateTake(take.id, { muted: !take.muted })}>
          M
        </Button>
        {layers.length > 1 && (
          <Select
            value=""
            aria-label={`Move ${take.name} to layer`}
            onChange={(event) => {
              if (event.currentTarget.value) void updateTake(take.id, { layerId: event.currentTarget.value });
            }}
            className="h-8 max-w-32 text-xs"
          >
            <option value="">Move to…</option>
            {layers.filter((layer) => layer.id !== take.layerId).map((layer) => (
              <option key={layer.id} value={layer.id}>{layer.name}</option>
            ))}
          </Select>
        )}
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
    );
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
          <Button type="button" className="h-11" onClick={() => void startRecording(layers[0]?.id)} disabled={playing}>
            ● Record
          </Button>
        )}
        {recording && (
          <span className="text-sm font-semibold text-red-600">
            REC {formatDuration(recordingSeconds)} / 15:00
          </span>
        )}
        {uploadProgress !== null && (
          <span className="text-sm font-semibold text-[var(--vx-accent-700)]">
            Saving… {Math.round(uploadProgress * 100)}%
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
      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-6">
        <div className="order-2 lg:order-1">
          {takes.length === 0 && (
            <p className="mb-3 text-xs text-zinc-500">
              No takes yet. Put headphones on, hit Record, and the beat starts playing while you sing or rap.
            </p>
          )}
          <div className="space-y-4">
              {layers.map((layer, index) => {
                const layerTakes = takes.filter((take) => (take.layerId ?? layers[0]?.id) === layer.id);
                return (
                  <section key={layer.id} className="rounded-lg border border-zinc-200 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {editingLayerId === layer.id ? (
                        <Input
                          autoFocus
                          value={editingLayerName}
                          onChange={(event) => setEditingLayerName(event.target.value)}
                          onBlur={() => void finishLayerRename(layer.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              cancelLayerBlurRef.current = true;
                              setEditingLayerId(null);
                              event.currentTarget.blur();
                            }
                          }}
                          className="h-8 min-w-32 flex-1 text-xs"
                        />
                      ) : (
                        <button type="button" className="min-w-24 flex-1 truncate text-left text-sm font-semibold text-zinc-900 hover:underline" onClick={() => beginLayerRename(layer)}>
                          {layer.name}
                        </button>
                      )}
                      <Button type="button" size="sm" variant={layer.muted ? "secondary" : "ghost"} onClick={() => void updateLayer(layer.id, { muted: !layer.muted })}>M</Button>
                      <Button type="button" size="sm" variant={layer.solo ? "secondary" : "ghost"} onClick={() => void updateLayer(layer.id, { solo: !layer.solo })}>S</Button>
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                        Vol
                        <input
                          type="range"
                          min="0"
                          max="150"
                          value={layer.gain}
                          onChange={(event) => updateLayerLocal(layer.id, { gain: Number(event.target.value) })}
                          onMouseUp={(event) => void updateLayer(layer.id, { gain: Number(event.currentTarget.value) })}
                          onTouchEnd={(event) => void updateLayer(layer.id, { gain: Number(event.currentTarget.value) })}
                          aria-label={`${layer.name} volume`}
                        />
                        <span className="w-7 tabular-nums">{layer.gain}</span>
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                        Pan
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={layer.pan}
                          onChange={(event) => updateLayerLocal(layer.id, { pan: Number(event.target.value) })}
                          onMouseUp={(event) => void updateLayer(layer.id, { pan: Number(event.currentTarget.value) })}
                          onTouchEnd={(event) => void updateLayer(layer.id, { pan: Number(event.currentTarget.value) })}
                          aria-label={`${layer.name} pan`}
                        />
                        <span className="w-8 tabular-nums">{layer.pan === 0 ? "C" : layer.pan < 0 ? `L${Math.abs(layer.pan)}` : `R${layer.pan}`}</span>
                      </label>
                      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => void moveLayer(layer, -1)}>▲</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={index === layers.length - 1} onClick={() => void moveLayer(layer, 1)}>▼</Button>
                      {layers.length > 1 && <Button type="button" size="sm" variant="danger" onClick={() => void removeLayer(layer)}>Delete layer</Button>}
                      <Button type="button" size="sm" variant="secondary" onClick={() => { setRecordLayerId(layer.id); void startRecording(layer.id); }} disabled={playing || recording}>● Record here</Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {layerTakes.length ? layerTakes.map(renderTakeRow) : <p className="px-2 py-1 text-xs text-zinc-500">No takes in this layer.</p>}
                    </div>
                  </section>
                );
              })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={newLayerName}
              onChange={(event) => setNewLayerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addLayer();
                }
              }}
              placeholder="Adlibs, Hook, Harmony…"
              className="h-9 max-w-56 text-xs"
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => void addLayer()}>+ Add layer</Button>
          </div>
          {songVocalTakes.length > 0 && (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Song vocals</h3>
              <p className="mt-1 text-xs text-zinc-500">Recorded in Lyrics — add one to hear it over this beat.</p>
              <div className="mt-2 space-y-2">
                {songVocalTakes.map((take) => (
                  <div key={take.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
                    <span className="min-w-24 flex-1 truncate text-xs font-medium text-zinc-900">{take.name}</span>
                    <span className="text-xs tabular-nums text-zinc-500">{formatDuration(take.durationSec)}</span>
                    <audio controls preload="none" src={`/songs/audio/song/${take.id}`} className="h-8 max-w-40" />
                    <Select
                      value={songLayerId}
                      aria-label={`Layer for ${take.name}`}
                      onChange={(event) => setSongLayerId(event.currentTarget.value)}
                      className="h-8 max-w-32 text-xs"
                    >
                      {layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
                    </Select>
                    <Button type="button" size="sm" variant="secondary" onClick={() => void addSongTake(take)}>
                      Add to ▾
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="order-1 mt-6 lg:order-2 lg:mt-0">
          {song?.lyrics?.trim() ? (
            <>
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">Lyrics — {song.title}</h3>
              <LyricFollowAlong
                songId={song.id}
                lyrics={song.lyrics}
                lyricsMeta={song.lyricsMeta}
                maxHeightClass="max-h-[28rem] lg:max-h-[40rem]"
                storageKey="vx_lyric_vocals_v1"
              />
            </>
          ) : song ? (
            <>
              <p className="text-sm text-zinc-500">No lyrics yet for {song.title}</p>
              <LinkButton href={`/songs/lyrics?song=${song.id}`} size="sm" className="mt-3">Open Lyrics</LinkButton>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500">Pick the song this beat is for to see its lyrics here</p>
              <form action={attachBeatToSong.bind(null, beatId)} className="mt-3">
                <Select name="songId" defaultValue="" aria-label="Attach beat to song" onChange={(event) => event.currentTarget.form?.requestSubmit()} className="max-w-56 text-xs">
                  <option value="">Pick a song</option>
                  {songs.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </Select>
              </form>
            </>
          )}
        </div>
      </div>
      <audio ref={soloAudioRef} className="hidden" />
    </Card>
  );
}
