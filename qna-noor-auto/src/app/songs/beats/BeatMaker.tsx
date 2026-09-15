"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { attachBeatToSong, deleteBeat, renameBeat, saveBeat } from "./actions";
import { BpmInput } from "../BpmInput";
import { BeatEngine, type BeatDocument, type BeatPlaybackMode } from "./engine";
import {
  BEAT_TRACKS,
  BeatDataSchema,
  emptyPattern,
  KITS,
  MELODIC_INSTRUMENTS,
  MELODIC_LABELS,
  noteName,
  stepsFor,
  type BeatData,
  type BeatKit,
  type BeatPattern,
  type BeatTrack,
  type BeatTrackInstance,
  type MelodicInstrument,
} from "./kits";

type BeatMakerProps = {
  beat: {
    id: string;
    title: string;
    bpm: number;
    swing: number;
    kit: string;
    data: string;
    songId: string | null;
  };
  songs: Array<{ id: string; title: string }>;
};

function parseBeatData(raw: string): BeatData {
  return BeatDataSchema.parse(JSON.parse(raw));
}

function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function trackId() {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultTop(kind: MelodicInstrument) {
  return kind === "bass" ? 72 : kind === "piano" ? 71 : 64;
}

function trackKindLabel(track: BeatTrackInstance) {
  return track.kind === "drums" ? "Drums" : MELODIC_LABELS[track.kind];
}

export function BeatMaker({ beat, songs }: BeatMakerProps) {
  const initialData = parseBeatData(beat.data);
  const [title, setTitle] = useState(beat.title);
  const [bpm, setBpm] = useState(beat.bpm);
  const [swing, setSwing] = useState(beat.swing);
  const [kit, setKit] = useState<BeatKit>(
    KITS.includes(beat.kit as BeatKit) ? (beat.kit as BeatKit) : "808",
  );
  const [data, setData] = useState(initialData);
  const [selectedPatternId, setSelectedPatternId] = useState(
    initialData.patterns[0]?.id ?? "",
  );
  const [mode, setMode] = useState<BeatPlaybackMode>("pattern");
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [openTracks, setOpenTracks] = useState<Set<string>>(
    () =>
      new Set(
        initialData.tracks
          .filter((track) => track.kind === "drums" || track.kind === "bass")
          .map((track) => track.id),
      ),
  );
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(() => new Set());
  const [mutedVoices, setMutedVoices] = useState<Set<BeatTrack>>(() => new Set());
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState("");
  const [topNotes, setTopNotes] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialData.tracks
        .filter((track): track is BeatTrackInstance & { kind: MelodicInstrument } => track.kind !== "drums")
        .map((track) => [track.id, defaultTop(track.kind)]),
    ),
  );
  const [newTrackKind, setNewTrackKind] = useState<MelodicInstrument>("piano");
  const [engine] = useState(() => new BeatEngine());
  const docRef = useRef<BeatDocument>({
    title,
    bpm,
    swing,
    kit,
    data,
  });
  const modeRef = useRef(mode);
  const selectedRef = useRef(selectedPatternId);

  useEffect(() => {
    return () => {
      engine.stop();
    };
  }, [engine]);

  useEffect(() => {
    docRef.current = { title, bpm, swing, kit, data };
    modeRef.current = mode;
    selectedRef.current = selectedPatternId;
  }, [title, bpm, swing, kit, data, mode, selectedPatternId]);

  useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(async () => {
      setSaving(true);
      try {
        await saveBeat(beat.id, { bpm, swing, kit, data });
        setDirty(false);
        setSaveError(false);
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [beat.id, bpm, swing, kit, data, dirty]);

  const selectedPattern =
    data.patterns.find((pattern) => pattern.id === selectedPatternId) ?? data.patterns[0];
  const currentDocument: BeatDocument = { title, bpm, swing, kit, data };

  function markDirty() {
    setDirty(true);
  }

  function updateData(updater: (current: BeatData) => BeatData) {
    setData((current) => updater(current));
    markDirty();
  }

  function updatePattern(id: string, updater: (pattern: BeatPattern) => BeatPattern) {
    updateData((current) => ({
      ...current,
      patterns: current.patterns.map((pattern) =>
        pattern.id === id ? updater(pattern) : pattern,
      ),
    }));
  }

  function toggleDrum(trackId: string, voice: BeatTrack, step: number) {
    if (!selectedPattern) return;
    updatePattern(selectedPattern.id, (pattern) => {
      const drums = cloneData(pattern.drums);
      const steps = [...(drums[trackId]?.[voice] ?? [])];
      steps[step] = ((steps[step] + 1) % 3) as 0 | 1 | 2;
      drums[trackId] = { ...drums[trackId], [voice]: steps };
      return { ...pattern, drums };
    });
  }

  function toggleNote(trackId: string, kind: MelodicInstrument, note: number, step: number) {
    if (!selectedPattern) return;
    updatePattern(selectedPattern.id, (pattern) => {
      const notes = [...(pattern.notes[trackId] ?? [])];
      if (kind === "bass") {
        const existing = notes.find((item) => item.step === step);
        const next = notes.filter((item) => item.step !== step);
        if (!existing || existing.note !== note) next.push({ step, note, len: 1, vel: 1 });
        return { ...pattern, notes: { ...pattern.notes, [trackId]: next } };
      }
      const existingIndex = notes.findIndex(
        (item) => item.step === step && item.note === note,
      );
      if (existingIndex >= 0) notes.splice(existingIndex, 1);
      else if (notes.length < 256) notes.push({ step, note, len: 1, vel: 1 });
      return { ...pattern, notes: { ...pattern.notes, [trackId]: notes } };
    });
  }

  function toggleTrack(trackId: string) {
    setOpenTracks((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function toggleTrackMute(trackId: string) {
    const next = new Set(mutedTracks);
    const muted = next.has(trackId);
    if (muted) next.delete(trackId);
    else next.add(trackId);
    setMutedTracks(next);
    engine?.setTrackMuted(trackId, !muted);
  }

  function toggleVoiceMute(voice: BeatTrack) {
    const next = new Set(mutedVoices);
    const muted = next.has(voice);
    if (muted) next.delete(voice);
    else next.add(voice);
    setMutedVoices(next);
    engine?.setVoiceMuted(voice, !muted);
  }

  function updateTrack(trackId: string, updater: (track: BeatTrackInstance) => BeatTrackInstance) {
    updateData((current) => ({
      ...current,
      tracks: current.tracks.map((track) => (track.id === trackId ? updater(track) : track)),
    }));
  }

  function saveTrackName(trackId: string) {
    const name = editingTrackName.trim().slice(0, 40);
    if (name) updateTrack(trackId, (track) => ({ ...track, name }));
    setEditingTrackId(null);
  }

  function shiftTrack(trackId: string, direction: -1 | 1) {
    updateData((current) => {
      const index = current.tracks.findIndex((track) => track.id === trackId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.tracks.length) return current;
      const tracks = [...current.tracks];
      [tracks[index], tracks[nextIndex]] = [tracks[nextIndex], tracks[index]];
      return { ...current, tracks };
    });
  }

  function addTrack() {
    if (data.tracks.length >= 16) return;
    const label = MELODIC_LABELS[newTrackKind];
    const count = data.tracks.filter((track) => track.kind === newTrackKind).length;
    const track = {
      id: trackId(),
      kind: newTrackKind,
      name: count === 0 ? label : `${label} ${count + 1}`,
      volume: 1,
      pan: 0,
    } as const;
    updateData((current) => ({
      ...current,
      tracks: [...current.tracks, track],
      patterns: current.patterns.map((pattern) => ({
        ...pattern,
        notes: { ...pattern.notes, [track.id]: [] },
      })),
    }));
    setOpenTracks((current) => new Set(current).add(track.id));
    setTopNotes((current) => ({ ...current, [track.id]: defaultTop(newTrackKind) }));
  }

  function removeTrack(trackId: string) {
    const track = data.tracks.find((item) => item.id === trackId);
    if (!track) return;
    if (track.kind === "drums" && data.tracks.filter((item) => item.kind === "drums").length <= 1) {
      return;
    }
    if (!window.confirm(`Remove ${track.name}?`)) return;
    updateData((current) => ({
      ...current,
      tracks: current.tracks.filter((item) => item.id !== trackId),
      patterns: current.patterns.map((pattern) => {
        const drums = { ...pattern.drums };
        const notes = { ...pattern.notes };
        delete drums[trackId];
        delete notes[trackId];
        return { ...pattern, drums, notes };
      }),
    }));
    setOpenTracks((current) => {
      const next = new Set(current);
      next.delete(trackId);
      return next;
    });
  }

  function shiftTopNote(trackId: string, delta: number) {
    setTopNotes((current) => ({
      ...current,
      [trackId]: Math.max(35, Math.min(96, (current[trackId] ?? 64) + delta)),
    }));
  }

  function addPattern(duplicate = false) {
    if (data.patterns.length >= 16) return;
    const source = duplicate && selectedPattern ? cloneData(selectedPattern) : null;
    const next = source
      ? { ...source, id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: `${source.name} copy` }
      : emptyPattern(data.tracks, String.fromCharCode(65 + data.patterns.length));
    updateData((current) => ({ ...current, patterns: [...current.patterns, next] }));
    setSelectedPatternId(next.id);
  }

  function removePattern() {
    if (data.patterns.length <= 1 || !selectedPattern) return;
    const remaining = data.patterns.filter((pattern) => pattern.id !== selectedPattern.id);
    updateData((current) => ({
      ...current,
      patterns: remaining,
      chain: current.chain.filter((id) => id !== selectedPattern.id),
    }));
    setSelectedPatternId(remaining[0].id);
  }

  function renamePattern() {
    if (!selectedPattern) return;
    const name = window.prompt("Pattern name", selectedPattern.name)?.trim();
    if (!name) return;
    updatePattern(selectedPattern.id, (pattern) => ({ ...pattern, name: name.slice(0, 40) }));
  }

  function addToChain(id: string) {
    if (!id || data.chain.length >= 64) return;
    updateData((current) => ({ ...current, chain: [...current.chain, id] }));
  }

  function removeFromChain(index: number) {
    updateData((current) => ({
      ...current,
      chain: current.chain.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function togglePlayback() {
    if (!engine) return;
    if (playing) {
      engine.stop();
      setPlaying(false);
      setActiveStep(-1);
      return;
    }
    await engine.play(
      () => docRef.current,
      () => ({ mode: modeRef.current, patternId: selectedRef.current }),
      (_patternIndex, step) => setActiveStep(step),
    );
    setPlaying(true);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      void togglePlayback();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function exportWav() {
    if (!engine) return;
    const blob = await engine.renderWav(docRef.current);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.trim() || "beat"}.wav`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveCurrent() {
    setSaving(true);
    try {
      await saveBeat(beat.id, { bpm, swing, kit, data });
      setDirty(false);
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle() {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === beat.title) {
      setTitle(beat.title);
      return;
    }
    try {
      await renameBeat(beat.id, nextTitle);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  async function removeBeat() {
    if (!window.confirm(`Delete "${title.trim() || beat.title}"?`)) return;
    await deleteBeat(beat.id);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveTitle();
                event.currentTarget.blur();
              }
            }}
            className="min-w-48 flex-1 text-lg font-semibold"
            aria-label="Beat title"
          />
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-2">
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              BPM
              <BpmInput
                min={40}
                max={200}
                value={bpm}
                onCommit={(next) => {
                  setBpm(next);
                  markDirty();
                }}
                className="w-20"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Swing
              <Input
                type="range"
                min={0}
                max={60}
                value={swing}
                onChange={(event) => {
                  setSwing(Number(event.target.value));
                  markDirty();
                }}
                aria-label="Swing"
                className="w-20"
              />
              <span className="w-10 tabular-nums">{swing}%</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Kit
              <Select
                value={kit}
                onChange={(event) => {
                  setKit(event.target.value as BeatKit);
                  markDirty();
                }}
                className="w-28"
              >
                {KITS.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </label>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-zinc-50 p-2">
            <Button type="button" size="sm" onClick={() => void togglePlayback()}>
              {playing ? "Stop" : "Play"}
            </Button>
            <div className="flex overflow-hidden rounded-md border border-zinc-300">
              {(["pattern", "chain"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`px-2 py-1.5 text-xs font-medium ${mode === item ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-white text-zinc-700"}`}
                >
                  {item === "pattern" ? "Loop" : "Chain"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="secondary" onClick={() => void saveCurrent()} disabled={!dirty || saving}>Save</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => void exportWav()}>Export</Button>
            <Button type="button" size="sm" variant="danger" onClick={() => void removeBeat()}>Delete</Button>
          </div>
          <span className="text-xs text-zinc-500">
            {saveError ? "Save failed" : saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
          </span>
          {playing && <span className="text-xs text-zinc-500">No sound? Turn up the volume and flip the ringer switch off silent.</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <form action={attachBeatToSong.bind(null, beat.id)} className="flex items-center gap-2">
            <Select name="songId" defaultValue={beat.songId ?? ""} aria-label="Attach beat to song" onChange={(event) => event.currentTarget.form?.requestSubmit()} className="max-w-48 text-xs">
              <option value="">No song</option>
              {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
            </Select>
          </form>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {data.patterns.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => setSelectedPatternId(pattern.id)}
              className={`rounded-md px-3 py-2 text-xs font-medium ${selectedPattern?.id === pattern.id ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-zinc-100 text-zinc-700"}`}
            >
              {pattern.name}
            </button>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => addPattern()}>+ Pattern</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => addPattern(true)}>Duplicate</Button>
          <Button type="button" size="sm" variant="ghost" onClick={renamePattern}>Rename</Button>
          <Button type="button" size="sm" variant="ghost" onClick={removePattern}>Delete pattern</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-600">Chain</span>
          {data.chain.map((id, index) => {
            const pattern = data.patterns.find((item) => item.id === id);
            return (
              <button key={`${id}-${index}`} type="button" onClick={() => removeFromChain(index)} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                {pattern?.name ?? "?"} ×
              </button>
            );
          })}
          <Select value="" onChange={(event) => addToChain(event.target.value)} aria-label="Add pattern to chain" className="w-36 text-xs">
            <option value="">Add pattern…</option>
            {data.patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4">
          <span className="text-xs font-medium text-zinc-600">Add track</span>
          <Select value={newTrackKind} onChange={(event) => setNewTrackKind(event.target.value as MelodicInstrument)} className="w-44 text-xs">
            {MELODIC_INSTRUMENTS.map((kind) => <option key={kind} value={kind}>{MELODIC_LABELS[kind]}</option>)}
          </Select>
          <Button type="button" size="sm" variant="secondary" onClick={addTrack} disabled={data.tracks.length >= 16}>+ Add track</Button>
          <span className="text-xs text-zinc-500">{data.tracks.length}/16 tracks</span>
        </div>
      </Card>

      {selectedPattern && data.tracks.map((track, trackIndex) => {
        const isOpen = openTracks.has(track.id);
        const stepCount = stepsFor(selectedPattern);
        const hitCount = track.kind === "drums"
          ? Object.values(selectedPattern.drums[track.id] ?? {}).reduce(
              (count, steps) => count + steps.filter((value) => value > 0).length,
              0,
            )
          : (selectedPattern.notes[track.id] ?? []).length;
        const top = track.kind === "drums" ? 0 : topNotes[track.id] ?? defaultTop(track.kind);
        return (
          <Card key={track.id} className="overflow-hidden p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button type="button" onClick={() => toggleTrack(track.id)} className="shrink-0 text-zinc-500" aria-label={`${isOpen ? "Collapse" : "Expand"} ${track.name}`}>
                  {isOpen ? "▾" : "▸"}
                </button>
                {editingTrackId === track.id ? (
                  <Input
                    autoFocus
                    value={editingTrackName}
                    maxLength={40}
                    onChange={(event) => setEditingTrackName(event.target.value)}
                    onBlur={() => saveTrackName(track.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        saveTrackName(track.id);
                      }
                    }}
                    className="h-8 max-w-48 text-sm"
                    aria-label={`Name ${track.name}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTrackId(track.id);
                      setEditingTrackName(track.name);
                    }}
                    className="truncate text-left text-sm font-semibold text-zinc-900 hover:underline"
                  >
                    {track.name}
                  </button>
                )}
                <span className="text-xs text-zinc-500">{trackKindLabel(track)}</span>
                <span className="text-xs text-zinc-500">{hitCount} {track.kind === "drums" ? "hits" : "notes"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => toggleTrackMute(track.id)} className={`rounded px-2 py-1 text-[10px] ${mutedTracks.has(track.id) ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-500"}`}>
                  {mutedTracks.has(track.id) ? "Muted" : "Mute"}
                </button>
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Vol
                  <input type="range" min={0} max={150} value={Math.round(track.volume * 100)} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, volume: Number(event.target.value) / 100 }))} className="w-20" aria-label={`${track.name} volume`} />
                  <span className="w-8 tabular-nums">{Math.round(track.volume * 100)}%</span>
                </label>
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Pan
                  <input type="range" min={-100} max={100} value={Math.round(track.pan * 100)} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, pan: Number(event.target.value) / 100 }))} className="w-16" aria-label={`${track.name} pan`} />
                  <span className="w-5 text-center">{track.pan < -0.01 ? "L" : track.pan > 0.01 ? "R" : "C"}</span>
                </label>
                <button type="button" onClick={() => shiftTrack(track.id, -1)} disabled={trackIndex === 0} className="rounded bg-zinc-100 px-1.5 py-1 text-xs disabled:opacity-40" aria-label={`Move ${track.name} up`}>▲</button>
                <button type="button" onClick={() => shiftTrack(track.id, 1)} disabled={trackIndex === data.tracks.length - 1} className="rounded bg-zinc-100 px-1.5 py-1 text-xs disabled:opacity-40" aria-label={`Move ${track.name} down`}>▼</button>
                <button type="button" onClick={() => removeTrack(track.id)} disabled={track.kind === "drums" && data.tracks.filter((item) => item.kind === "drums").length <= 1} className="rounded px-2 py-1 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-40">Remove</button>
                {track.kind !== "drums" && (
                  <>
                    <span className="text-[10px] text-zinc-500">Top {noteName(top)}</span>
                    <button type="button" onClick={() => shiftTopNote(track.id, -12)} className="rounded bg-zinc-100 px-1.5 py-1 text-xs" aria-label={`Lower ${track.name} octave`}>−</button>
                    <button type="button" onClick={() => shiftTopNote(track.id, 12)} className="rounded bg-zinc-100 px-1.5 py-1 text-xs" aria-label={`Raise ${track.name} octave`}>+</button>
                  </>
                )}
              </div>
            </div>
            {isOpen && (
              <div className="mt-4 overflow-x-auto">
                <div style={{ minWidth: `${stepCount * 2.75 + 8}rem` }} className="space-y-1">
                  <div className={`grid gap-1 pb-2 ${track.kind === "drums" ? "grid-cols-[8rem_repeat(1,minmax(2.2rem,1fr))]" : "grid-cols-[4.5rem_repeat(1,minmax(2.2rem,1fr))]"}`}>
                    <span />
                    <div className="grid grid-cols-[repeat(var(--steps),minmax(2.2rem,1fr))] gap-1" style={{ "--steps": stepCount } as CSSProperties}>
                      {Array.from({ length: stepCount }, (_, step) => <span key={step} className={`text-center text-[10px] text-zinc-400 ${step % 4 === 0 ? "border-l border-zinc-300" : ""}`}>{step + 1}</span>)}
                    </div>
                  </div>
                  {track.kind === "drums" ? (
                    BEAT_TRACKS.map((voice) => (
                      <div key={voice} className="grid grid-cols-[8rem_1fr] gap-1 py-1">
                        <div className="sticky left-0 z-10 flex items-center gap-1 bg-white pr-2">
                          <button type="button" onClick={() => void engine.preview(currentDocument, voice)} className="min-w-0 flex-1 truncate text-left text-xs font-medium capitalize text-zinc-700 hover:text-zinc-950">{voice}</button>
                          <button type="button" onClick={() => toggleVoiceMute(voice)} className={`rounded px-1.5 py-1 text-[10px] ${mutedVoices.has(voice) ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-500"}`}>{mutedVoices.has(voice) ? "M" : "mute"}</button>
                        </div>
                        <div className="grid grid-cols-[repeat(var(--steps),minmax(2.2rem,1fr))] gap-1" style={{ "--steps": stepCount } as CSSProperties}>
                          {Array.from({ length: stepCount }, (_, step) => {
                            const value = selectedPattern.drums[track.id]?.[voice]?.[step] ?? 0;
                            return (
                              <button key={step} type="button" onClick={() => toggleDrum(track.id, voice, step)} className={`relative h-9 rounded ${step % 4 === 0 ? "border-l-2 border-zinc-300" : ""} ${activeStep === step ? "ring-2 ring-[var(--vx-accent-600)] ring-offset-1" : ""} ${value === 2 ? "bg-[var(--vx-accent-700)] ring-2 ring-[var(--vx-accent-700)] ring-inset" : value === 1 ? "bg-[var(--vx-accent-600)]" : "bg-zinc-100 hover:bg-zinc-200"}`} aria-label={`${track.name} ${voice} step ${step + 1}`}>
                                {value === 2 && <span aria-hidden="true" className="absolute inset-1 rounded-full border border-[var(--vx-accent-fg)]/70" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    Array.from({ length: 12 }, (_, row) => top - row).map((note) => (
                      <div key={note} className="grid grid-cols-[4.5rem_1fr] gap-1">
                        <button type="button" onClick={() => void engine.previewNote(currentDocument, track.kind as MelodicInstrument, note)} className="sticky left-0 z-10 truncate bg-white pr-2 text-left text-[10px] text-zinc-500 hover:text-zinc-950" title={`Play ${noteName(note)}`}>{noteName(note)}</button>
                        <div className="grid grid-cols-[repeat(var(--steps),minmax(2.2rem,1fr))] gap-1" style={{ "--steps": stepCount } as CSSProperties}>
                          {Array.from({ length: stepCount }, (_, step) => {
                            const active = (selectedPattern.notes[track.id] ?? []).some((item) => item.step === step && item.note === note);
                            return (
                              <button key={step} type="button" onClick={() => toggleNote(track.id, track.kind as MelodicInstrument, note, step)} className={`relative h-6 rounded ${step % 4 === 0 ? "border-l-2 border-zinc-300" : ""} ${activeStep === step ? "ring-2 ring-[var(--vx-accent-600)] ring-offset-1" : ""} ${active ? "bg-[var(--vx-accent-600)]" : "bg-zinc-100 hover:bg-zinc-200"}`} aria-label={`${track.name} ${noteName(note)} step ${step + 1}`} />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
