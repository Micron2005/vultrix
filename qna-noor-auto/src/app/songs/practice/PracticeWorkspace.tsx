"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Metronome } from "./Metronome";
import { LyricPractice } from "./LyricPractice";

const STORAGE_KEY = "vx_metronome_v1";

type PracticeSong = {
  id: string;
  title: string;
  bpm: number | null;
  lyrics: string | null;
  lyricsMeta: string | null;
};

export function PracticeWorkspace({ songs }: { songs: PracticeSong[] }) {
  const [bpm, setBpm] = useState(
    () => songs.find((song) => song.lyrics?.trim())?.bpm ?? songs[0]?.bpm ?? 100,
  );
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [selectedSongId, setSelectedSongId] = useState(
    songs.find((song) => song.lyrics?.trim())?.id ?? songs[0]?.id ?? "",
  );
  const preferencesLoadedRef = useRef(false);

  const lyricSongs = useMemo(
    () => songs.filter((song) => song.lyrics?.trim()),
    [songs],
  );
  const selectedSong = lyricSongs.find((song) => song.id === selectedSongId) ?? lyricSongs[0] ?? null;

  useEffect(() => {
    let saved: { bpm?: number; beats?: number } = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { bpm?: number; beats?: number };
    } catch {
      // Ignore malformed local preferences.
    }
    const timer = window.setTimeout(() => {
      if (saved.bpm && saved.bpm >= 40 && saved.bpm <= 240) setBpm(saved.bpm);
      if (saved.beats && [2, 3, 4, 6].includes(saved.beats)) setBeatsPerBar(saved.beats);
      preferencesLoadedRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bpm, beats: beatsPerBar }));
  }, [bpm, beatsPerBar]);

  function changeSong(id: string) {
    setSelectedSongId(id);
    const song = lyricSongs.find((item) => item.id === id);
    if (song?.bpm) setBpm(song.bpm);
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="order-2 space-y-6 lg:order-1">
        <Metronome
          songs={songs}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          metronomeRunning={metronomeRunning}
          currentBeat={currentBeat}
          setBpm={setBpm}
          setBeatsPerBar={setBeatsPerBar}
          setMetronomeRunning={setMetronomeRunning}
          setCurrentBeat={setCurrentBeat}
        />
      </div>
      <div className="order-1 lg:order-2">
        <LyricPractice
          key={selectedSong?.id ?? "empty"}
          songs={lyricSongs}
          selectedSong={selectedSong}
          bpm={bpm}
          beatsPerBar={beatsPerBar}
          metronomeRunning={metronomeRunning}
          currentBeat={currentBeat}
          onSongChange={changeSong}
        />
      </div>
    </div>
  );
}
