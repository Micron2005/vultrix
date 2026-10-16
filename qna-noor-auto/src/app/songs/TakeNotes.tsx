"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  addTakeNote,
  deleteTakeNote,
  listTakeNotes,
  setTakeNoteResolved,
} from "./takeNotes";
import { formatClock, parseClock, type TakeKind } from "@/lib/takeNotes";

type Note = Awaited<ReturnType<typeof listTakeNotes>>[number];

export function TakeNotes({
  kind,
  takeId,
  src,
  durationSec,
  initialCount,
}: {
  kind: TakeKind;
  takeId: string;
  src: string;
  durationSec: number;
  initialCount: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [time, setTime] = useState("0:00");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [hideResolved, setHideResolved] = useState(false);

  async function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setTime(formatClock((audioRef.current?.currentTime ?? 0) * 1000));
    if (loaded) return;
    setLoading(true);
    try {
      setNotes(await listTakeNotes(kind, takeId));
      setLoaded(true);
    } catch {
      setError("Unable to load notes.");
    } finally {
      setLoading(false);
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const atMs = parseClock(time);
    if (atMs === null || atMs > durationSec * 1000 || !text.trim()) {
      setError("Enter a valid time and a note.");
      return;
    }
    const draftId = `draft-${crypto.randomUUID()}`;
    const draft: Note = {
      id: draftId,
      authorName: "You",
      atMs,
      text: text.trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
      canDelete: true,
    };
    setNotes((current) => [...current, draft].sort((a, b) => a.atMs - b.atMs));
    setText("");
    setError("");
    try {
      const saved = await addTakeNote(kind, takeId, atMs, draft.text);
      if (!saved) throw new Error("This take is no longer available.");
      setNotes((current) => current.map((note) => (note.id === draftId ? saved : note)));
    } catch (caught) {
      setNotes((current) => current.filter((note) => note.id !== draftId));
      setError(caught instanceof Error ? caught.message : "Unable to add note.");
      setText(draft.text);
    }
  }

  async function toggleResolved(note: Note) {
    const resolved = !note.resolved;
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, resolved } : item));
    try {
      await setTakeNoteResolved(note.id, resolved);
    } catch {
      setNotes((current) => current.map((item) => item.id === note.id ? { ...item, resolved: note.resolved } : item));
      setError("Unable to update note.");
    }
  }

  async function removeNote(note: Note) {
    setNotes((current) => current.filter((item) => item.id !== note.id));
    try {
      await deleteTakeNote(note.id);
    } catch {
      setNotes((current) => [...current, note].sort((a, b) => a.atMs - b.atMs));
      setError("Unable to delete note.");
    }
  }

  function seek(atMs: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = atMs / 1000;
    void audio.play().catch(() => {});
  }

  const visibleNotes = hideResolved ? notes.filter((note) => !note.resolved) : notes;
  const count = loaded ? notes.length : initialCount;

  return (
    <div className="mt-2 min-w-0 basis-full">
      <button
        type="button"
        onClick={() => void toggleOpen()}
        aria-expanded={open}
        className="min-h-10 rounded-md px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        {open ? "Hide notes" : `Notes (${count})`}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <audio ref={audioRef} controls preload="none" src={src} className="h-10 w-full" />
          {loading ? (
            <p className="text-sm text-zinc-500">Loading notes…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">Notes</h3>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={hideResolved}
                  onClick={() => setHideResolved((value) => !value)}
                  className="min-h-10 rounded-md px-2 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  {hideResolved ? "☑" : "□"} Hide resolved
                </button>
              </div>
              {visibleNotes.length ? (
                <ul className="space-y-2">
                  {visibleNotes.map((note) => (
                    <li key={note.id} className={`flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 ${note.resolved ? "opacity-60" : ""}`}>
                      <button
                        type="button"
                        onClick={() => seek(note.atMs)}
                        className="min-h-10 min-w-14 rounded-md bg-zinc-100 px-2 text-sm font-medium tabular-nums text-zinc-700"
                        aria-label={`Seek to ${formatClock(note.atMs)}`}
                      >
                        {formatClock(note.atMs)}
                      </button>
                      <div className="order-last min-w-0 basis-full">
                        <p className={`break-words text-sm text-zinc-900 ${note.resolved ? "line-through" : ""}`}>{note.text}</p>
                        <p className="mt-1 text-xs text-zinc-500">{note.authorName}</p>
                      </div>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={note.resolved}
                        aria-label={note.resolved ? "Reopen note" : "Resolve note"}
                        onClick={() => void toggleResolved(note)}
                        className="ml-auto min-h-10 min-w-10 rounded-md text-sm text-zinc-600 hover:bg-zinc-100"
                      >
                        {note.resolved ? "☑" : "□"}
                      </button>
                      {note.canDelete && (
                        <button
                          type="button"
                          onClick={() => void removeNote(note)}
                          aria-label="Delete note"
                          className="min-h-10 min-w-10 rounded-md text-lg text-zinc-500 hover:bg-zinc-100"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No notes yet.</p>
              )}
              <form onSubmit={(event) => void submitNote(event)} className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor={`take-note-time-${takeId}`}>Note time (m:ss)</label>
                <input
                  id={`take-note-time-${takeId}`}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  inputMode="numeric"
                  aria-label="Note time (m:ss)"
                  className="h-10 w-20 rounded-md border border-zinc-300 bg-white px-2 text-sm tabular-nums text-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setTime(formatClock((audioRef.current?.currentTime ?? 0) * 1000))}
                  className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700"
                >
                  Now
                </button>
                <label className="sr-only" htmlFor={`take-note-text-${takeId}`}>Note</label>
                <input
                  id={`take-note-text-${takeId}`}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={300}
                  placeholder="Add a note…"
                  className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
                />
                <button type="submit" className="min-h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white">
                  Add
                </button>
              </form>
            </>
          )}
          {error && <p role="status" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
