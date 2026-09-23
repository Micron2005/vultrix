"use client";

import Link from "next/link";
import { Button, Select } from "@/components/ui";
import { LyricFollowAlong } from "../LyricFollowAlong";

type PracticeSong = {
  id: string;
  title: string;
  bpm: number | null;
  lyrics: string | null;
  lyricsMeta: string | null;
};

export function LyricPractice({
  songs,
  selectedSong,
  bpm,
  beatsPerBar,
  metronomeRunning,
  currentBeat,
  onSongChange,
}: {
  songs: PracticeSong[];
  selectedSong: PracticeSong | null;
  bpm: number;
  beatsPerBar: number;
  metronomeRunning: boolean;
  currentBeat: number;
  onSongChange: (id: string) => void;
}) {
  if (!selectedSong || !selectedSong.lyrics?.trim()) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Follow along</h2>
        <p className="mt-2 text-sm text-zinc-500">Write lyrics on the song page</p>
        {selectedSong && (
          <Link href={`/songs/${selectedSong.id}`} className="mt-4 inline-flex">
            <Button type="button" size="sm">Write lyrics on the song page</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Follow along</h2>
          <p className="mt-1 text-xs text-zinc-500">Practice at {bpm} BPM · {beatsPerBar}/4</p>
        </div>
        <Select
          value={selectedSong.id}
          onChange={(event) => onSongChange(event.target.value)}
          aria-label="Practice song"
          className="min-w-44"
        >
          {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
        </Select>
      </div>
      <LyricFollowAlong
        songId={selectedSong.id}
        lyrics={selectedSong.lyrics}
        lyricsMeta={selectedSong.lyricsMeta}
        beatsPerBar={beatsPerBar}
        running={metronomeRunning}
        currentBeat={currentBeat}
      />
    </div>
  );
}
