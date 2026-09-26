import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { listSongs, requireMusicPack } from "@/lib/songs";
import { SongsTabs } from "../SongsTabs";
import { LyricsWorkspace } from "./LyricsWorkspace";

export default async function LyricsPage({
  searchParams,
}: {
  searchParams?: Promise<{ song?: string }>;
}) {
  const { orgId } = await requireMusicPack();
  const params = (await searchParams) ?? {};
  const [songs, beats] = await Promise.all([
    listSongs(orgId),
    db.beat.findMany({
      where: { orgId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, songId: true },
    }),
  ]);
  const selectedSong = songs.find((song) => song.id === params.song) ?? songs[0];
  return (
    <>
      <PageHeader
        title="Songs"
        description="Lyrics — write, sing, and try your vocals over a beat."
        actions={<LinkButton href="/songs/new">New song</LinkButton>}
      />
      <SongsTabs active="lyrics" />
      {selectedSong ? (
        <LyricsWorkspace
          key={selectedSong.id}
          songs={songs.map((song) => ({
            id: song.id,
            title: song.title,
            lyrics: song.lyrics,
            bpm: song.bpm,
          }))}
          selectedSong={{
            id: selectedSong.id,
            title: selectedSong.title,
            lyrics: selectedSong.lyrics,
            bpm: selectedSong.bpm,
            vocalTakes: await db.songVocalTake.findMany({
              where: { orgId, songId: selectedSong.id, uploadComplete: true },
              orderBy: { createdAt: "asc" },
              select: { id: true, songId: true, name: true, audioMimeType: true, durationSec: true, createdAt: true },
            }),
          }}
          beats={beats}
        />
      ) : (
        <Card className="max-w-2xl p-5">
          <EmptyState
            title="No songs yet"
            description="Create a song to start writing lyrics."
            action={
              <Link href="/songs/new" className="text-sm font-medium text-[var(--vx-accent-700)] underline">
                Create a song
              </Link>
            }
          />
        </Card>
      )}
    </>
  );
}
