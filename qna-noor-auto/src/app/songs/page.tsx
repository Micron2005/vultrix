import { LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireMusicPack, listSongs } from "@/lib/songs";
import { moveSong } from "./actions";
import { SongsBoard } from "./SongsBoard";
import { SongsTabs } from "./SongsTabs";

export default async function SongsPage() {
  const { orgId } = await requireMusicPack();
  const [songs, beats, beatTakeGroups, songTakeGroups] = await Promise.all([
    listSongs(orgId),
    db.beat.findMany({
      where: { orgId, songId: { not: null } },
      select: { id: true, songId: true },
    }),
    db.beatTake.groupBy({
      by: ["beatId"],
      where: { orgId, uploadComplete: true },
      _count: { _all: true },
    }),
    db.songVocalTake.groupBy({
      by: ["songId"],
      where: { orgId, uploadComplete: true },
      _count: { _all: true },
    }),
  ]);
  const beatSongById = new Map(beats.map((beat) => [beat.id, beat.songId]));
  const beatTakeCountBySong = new Map<string, number>();
  for (const group of beatTakeGroups) {
    const songId = beatSongById.get(group.beatId);
    if (songId) beatTakeCountBySong.set(songId, (beatTakeCountBySong.get(songId) ?? 0) + group._count._all);
  }
  const songTakeCountBySong = new Map(
    songTakeGroups.map((group) => [group.songId, group._count._all]),
  );
  const boardSongs = songs.map((song) => ({
    ...song,
    songTakeCount: songTakeCountBySong.get(song.id) ?? 0,
    beatTakeCount: beatTakeCountBySong.get(song.id) ?? 0,
  }));
  return (
    <>
      <PageHeader
        title="Songs"
        description="Every song from idea to release."
        actions={<LinkButton href="/songs/new">New song</LinkButton>}
      />
      <SongsTabs active="board" />
      <SongsBoard songs={boardSongs} moveSongAction={moveSong} />
    </>
  );
}
