"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { saveLyricsText } from "../actions";
import {
  copySongTakeToBeat,
  deleteSongVocalTake,
  renameSongVocalTake,
  saveSongVocalTake,
} from "./actions";

const MAX_RECORDING_SECONDS = 900;
const FONT_KEY = "lyrics-font";

type Song = {
  id: string;
  title: string;
  lyrics: string | null;
  bpm: number | null;
};

type VocalTake = {
  id: string;
  songId: string;
  name: string;
  audioMimeType: string;
  durationSec: number;
  createdAt: Date | string;
};

type Beat = { id: string; title: string; songId: string | null };

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function readAudioData(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read recording."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export function LyricsWorkspace({
  songs,
  selectedSong,
  beats,
}: {
  songs: Song[];
  selectedSong: Song & { vocalTakes: VocalTake[] };
  beats: Beat[];
}) {
  const router = useRouter();
  const [lyrics, setLyrics] = useState(selectedSong.lyrics ?? "");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [fontSize, setFontSize] = useState(1);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [takes, setTakes] = useState(selectedSong.vocalTakes);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [addedBeat, setAddedBeat] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const initializedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(FONT_KEY));
        if (stored >= 0.8 && stored <= 1.4) setFontSize(stored);
      } catch {
        setFontSize(1);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void saveLyricsText(selectedSong.id, lyrics)
        .then(() => setSaveState("saved"))
        .catch(() => {
          setSaveState("saved");
          setError("Unable to save lyrics.");
        });
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [lyrics, selectedSong.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const orderedBeats = useMemo(
    () => [
      ...beats.filter((beat) => beat.songId === selectedSong.id),
      ...beats.filter((beat) => beat.songId !== selectedSong.id),
    ],
    [beats, selectedSong.id],
  );

  function chooseSong(id: string) {
    router.push(`/songs/lyrics?song=${id}`);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Microphone not available.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const supported = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = supported.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        stopStream();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        try {
          const durationSec = Math.max(
            1,
            Math.min(MAX_RECORDING_SECONDS, Math.round((performance.now() - startedAtRef.current) / 1000)),
          );
          const saved = await saveSongVocalTake(selectedSong.id, {
            name: `Take ${takes.length + 1}`,
            audioDataUrl: await readAudioData(blob),
            audioMimeType: blob.type,
            durationSec,
          });
          setTakes((current) => [...current, saved]);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Unable to save take.");
        }
      };
      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS && recorder.state === "recording") {
            recorder.stop();
            setError("Recording stopped at the 15 minute limit — saved as a take");
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Microphone denied or unavailable.");
      stopStream();
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function finishRename(id: string) {
    const name = editingName.trim();
    setEditingId(null);
    if (!name) return;
    try {
      await renameSongVocalTake(id, name);
      setTakes((current) => current.map((take) => (take.id === id ? { ...take, name } : take)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to rename take.");
    }
  }

  async function removeTake(take: VocalTake) {
    if (!window.confirm(`Delete "${take.name}"?`)) return;
    try {
      await deleteSongVocalTake(take.id);
      setTakes((current) => current.filter((item) => item.id !== take.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete take.");
    }
  }

  async function addToBeat(takeId: string, beat: Beat) {
    try {
      await copySongTakeToBeat(takeId, beat.id);
      setAddedBeat(beat.title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add take to beat.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Write</h2>
            <p className="mt-1 text-xs text-zinc-500">{saveState === "saving" ? "Saving…" : "Saved"}</p>
          </div>
          <Select value={selectedSong.id} onChange={(event) => chooseSong(event.target.value)} aria-label="Lyrics song">
            {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
          </Select>
        </div>
        <div className="mt-3 flex justify-end gap-1">
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontSize((value) => Math.max(0.8, value - 0.1))}>A−</Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setFontSize((value) => Math.min(1.4, value + 0.1))}>A+</Button>
        </div>
        <Textarea
          value={lyrics}
          onChange={(event) => setLyrics(event.target.value.slice(0, 20_000))}
          aria-label="Lyrics"
          className="mt-2 min-h-[60vh] resize-y text-lg leading-relaxed"
          style={{ fontSize: `${fontSize}rem` }}
          placeholder={"[Verse 1]\nWrite your lyrics here…"}
        />
        <p className="mt-2 text-xs text-zinc-500">Use blank lines to separate sections. Put section labels in [Brackets].</p>
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Sing it</h2>
            <p className="mt-1 text-xs text-zinc-500">Record a vocal take for this song.</p>
          </div>
          {recording ? (
            <Button type="button" variant="danger" onClick={stopRecording}>■ Stop</Button>
          ) : (
            <Button type="button" onClick={() => void startRecording()}>● Record</Button>
          )}
        </div>
        {recording && <p className="mt-3 text-sm font-semibold text-red-600">REC {formatDuration(recordingSeconds)} / 15:00</p>}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {addedBeat && <p className="mt-3 text-xs text-[var(--vx-accent-700)]">Added to {addedBeat}</p>}
        <div className="mt-4 space-y-2">
          {takes.length === 0 ? (
            <p className="text-sm text-zinc-500">No vocal takes yet.</p>
          ) : takes.map((take) => (
            <div key={take.id} className="rounded-lg bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {editingId === take.id ? (
                  <Input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} onBlur={() => void finishRename(take.id)} className="h-8 min-w-32 flex-1 text-xs" />
                ) : (
                  <button type="button" className="min-w-24 flex-1 truncate text-left text-xs font-medium text-zinc-900 hover:underline" onClick={() => { setEditingId(take.id); setEditingName(take.name); }}>
                    {take.name}
                  </button>
                )}
                <span className="text-xs tabular-nums text-zinc-500">{formatDuration(take.durationSec)}</span>
                <Button type="button" size="xs" variant="danger" onClick={() => void removeTake(take)}>Delete</Button>
              </div>
              <audio controls preload="none" src={`/songs/audio/song/${take.id}`} className="mt-2 h-8 w-full" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select value="closed" onChange={(event) => { const beat = beats.find((item) => item.id === event.target.value); if (beat) void addToBeat(take.id, beat); }} aria-label={`Use ${take.name} in beat`}>
                  <option value="closed">Use in beat…</option>
                  {orderedBeats.map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}
                </Select>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
