"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { attachBeatToSong, deleteBeat, renameBeat, saveBeat } from "./actions";
import { BeatEngine, type BeatPlaybackMode } from "./engine";
import {
  BEAT_TRACKS,
  BeatDataSchema,
  KITS,
  type BeatData,
  type BeatKit,
  type BeatPattern,
  type BeatTrack,
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

function cloneData(data: BeatData): BeatData {
  return JSON.parse(JSON.stringify(data)) as BeatData;
}

function patternId() {
  return `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function BeatMaker({ beat, songs }: BeatMakerProps) {
  const [title, setTitle] = useState(beat.title);
  const [bpm, setBpm] = useState(beat.bpm);
  const [swing, setSwing] = useState(beat.swing);
  const [kit, setKit] = useState<BeatKit>(
    KITS.includes(beat.kit as BeatKit) ? (beat.kit as BeatKit) : "808",
  );
  const [data, setData] = useState(() => parseBeatData(beat.data));
  const [selectedPatternId, setSelectedPatternId] = useState(
    () => parseBeatData(beat.data).patterns[0]?.id ?? "",
  );
  const [mode, setMode] = useState<BeatPlaybackMode>("pattern");
  const [playing, setPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [bassOpen, setBassOpen] = useState(true);
  const [muted, setMuted] = useState<Set<BeatTrack>>(() => new Set());
  const engineRef = useRef<BeatEngine | null>(null);

  if (!engineRef.current) engineRef.current = new BeatEngine();

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" || event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      void togglePlayback();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const selectedPattern =
    data.patterns.find((pattern) => pattern.id === selectedPatternId) ?? data.patterns[0];

  function markDirty() {
    setDirty(true);
  }

  function updatePattern(id: string, updater: (pattern: BeatPattern) => BeatPattern) {
    setData((current) => ({
      ...current,
      patterns: current.patterns.map((pattern) =>
        pattern.id === id ? updater(pattern) : pattern,
      ),
    }));
    markDirty();
  }

  function toggleStep(track: BeatTrack, step: number) {
    if (!selectedPattern) return;
    updatePattern(selectedPattern.id, (pattern) => {
      const steps = { ...pattern.steps, [track]: [...pattern.steps[track]] };
      steps[track][step] = ((steps[track][step] + 1) % 3) as 0 | 1 | 2;
      return { ...pattern, steps };
    });
  }

  function toggleBassNote(note: number, step: number) {
    setData((current) => {
      const existing = current.bass.notes.find((item) => item.step === step);
      const notes = current.bass.notes.filter((item) => item.step !== step);
      if (!existing || existing.note !== note) notes.push({ step, note, len: 1 });
      return { ...current, bass: { notes } };
    });
    markDirty();
  }

  function addPattern(duplicate = false) {
    if (data.patterns.length >= 16) return;
    const source = duplicate && selectedPattern ? selectedPattern : null;
    const next: BeatPattern = source
      ? { ...cloneData({ v: 1, patterns: [source], chain: [], bass: { notes: [] } }).patterns[0], id: patternId(), name: `${source.name} copy` }
      : {
          id: patternId(),
          name: String.fromCharCode(65 + data.patterns.length),
          steps: Object.fromEntries(
            BEAT_TRACKS.map((track) => [track, Array.from({ length: 16 }, () => 0)]),
          ) as BeatPattern["steps"],
        };
    setData((current) => ({ ...current, patterns: [...current.patterns, next] }));
    setSelectedPatternId(next.id);
    markDirty();
  }

  function removePattern() {
    if (data.patterns.length <= 1 || !selectedPattern) return;
    const remaining = data.patterns.filter((pattern) => pattern.id !== selectedPattern.id);
    setData((current) => ({
      ...current,
      patterns: remaining,
      chain: current.chain.filter((id) => id !== selectedPattern.id),
    }));
    setSelectedPatternId(remaining[0].id);
    markDirty();
  }

  function renamePattern() {
    if (!selectedPattern) return;
    const name = window.prompt("Pattern name", selectedPattern.name)?.trim();
    if (!name) return;
    updatePattern(selectedPattern.id, (pattern) => ({ ...pattern, name: name.slice(0, 40) }));
  }

  function addToChain(id: string) {
    if (!id || data.chain.length >= 64) return;
    setData((current) => ({ ...current, chain: [...current.chain, id] }));
    markDirty();
  }

  function removeFromChain(index: number) {
    setData((current) => ({
      ...current,
      chain: current.chain.filter((_, itemIndex) => itemIndex !== index),
    }));
    markDirty();
  }

  async function togglePlayback() {
    if (!engineRef.current) return;
    if (playing) {
      engineRef.current.stop();
      setPlaying(false);
      setActiveStep(-1);
      return;
    }
    await engineRef.current.play(
      { title, bpm, swing, kit, data },
      mode,
      selectedPattern?.id ?? "",
      (_patternIndex, step) => setActiveStep(step),
    );
    setPlaying(true);
  }

  async function exportWav() {
    if (!engineRef.current) return;
    const blob = await engineRef.current.renderWav({ title, bpm, swing, kit, data });
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

  function toggleMute(track: BeatTrack) {
    const next = new Set(muted);
    const isMuted = next.has(track);
    if (isMuted) next.delete(track);
    else next.add(track);
    setMuted(next);
    engineRef.current?.setTrackMuted(track, !isMuted);
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
              <Input
                type="number"
                min={40}
                max={200}
                value={bpm}
                onChange={(event) => {
                  setBpm(Math.min(200, Math.max(40, Number(event.target.value))));
                  markDirty();
                }}
                className="w-20"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Swing
              <Input type="range" min={0} max={60} value={swing} onChange={(event) => { setSwing(Number(event.target.value)); markDirty(); }} aria-label="Swing" className="w-20" />
              <span className="w-10 tabular-nums">{swing}%</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Kit
              <Select value={kit} onChange={(event) => { setKit(event.target.value as BeatKit); markDirty(); }} className="w-28">
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
                <button key={item} type="button" onClick={() => setMode(item)} className={`px-2 py-1.5 text-xs font-medium ${mode === item ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-white text-zinc-700"}`}>
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
            <button key={pattern.id} type="button" onClick={() => setSelectedPatternId(pattern.id)} className={`rounded-md px-3 py-2 text-xs font-medium ${selectedPattern?.id === pattern.id ? "bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)]" : "bg-zinc-100 text-zinc-700"}`}>
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
      </Card>

      <Card className="overflow-hidden p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[8rem_repeat(16,minmax(2.2rem,1fr))] gap-1 pb-2">
              <span />
              {Array.from({ length: 16 }, (_, step) => <span key={step} className={`text-center text-[10px] text-zinc-400 ${step % 4 === 0 ? "border-l border-zinc-300" : ""}`}>{step + 1}</span>)}
            </div>
            {selectedPattern && BEAT_TRACKS.map((track) => (
              <div key={track} className="grid grid-cols-[8rem_repeat(16,minmax(2.2rem,1fr))] gap-1 py-1">
                <div className="sticky left-0 z-10 flex items-center gap-1 bg-white pr-2">
                  <button type="button" onClick={() => void engineRef.current?.preview({ title, bpm, swing, kit, data }, track)} className="min-w-0 flex-1 truncate text-left text-xs font-medium capitalize text-zinc-700 hover:text-zinc-950">{track}</button>
                  <button type="button" onClick={() => toggleMute(track)} className={`rounded px-1.5 py-1 text-[10px] ${muted.has(track) ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-500"}`}>{muted.has(track) ? "M" : "mute"}</button>
                </div>
                {selectedPattern.steps[track].map((value, step) => (
                  <button key={step} type="button" onClick={() => toggleStep(track, step)} className={`relative h-9 rounded ${step % 4 === 0 ? "border-l-2 border-zinc-300" : ""} ${activeStep === step ? "ring-2 ring-[var(--vx-accent-600)] ring-offset-1" : ""} ${value === 2 ? "bg-[var(--vx-accent-700)] ring-2 ring-[var(--vx-accent-700)] ring-inset" : value === 1 ? "bg-[var(--vx-accent-600)]" : "bg-zinc-100 hover:bg-zinc-200"}`} aria-label={`${track} step ${step + 1}`}>
                    {value === 2 && <span aria-hidden="true" className="absolute inset-1 rounded-full border border-[var(--vx-accent-fg)]/70" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <button type="button" onClick={() => setBassOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
          <span className="text-sm font-semibold text-zinc-900">Bass</span>
          <span className="text-xs text-zinc-500">{bassOpen ? "Collapse" : "Expand"}</span>
        </button>
        {bassOpen && (
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[760px] space-y-1">
              {Array.from({ length: 12 }, (_, row) => 72 - row).map((note) => (
                <div key={note} className="grid grid-cols-[3rem_repeat(16,minmax(2.2rem,1fr))] gap-1">
                  <span className="self-center text-[10px] text-zinc-500">MIDI {note}</span>
                  {Array.from({ length: 16 }, (_, step) => {
                    const active = data.bass.notes.find((item) => item.step === step)?.note === note;
                    return <button key={step} type="button" onClick={() => toggleBassNote(note, step)} className={`h-6 rounded ${step % 4 === 0 ? "border-l-2 border-zinc-300" : ""} ${active ? "bg-[var(--vx-accent-600)]" : "bg-zinc-100 hover:bg-zinc-200"}`} aria-label={`Bass MIDI ${note} step ${step + 1}`} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
