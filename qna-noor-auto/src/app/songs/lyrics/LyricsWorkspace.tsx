"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { saveLyricsText } from "../actions";
import {
  appendSongVocalTakeChunk,
  beginSongVocalTake,
  copySongTakeToBeat,
  discardSongVocalTake,
  deleteSongVocalTake,
  finishSongVocalTake,
  deleteLyricDraft,
  findRhymes,
  restoreLyricDraft,
  saveLyricDraft,
  renameSongVocalTake,
} from "./actions";
import { uploadInChunks } from "../uploadTake";
import { countSyllables } from "@/lib/lyrics";

const MAX_RECORDING_SECONDS = 900;
const FONT_KEY = "lyrics-font";
const SYLLABLES_KEY = "vx.lyrics.syllables";

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
type LyricDraft = {
  id: string;
  name: string;
  lyrics: string;
  createdAt: Date | string;
};

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDraftTime(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function lineSyllables(line: string) {
  if (!line.trim() || /^\s*\[[^\]]+\]\s*$/.test(line)) return "";
  return String(
    line
      .trim()
      .split(/\s+/)
      .reduce((sum, word) => sum + countSyllables(word), 0),
  );
}

function lastWordAtCaret(text: string, caret: number) {
  const line = text.slice(0, caret).split(/\r?\n/).pop() ?? "";
  return line.match(/[a-zA-Z']+/g)?.at(-1) ?? "";
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
  selectedSong: Song & { vocalTakes: VocalTake[]; drafts: LyricDraft[] };
  beats: Beat[];
}) {
  const router = useRouter();
  const [lyrics, setLyrics] = useState(selectedSong.lyrics ?? "");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [fontSize, setFontSize] = useState(1);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [takes, setTakes] = useState(selectedSong.vocalTakes);
  const [drafts, setDrafts] = useState(selectedSong.drafts);
  const [showRhymes, setShowRhymes] = useState(false);
  const [rhymeWord, setRhymeWord] = useState("");
  const [rhymeResults, setRhymeResults] = useState<{ perfect: string[]; near: string[] } | null>(null);
  const [rhymeLoading, setRhymeLoading] = useState(false);
  const [rhymeError, setRhymeError] = useState("");
  const [syllablesOn, setSyllablesOn] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftInputOpen, setDraftInputOpen] = useState(false);
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
  const cancelRenameRef = useRef(false);
  const fontLoadedRef = useRef(false);
  const syllablesLoadedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const rhymeCaretRef = useRef(0);

  useEffect(() => {
    fontLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        const stored = Number(localStorage.getItem(FONT_KEY));
        if (stored >= 0.8 && stored <= 1.4) setFontSize(stored);
      } catch {
        setFontSize(1);
      } finally {
        fontLoadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fontLoadedRef.current) return;
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    syllablesLoadedRef.current = false;
    const timer = window.setTimeout(() => {
      try {
        setSyllablesOn(localStorage.getItem(SYLLABLES_KEY) === "true");
      } catch {
        setSyllablesOn(false);
      } finally {
        syllablesLoadedRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!syllablesLoadedRef.current) return;
    localStorage.setItem(SYLLABLES_KEY, String(syllablesOn));
  }, [syllablesOn]);

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

  function openRhymes() {
    const caret = textareaRef.current?.selectionStart ?? lyrics.length;
    rhymeCaretRef.current = caret;
    setRhymeWord(lastWordAtCaret(lyrics, caret));
    setRhymeResults(null);
    setRhymeError("");
    setShowRhymes(true);
  }

  async function loadRhymes() {
    setRhymeLoading(true);
    setRhymeError("");
    try {
      setRhymeResults(await findRhymes(rhymeWord));
    } catch (caught) {
      setRhymeResults(null);
      setRhymeError(caught instanceof Error ? caught.message : "Rhymes unavailable right now");
    } finally {
      setRhymeLoading(false);
    }
  }

  function insertRhyme(word: string) {
    const caret = rhymeCaretRef.current;
    const before = lyrics.slice(0, caret);
    const separator = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${separator}${word}${lyrics.slice(caret)}`;
    const nextCaret = before.length + separator.length + word.length;
    setLyrics(next);
    rhymeCaretRef.current = nextCaret;
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    }, 0);
  }

  function openDraftInput() {
    setDraftName(`Draft ${drafts.length + 1} · ${formatDraftTime(new Date())}`);
    setDraftInputOpen(true);
  }

  async function saveDraft() {
    try {
      const saved = await saveLyricDraft(selectedSong.id, draftName, lyrics);
      setDrafts((current) => [saved, ...current]);
      setDraftInputOpen(false);
      setDraftName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save draft.");
    }
  }

  async function restoreDraft(draft: LyricDraft) {
    try {
      let nextDrafts = drafts;
      if (lyrics !== draft.lyrics) {
        const before = await saveLyricDraft(
          selectedSong.id,
          `Before restore · ${formatDraftTime(new Date())}`,
          lyrics,
        );
        nextDrafts = [before, ...nextDrafts];
        setDrafts(nextDrafts);
      }
      const restored = await restoreLyricDraft(draft.id);
      setLyrics(restored.lyrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to restore draft.");
    }
  }

  async function removeDraft(id: string) {
    try {
      await deleteLyricDraft(id);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete draft.");
    }
  }

  const syllableLines = syllablesOn ? lyrics.split(/\r?\n/).map(lineSyllables) : [];

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
          const dataUrl = await readAudioData(blob);
          const pending = await beginSongVocalTake(selectedSong.id, {
            name: `Take ${takes.length + 1}`,
            audioMimeType: blob.type,
            durationSec,
          });
          try {
            setUploadProgress(0);
            await uploadInChunks(
              dataUrl,
              (chunk) => appendSongVocalTakeChunk(pending.id, chunk),
              setUploadProgress,
            );
            const saved = await finishSongVocalTake(pending.id);
            setTakes((current) => [...current, saved]);
          } catch (caught) {
            await discardSongVocalTake(pending.id).catch(() => undefined);
            throw caught;
          } finally {
            setUploadProgress(null);
          }
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
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      setEditingId(null);
      return;
    }
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" size="xs" variant="ghost" onClick={openRhymes}>Rhymes</Button>
            <Button type="button" size="xs" variant={syllablesOn ? "secondary" : "ghost"} onClick={() => setSyllablesOn((value) => !value)}>Syllables</Button>
            <Button type="button" size="xs" variant="ghost" onClick={openDraftInput}>Save draft</Button>
          </div>
          <div className="flex gap-1">
            <Button type="button" size="xs" variant="ghost" onClick={() => setFontSize((value) => Math.max(0.8, value - 0.1))}>A−</Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setFontSize((value) => Math.min(1.4, value + 0.1))}>A+</Button>
          </div>
        </div>
        {showRhymes && (
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center gap-2">
              <Input
                value={rhymeWord}
                onChange={(event) => setRhymeWord(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadRhymes(); } }}
                aria-label="Rhyme word"
                className="flex-1"
              />
              <Button type="button" size="xs" onClick={() => void loadRhymes()} disabled={rhymeLoading}>Find</Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setShowRhymes(false)} aria-label="Close rhymes">×</Button>
            </div>
            {rhymeLoading && <p className="mt-2 text-xs text-zinc-500">Finding rhymes…</p>}
            {rhymeError && <p className="mt-2 text-xs text-red-600">{rhymeError}</p>}
            {rhymeResults && (
              <div className="mt-3 space-y-2">
                {(["perfect", "near"] as const).map((kind) => (
                  <div key={kind}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{kind === "perfect" ? "Rhymes" : "Near"}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(rhymeResults[kind].length ? rhymeResults[kind] : ["No results"]).map((word) => (
                        <button
                          key={word}
                          type="button"
                          disabled={word === "No results"}
                          onClick={() => insertRhyme(word)}
                          className="rounded-full bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-100 disabled:cursor-default disabled:opacity-60"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {draftInputOpen && (
          <div className="mt-2 flex items-center gap-2">
            <Input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); void saveDraft(); }
                if (event.key === "Escape") { event.preventDefault(); setDraftInputOpen(false); }
              }}
              aria-label="Draft name"
            />
            <Button type="button" size="xs" onClick={() => void saveDraft()}>Save</Button>
          </div>
        )}
        <div className="mt-2 flex min-h-[60vh]">
          {syllablesOn && (
            <pre
              ref={gutterRef}
              aria-hidden="true"
              className="w-8 shrink-0 overflow-hidden border-r border-zinc-200 pr-2 text-right text-lg leading-relaxed text-zinc-400"
              style={{ fontSize: `${fontSize}rem` }}
            >
              {syllableLines.map((value, index) => <div key={index}>{value}</div>)}
            </pre>
          )}
          <Textarea
            ref={textareaRef}
            value={lyrics}
            onChange={(event) => setLyrics(event.target.value.slice(0, 20_000))}
            onScroll={(event) => {
              if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
            }}
            aria-label="Lyrics"
            className="min-h-[60vh] flex-1 resize-y text-lg leading-relaxed"
            style={{ fontSize: `${fontSize}rem` }}
            placeholder={"[Verse 1]\nWrite your lyrics here…"}
          />
        </div>
        <details className="mt-3 rounded-lg border border-zinc-200 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-zinc-700">Drafts ({drafts.length})</summary>
          <div className="mt-2 space-y-2">
            {drafts.length === 0 ? (
              <p className="text-xs text-zinc-500">No drafts yet.</p>
            ) : drafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 p-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-800">{draft.name}</p>
                  <p className="text-[11px] text-zinc-500">{formatDraftTime(draft.createdAt)} · {draft.lyrics.split(/\r?\n/).length} lines</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" size="xs" variant="ghost" onClick={() => void restoreDraft(draft)}>Restore</Button>
                  <Button type="button" size="xs" variant="danger" onClick={() => void removeDraft(draft.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </details>
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
        {uploadProgress !== null && <p className="mt-3 text-sm font-semibold text-[var(--vx-accent-700)]">Saving… {Math.round(uploadProgress * 100)}%</p>}
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {addedBeat && <p className="mt-3 text-xs text-[var(--vx-accent-700)]">Added to {addedBeat}</p>}
        <div className="mt-4 space-y-2">
          {takes.length === 0 ? (
            <p className="text-sm text-zinc-500">No vocal takes yet.</p>
          ) : takes.map((take) => (
            <div key={take.id} className="rounded-lg bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {editingId === take.id ? (
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRenameRef.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                    onBlur={() => void finishRename(take.id)}
                    className="h-8 min-w-32 flex-1 text-xs"
                  />
                ) : (
                  <button type="button" className="min-w-24 flex-1 truncate text-left text-xs font-medium text-zinc-900 hover:underline" onClick={() => { cancelRenameRef.current = false; setEditingId(take.id); setEditingName(take.name); }}>
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
