import { notFound } from "next/navigation";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { ensureBeatVocalLayers, getBeat, listBeatTakes } from "@/lib/beats";
import { listSongs, requireMusicPack } from "@/lib/songs";
import { SongsTabs } from "../../SongsTabs";
import { BeatMaker } from "../BeatMaker";
import { safeParseBeatData } from "../kits";

export default async function BeatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireMusicPack();
  const layers = await ensureBeatVocalLayers(orgId, id);
  const [beat, songs, takes, songVocalTakes] = await Promise.all([
    getBeat(orgId, id),
    listSongs(orgId),
    listBeatTakes(orgId, id),
    db.songVocalTake.findMany({
      where: { orgId, uploadComplete: true, song: { beats: { some: { id } } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, songId: true, name: true, audioMimeType: true, durationSec: true, createdAt: true },
    }),
  ]);
  if (!beat) notFound();
  const data = safeParseBeatData(beat.data);
  return (
    <>
      <PageHeader
        title="Beats"
        description="Sequence drums, bass, and patterns."
        actions={<LinkButton href="/songs/beats" variant="secondary">Back to beats</LinkButton>}
      />
      <SongsTabs active="beats" />
      <BeatMaker
        beat={{ ...beat, data: JSON.stringify(data), shareToken: beat.shareToken }}
        songs={songs.map((song) => ({
          id: song.id,
          title: song.title,
          lyrics: song.lyrics,
          lyricsMeta: song.lyricsMeta,
        }))}
        takes={takes.map((take) => ({
          ...take,
          createdAt: take.createdAt.toISOString(),
        }))}
        layers={layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          gain: layer.gain,
          pan: layer.pan,
          muted: layer.muted,
          solo: layer.solo,
          reverb: layer.reverb,
          eqLow: layer.eqLow,
          eqHigh: layer.eqHigh,
          compress: layer.compress,
          doubler: layer.doubler,
          sortOrder: layer.sortOrder,
        }))}
        songVocalTakes={songVocalTakes.map((take) => ({
          ...take,
          createdAt: take.createdAt.toISOString(),
        }))}
      />
      <Card className="mt-6 max-w-2xl p-4">
        <p className="text-xs text-zinc-500">Autosave runs two seconds after the last change.</p>
      </Card>
    </>
  );
}
