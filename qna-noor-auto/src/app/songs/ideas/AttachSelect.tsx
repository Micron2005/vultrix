"use client";

import { Select } from "@/components/ui";

type SongOption = { id: string; title: string };

export function AttachSelect({
  songs,
  defaultValue,
}: {
  songs: SongOption[];
  defaultValue: string;
}) {
  return (
    <Select
      name="songId"
      defaultValue={defaultValue}
      aria-label="Attach idea to song"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="max-w-xs text-xs"
    >
      <option value="">Attach to…</option>
      {songs.map((song) => (
        <option key={song.id} value={song.id}>
          {song.title}
        </option>
      ))}
    </Select>
  );
}
