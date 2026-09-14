import Link from "next/link";
import { Card, CardHeader, EmptyState, LinkButton } from "@/components/ui";
import { listSongs, SONG_STAGES } from "@/lib/songs";

export async function SongsBlock({
  orgId,
  editing,
  title,
}: {
  orgId: string;
  editing: boolean;
  title?: string;
}) {
  const songs = await listSongs(orgId);
  if (!songs.length && !editing) return null;
  const counts = SONG_STAGES.map((stage) => ({
    ...stage,
    count: songs.filter((song) => song.stage === stage.id).length,
  }));
  const recent = songs.filter((song) => song.stage !== "RELEASED").slice(0, 5);
  return (
    <Card className="mb-6">
      <CardHeader title={title ?? "Songs in progress"} />
      {songs.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No songs yet — start with an idea." />
          <div className="mt-3 text-center">
            <LinkButton href="/songs/new" size="sm">New song</LinkButton>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {counts.map((stage) => <span key={stage.id} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600">{stage.label} {stage.count}</span>)}
          </div>
          <div className="mt-3 divide-y divide-zinc-200">
            {recent.map((song) => <Link key={song.id} href={`/songs/${song.id}`} className="block py-2 text-sm text-zinc-800 hover:text-zinc-950">{song.title}<span className="ml-2 text-xs text-zinc-500">{SONG_STAGES.find((stage) => stage.id === song.stage)?.label}</span></Link>)}
          </div>
        </div>
      )}
    </Card>
  );
}
