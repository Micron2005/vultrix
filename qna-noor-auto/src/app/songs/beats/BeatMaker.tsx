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
  SECTION_LABELS,
  sectionSequence,
  stepsFor,
  type BeatData,
  type BeatKit,
  type BeatPattern,
  type BeatScale,
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

const SCALE_INTERVALS: Record<BeatScale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteInKey(note: number, key: { root: number; scale: BeatScale } | undefined) {
  if (!key) return true;
  return SCALE_INTERVALS[key.scale].includes((note - key.root + 120) % 12);
}

function chordNotes(root: number, key: { root: number; scale: BeatScale } | undefined) {
  const intervals = SCALE_INTERVALS[key?.scale ?? "major"];
  const rootPitch = key ? key.root : root % 12;
  const degree = intervals.findIndex((interval) => interval === (root % 12 - rootPitch + 12) % 12);
  const index = degree >= 0 ? degree : 0;
  const pitches = [index, index + 2, index + 4].map((offset) => {
    const octave = Math.floor(offset / intervals.length);
    return root + intervals[offset % intervals.length] - intervals[index] + octave * 12;
  });
  return [...new Set(pitches)].filter((pitch) => pitch >= 24 && pitch <= 96);
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
  const [arrangementPatternId, setArrangementPatternId] = useState(
    initialData.patterns[0]?.id ?? "",
  );
  const [mode, setMode] = useState<BeatPlaybackMode>("pattern");
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(-1);
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
  const [velocityModes, setVelocityModes] = useState<Set<string>>(() => new Set());
  const [chordModes, setChordModes] = useState<Set<string>>(() => new Set());
  const [snapToKey, setSnapToKey] = useState(false);
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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const dragNoteRef = useRef<{ trackId: string; note: number; step: number; dragged: boolean } | null>(null);
  const didDragRef = useRef(false);
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

  useEffect(() => {
    const endInteraction = () => {
      dragNoteRef.current = null;
    };
    window.addEventListener("pointerup", endInteraction);
    window.addEventListener("pointercancel", endInteraction);
    return () => {
      window.removeEventListener("pointerup", endInteraction);
      window.removeEventListener("pointercancel", endInteraction);
    };
  }, []);

  const selectedPattern =
    data.patterns.find((pattern) => pattern.id === selectedPatternId) ?? data.patterns[0];
  const currentDocument: BeatDocument = { title, bpm, swing, kit, data };
  const arrangementSequence = sectionSequence(data);

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

  function resizeSelectedPattern(bars: 1 | 2 | 4) {
    if (!selectedPattern || selectedPattern.bars === bars) return;
    const length = bars * 16;
    updatePattern(selectedPattern.id, (pattern) => ({
      ...pattern,
      bars,
      drums: Object.fromEntries(
        Object.entries(pattern.drums).map(([trackId, voices]) => [
          trackId,
          Object.fromEntries(
            Object.entries(voices).map(([voice, steps]) => [
              voice,
              [...steps.slice(0, length), ...Array(Math.max(0, length - steps.length)).fill(0)],
            ]),
          ),
        ]),
      ) as BeatPattern["drums"],
      notes: Object.fromEntries(
        Object.entries(pattern.notes).map(([trackId, notes]) => [
          trackId,
          notes
            .filter((item) => item.step < length)
            .map((item) => ({ ...item, len: Math.min(item.len, length - item.step) })),
        ]),
      ),
    }));
  }

  function updateNote(
    trackId: string,
    kind: MelodicInstrument,
    note: number,
    step: number,
    action: "toggle" | "length" | "velocity",
    length?: number,
  ) {
    if (!selectedPattern) return;
    updatePattern(selectedPattern.id, (pattern) => {
      const notes = [...(pattern.notes[trackId] ?? [])];
      const existing = notes.find(
        (item) => item.note === note && item.step <= step && step < item.step + item.len,
      );
      if (action === "length" && existing) {
        const nextLength = Math.max(1, Math.min(length ?? 1, stepsFor(pattern) - existing.step));
        return {
          ...pattern,
          notes: {
            ...pattern.notes,
            [trackId]: notes.map((item) => (item === existing ? { ...item, len: nextLength } : item)),
          },
        };
      }
      if (action === "velocity" && existing) {
        const velocity = existing.vel < 0.8 ? 1 : existing.vel < 1.15 ? 1.3 : 0.6;
        return {
          ...pattern,
          notes: {
            ...pattern.notes,
            [trackId]: notes.map((item) => (item === existing ? { ...item, vel: velocity } : item)),
          },
        };
      }
      if (existing && action === "toggle") {
        const next = notes.filter((item) => item !== existing);
        if (chordModes.has(trackId) && kind !== "bass") {
          const chord = chordNotes(existing.note, data.key);
          const isRoot = existing.note === Math.min(
            ...notes.filter((item) => item.step === existing.step).map((item) => item.note),
          );
          return {
            ...pattern,
            notes: {
              ...pattern.notes,
              [trackId]: isRoot
                ? next.filter((item) => !(item.step === existing.step && chord.includes(item.note)))
                : next,
            },
          };
        }
        return { ...pattern, notes: { ...pattern.notes, [trackId]: next } };
      }
      if (action !== "toggle") return { ...pattern, notes: { ...pattern.notes, [trackId]: notes } };
      if (kind === "bass" || kind === "lead") {
        const existing = notes.find((item) => item.step === step);
        const next = notes.filter((item) => item.step !== step);
        if (!existing || existing.note !== note) next.push({ step, note, len: 1, vel: 1 });
        return { ...pattern, notes: { ...pattern.notes, [trackId]: next } };
      }
      if (chordModes.has(trackId)) {
        const chord = chordNotes(note, data.key);
        if (notes.length + chord.length <= 256) {
          for (const chordNote of chord) {
            notes.push({ step, note: chordNote, len: 1, vel: 1 });
          }
        }
      } else if (notes.length < 256) {
        notes.push({ step, note, len: 1, vel: 1 });
      }
      return { ...pattern, notes: { ...pattern.notes, [trackId]: notes } };
    });
  }

  function beginNoteInteraction(
    trackId: string,
    kind: MelodicInstrument,
    note: number,
    step: number,
  ) {
    const existing = selectedPattern?.notes[trackId]?.find(
      (item) => item.note === note && item.step <= step && step < item.step + item.len,
    );
    didDragRef.current = false;
    dragNoteRef.current = { trackId, note: existing?.note ?? note, step: existing?.step ?? step, dragged: false };
    if (!existing) {
      updateNote(trackId, kind, note, step, "toggle");
      didDragRef.current = true;
    }
  }

  function extendNote(trackId: string, kind: MelodicInstrument, note: number, step: number) {
    const drag = dragNoteRef.current;
    if (!drag || drag.trackId !== trackId || drag.note !== note || step < drag.step) return;
    drag.dragged = true;
    didDragRef.current = true;
    updateNote(trackId, kind, note, drag.step, "length", step - drag.step + 1);
  }

  function endNoteInteraction() {
    dragNoteRef.current = null;
  }

  function toggleNote(trackId: string, kind: MelodicInstrument, note: number, step: number) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    updateNote(trackId, kind, note, step, "toggle");
  }

  function updateKey(root: number, scale: BeatScale) {
    updateData((current) => ({ ...current, key: { root, scale } }));
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
      reverb: 0,
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
      sections: current.sections.map((section) => ({
        ...section,
        mutedTracks: section.mutedTracks.filter((id) => id !== trackId),
      })),
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
      sections: current.sections.filter((section) => section.patternId !== selectedPattern.id),
    }));
    setSelectedPatternId(remaining[0].id);
    setArrangementPatternId((current) =>
      current === selectedPattern.id ? remaining[0].id : current,
    );
  }

  function renamePattern() {
    if (!selectedPattern) return;
    const name = window.prompt("Pattern name", selectedPattern.name)?.trim();
    if (!name) return;
    updatePattern(selectedPattern.id, (pattern) => ({ ...pattern, name: name.slice(0, 40) }));
  }

  function updateSection(sectionId: string, updater: (section: BeatData["sections"][number]) => BeatData["sections"][number]) {
    updateData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? updater(section) : section,
      ),
    }));
  }

  function nextSectionName(sections: BeatData["sections"]) {
    return SECTION_LABELS.find((label) => !sections.some((section) => section.name === label)) ?? "Custom";
  }

  function addSection(patternId: string) {
    if (!patternId || data.sections.length >= 64) return;
    updateData((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: `s${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: nextSectionName(current.sections),
          patternId,
          repeats: 1,
          mutedTracks: [],
        },
      ],
    }));
  }

  function removeSection(sectionId: string) {
    updateData((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId),
    }));
  }

  function duplicateSection(sectionId: string) {
    if (data.sections.length >= 64) return;
    updateData((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      if (index < 0) return current;
      const source = current.sections[index];
      const copy = {
        ...source,
        id: `s${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      };
      const sections = [...current.sections];
      sections.splice(index + 1, 0, copy);
      return { ...current, sections };
    });
  }

  function reorderSection(sectionId: string, direction: -1 | 1) {
    updateData((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
      return { ...current, sections };
    });
  }

  function toggleSectionTrack(sectionId: string, trackId: string) {
    updateSection(sectionId, (section) => ({
      ...section,
      mutedTracks: section.mutedTracks.includes(trackId)
        ? section.mutedTracks.filter((id) => id !== trackId)
        : [...section.mutedTracks, trackId],
    }));
  }

  function sectionDurationBars() {
    return data.sections.reduce((total, section) => {
      const pattern = data.patterns.find((item) => item.id === section.patternId);
      return total + (pattern?.bars ?? 0) * section.repeats;
    }, 0);
  }

  async function togglePlayback() {
    if (!engine) return;
    if (playing) {
      engine.stop();
      setPlaying(false);
      setActiveStep(-1);
      setActiveSequenceIndex(-1);
      return;
    }
    await engine.play(
      () => docRef.current,
      () => ({ mode: modeRef.current, patternId: selectedRef.current }),
      (sequenceIndex, step) => {
        setActiveStep(step);
        if (modeRef.current !== "song") {
          setActiveSequenceIndex(-1);
          return;
        }
        const sequence = sectionSequence(docRef.current.data);
        if (!sequence.length) return;
        const item = sequence[sequenceIndex % sequence.length];
        setActiveSequenceIndex(sequenceIndex % sequence.length);
        if (item && item.pattern.id !== selectedRef.current) {
          setSelectedPatternId(item.pattern.id);
        }
      },
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
    const blob = await engine.renderWav(docRef.current, selectedRef.current);
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
              {(["pattern", "song"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`px-2 py-1.5 text-xs font-medium ${mode === item ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-white text-zinc-700"}`}
                >
                  {item === "pattern" ? "Loop" : "Song"}
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
          <span className="text-xs font-medium text-zinc-600">Bars</span>
          <div className="flex overflow-hidden rounded-md border border-zinc-300">
            {([1, 2, 4] as const).map((bars) => (
              <button
                key={bars}
                type="button"
                onClick={() => resizeSelectedPattern(bars)}
                className={`px-2.5 py-1.5 text-xs font-medium ${selectedPattern?.bars === bars ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-white text-zinc-700"}`}
              >
                {bars}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs text-zinc-600">
            Key
            <Select
              value={data.key ? String(data.key.root) : ""}
              onChange={(event) => {
                if (!event.target.value) {
                  setSnapToKey(false);
                  updateData((current) => ({ ...current, key: undefined }));
                  return;
                }
                updateKey(Number(event.target.value), data.key?.scale ?? "major");
              }}
              className="w-20 text-xs"
            >
              <option value="">—</option>
              {KEY_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-1 text-xs text-zinc-600">
            Scale
            <Select
              value={data.key?.scale ?? "major"}
              onChange={(event) => updateKey(data.key?.root ?? 0, event.target.value as BeatScale)}
              className="w-32 text-xs"
            >
              {Object.keys(SCALE_INTERVALS).map((scale) => <option key={scale} value={scale}>{scale}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-1 text-xs text-zinc-600">
            <input type="checkbox" checked={snapToKey} disabled={!data.key} onChange={(event) => setSnapToKey(event.target.checked)} />
            Snap to key
          </label>
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

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">Arrangement</span>
          <Select
            value={arrangementPatternId}
            onChange={(event) => setArrangementPatternId(event.target.value)}
            className="w-44 text-xs"
            aria-label="Pattern for new section"
          >
            {data.patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name}</option>)}
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => addSection(arrangementPatternId)}
          >
            Add section
          </Button>
          <span className="text-xs text-zinc-500">
            {sectionDurationBars()} bars · {Math.floor(sectionDurationBars() * 4 * 60 / bpm / 60)}:{String(Math.floor(sectionDurationBars() * 4 * 60 / bpm) % 60).padStart(2, "0")} at {bpm} BPM
          </span>
        </div>
        {data.sections.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No sections yet — add your patterns in order (Intro, Verse, Hook…) to build the full song.</p>
        ) : (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {data.sections.map((section, sectionIndex) => {
              const pattern = data.patterns.find((item) => item.id === section.patternId);
              const active = arrangementSequence[activeSequenceIndex]?.sectionIndex === sectionIndex;
              return (
                <div
                  key={section.id}
                  className={`min-w-[5.5rem] rounded-lg border bg-zinc-50 p-3 ${active ? "ring-2 ring-[var(--vx-accent-600)]" : "border-zinc-200"}`}
                  style={{ width: `${Math.max(5.5, (pattern?.bars ?? 1) * section.repeats * 2.5)}rem` }}
                >
                  <div className="flex items-center gap-1">
                    {editingSectionId === section.id ? (
                      <Input
                        autoFocus
                        defaultValue={section.name}
                        list="beat-section-labels"
                        maxLength={40}
                        onBlur={(event) => {
                          const name = event.target.value.trim();
                          if (name) updateSection(section.id, (current) => ({ ...current, name }));
                          setEditingSectionId(null);
                        }}
                        className="h-7 min-w-0 flex-1 text-xs"
                      />
                    ) : (
                      <button type="button" onClick={() => setEditingSectionId(section.id)} className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-zinc-900 hover:underline">
                        {section.name}
                      </button>
                    )}
                    <button type="button" onClick={() => reorderSection(section.id, -1)} className="rounded bg-white px-1.5 py-1 text-xs" aria-label="Move section left">◀</button>
                    <button type="button" onClick={() => reorderSection(section.id, 1)} className="rounded bg-white px-1.5 py-1 text-xs" aria-label="Move section right">▶</button>
                    <button type="button" onClick={() => duplicateSection(section.id)} className="rounded bg-white px-1.5 py-1 text-[10px]">Duplicate</button>
                    <button type="button" onClick={() => removeSection(section.id)} className="rounded px-1.5 py-1 text-xs text-red-700" aria-label="Remove section">×</button>
                  </div>
                  <Select
                    value={section.patternId}
                    onClick={() => setSelectedPatternId(section.patternId)}
                    onChange={(event) => {
                      setSelectedPatternId(event.target.value);
                      updateSection(section.id, (current) => ({ ...current, patternId: event.target.value }));
                    }}
                    className="mt-2 w-full text-xs"
                    aria-label={`${section.name} pattern`}
                  >
                    {data.patterns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </Select>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                    Repeats
                    <button type="button" onClick={() => updateSection(section.id, (current) => ({ ...current, repeats: Math.max(1, current.repeats - 1) }))} className="rounded bg-white px-2 py-1">−</button>
                    <span className="tabular-nums">×{section.repeats}</span>
                    <button type="button" onClick={() => updateSection(section.id, (current) => ({ ...current, repeats: Math.min(32, current.repeats + 1) }))} className="rounded bg-white px-2 py-1">+</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.tracks.map((track) => {
                      const muted = section.mutedTracks.includes(track.id);
                      return (
                        <button
                          key={track.id}
                          type="button"
                          title={`${muted ? "Unmute" : "Mute"} ${track.name}`}
                          onClick={() => toggleSectionTrack(section.id, track.id)}
                          className={`rounded px-1.5 py-1 text-[10px] ${muted ? "text-zinc-400 line-through" : "bg-white text-zinc-600"}`}
                        >
                          {track.name.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <datalist id="beat-section-labels">
          {SECTION_LABELS.map((label) => <option key={label} value={label} />)}
        </datalist>
      </Card>

      {/* eslint-disable-next-line react-hooks/refs */}
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
                <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                  Reverb
                  <input type="range" min={0} max={100} value={Math.round(track.reverb * 100)} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, reverb: Number(event.target.value) / 100 }))} className="w-16" aria-label={`${track.name} reverb`} />
                  <span className="w-8 tabular-nums">{Math.round(track.reverb * 100)}%</span>
                </label>
                {track.kind !== "drums" && (
                  <>
                    <button type="button" onClick={() => setVelocityModes((current) => {
                      const next = new Set(current);
                      if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
                      return next;
                    })} className={`rounded px-2 py-1 text-[10px] ${velocityModes.has(track.id) ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-zinc-100 text-zinc-500"}`}>Vel</button>
                    {["piano", "eguitar", "aguitar"].includes(track.kind) && (
                      <button type="button" onClick={() => setChordModes((current) => {
                        const next = new Set(current);
                        if (next.has(track.id)) next.delete(track.id); else next.add(track.id);
                        return next;
                      })} className={`rounded px-2 py-1 text-[10px] ${chordModes.has(track.id) ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-zinc-100 text-zinc-500"}`}>Chords</button>
                    )}
                  </>
                )}
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
                  <div className={`grid gap-1 ${track.kind === "drums" ? "grid-cols-[8rem_repeat(1,minmax(2.2rem,1fr))]" : "grid-cols-[4.5rem_repeat(1,minmax(2.2rem,1fr))]"}`}>
                    <span className="text-right text-[10px] text-zinc-400">Bars</span>
                    <div className="grid grid-cols-[repeat(var(--bars),minmax(2.2rem,1fr))] gap-1" style={{ "--bars": selectedPattern.bars } as CSSProperties}>
                      {Array.from({ length: selectedPattern.bars }, (_, bar) => <span key={bar} className="text-center text-[10px] text-zinc-400">{bar + 1}</span>)}
                    </div>
                  </div>
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
                        <button type="button" onClick={() => void engine.previewNote(currentDocument, track.kind as MelodicInstrument, note)} className={`sticky left-0 z-10 truncate bg-white pr-2 text-left text-[10px] text-zinc-500 hover:text-zinc-950 ${snapToKey && !noteInKey(note, data.key) ? "opacity-40" : ""}`} title={`Play ${noteName(note)}`}>{noteName(note)}</button>
                        <div className="grid grid-cols-[repeat(var(--steps),minmax(2.2rem,1fr))] gap-1" style={{ "--steps": stepCount } as CSSProperties}>
                          {Array.from({ length: stepCount }, (_, step) => {
                            const noteItem = (selectedPattern.notes[track.id] ?? []).find((item) => item.note === note && item.step <= step && step < item.step + item.len);
                            const active = Boolean(noteItem);
                            const isNoteStart = noteItem?.step === step;
                            const velocity = noteItem?.vel ?? 1;
                            return (
                              <button
                                key={step}
                                type="button"
                                disabled={Boolean(noteItem && !isNoteStart)}
                                onPointerDown={(event) => {
                                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                                  beginNoteInteraction(track.id, track.kind as MelodicInstrument, note, step);
                                }}
                                onPointerEnter={() => extendNote(track.id, track.kind as MelodicInstrument, note, step)}
                                onPointerUp={endNoteInteraction}
                                onClick={() => {
                                  if (velocityModes.has(track.id) && noteItem) updateNote(track.id, track.kind as MelodicInstrument, note, step, "velocity");
                                  else toggleNote(track.id, track.kind as MelodicInstrument, note, step);
                                }}
                                className={`relative h-6 touch-none rounded ${step % 4 === 0 ? "border-l-2 border-zinc-300" : ""} ${activeStep === step ? "ring-2 ring-[var(--vx-accent-600)] ring-offset-1" : ""} ${active ? "bg-[var(--vx-accent-600)]" : "bg-zinc-100 hover:bg-zinc-200"} ${snapToKey && !noteInKey(note, data.key) ? "opacity-40" : ""}`}
                                style={active ? { opacity: (0.45 + velocity / 2) * (snapToKey && !noteInKey(note, data.key) ? 0.55 : 1) } : undefined}
                                aria-label={`${track.name} ${noteName(note)} step ${step + 1}${noteItem ? ` length ${noteItem.len}` : ""}`}
                              />
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
