"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { createIdea } from "./actions";

type SongOption = {
  id: string;
  title: string;
};

const MAX_RECORDING_SECONDS = 120;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function IdeaCapture({
  songs,
  initialSongId,
}: {
  songs: SongOption[];
  initialSongId?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioMimeType, setAudioMimeType] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [microphoneMessage, setMicrophoneMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function finishRecording() {
    clearTimer();
    setRecording(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError("");
    setMicrophoneMessage("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicrophoneMessage("Microphone not available — you can still type an idea.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const nextPreviewUrl = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(nextPreviewUrl);
        setAudioMimeType(blob.type);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Unable to read recording."));
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        setAudioDataUrl(dataUrl);
        finishRecording();
      };
      recorder.start();
      setRecordingSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS) recorder.stop();
          return next;
        });
      }, 1000);
    } catch {
      setMicrophoneMessage("Microphone not available — you can still type an idea.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function rerecord() {
    setAudioDataUrl("");
    setAudioMimeType("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setRecordingSeconds(0);
  }

  async function saveIdea(formData: FormData) {
    setError("");
    setSaving(true);
    try {
      await createIdea(formData);
      formRef.current?.reset();
      setAudioDataUrl("");
      setAudioMimeType("");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setRecordingSeconds(0);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save idea.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} action={saveIdea} className="space-y-4">
      <Textarea
        name="body"
        placeholder="Lyric, hook, or thought…"
        rows={4}
        required={!audioDataUrl}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Input name="title" placeholder="Optional title" />
        <Select name="songId" defaultValue={initialSongId ?? ""}>
          <option value="">Unassigned</option>
          {songs.map((song) => (
            <option key={song.id} value={song.id}>
              {song.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <Button
              type="button"
              variant="primary"
              onClick={startRecording}
              className="h-12 w-12 rounded-full p-0"
              aria-label="Record voice memo"
            >
              Record
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              onClick={stopRecording}
              className="h-12 w-12 animate-pulse rounded-full p-0 ring-4 ring-red-200"
              aria-label="Stop recording"
            >
              Stop · {formatDuration(recordingSeconds)}
            </Button>
          )}
          {recording && (
            <span className="text-xs text-zinc-500">
              Recording up to {formatDuration(MAX_RECORDING_SECONDS)}
            </span>
          )}
        </div>
        <Button type="submit" disabled={recording || saving}>
          {saving ? "Saving…" : "Save idea"}
        </Button>
      </div>
      {previewUrl && (
        <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              {formatDuration(recordingSeconds)}
            </span>
            <button
              type="button"
              onClick={rerecord}
              className="text-xs font-medium text-zinc-700 underline"
            >
              Re-record
            </button>
          </div>
        </div>
      )}
      <input type="hidden" name="audioDataUrl" value={audioDataUrl} />
      <input type="hidden" name="audioMimeType" value={audioMimeType} />
      <input type="hidden" name="durationSec" value={audioDataUrl ? recordingSeconds : ""} />
      {microphoneMessage && <p className="text-xs text-zinc-500">{microphoneMessage}</p>}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}
