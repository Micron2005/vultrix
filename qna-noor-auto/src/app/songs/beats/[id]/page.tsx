import { notFound } from "next/navigation";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { getBeat } from "@/lib/beats";
import { listSongs, requireMusicPack } from "@/lib/songs";
import { SongsTabs } from "../../SongsTabs";
import { BeatMaker } from "../BeatMaker";
import { BeatDataSchema } from "../kits";

export default async function BeatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireMusicPack();
  const [beat, songs] = await Promise.all([
    getBeat(orgId, id),
    listSongs(orgId),
  ]);
  if (!beat) notFound();
  const data = BeatDataSchema.parse(JSON.parse(beat.data));
  return (
    <>
      <PageHeader
        title="Beats"
        description="Sequence drums, bass, and patterns."
        actions={<LinkButton href="/songs/beats" variant="secondary">Back to beats</LinkButton>}
      />
      <SongsTabs active="beats" />
      <BeatMaker
        beat={{ ...beat, data: JSON.stringify(data) }}
        songs={songs.map((song) => ({ id: song.id, title: song.title }))}
      />
      <Card className="mt-6 max-w-2xl p-4">
        <p className="text-xs text-zinc-500">Autosave runs two seconds after the last change.</p>
      </Card>
    </>
  );
}
