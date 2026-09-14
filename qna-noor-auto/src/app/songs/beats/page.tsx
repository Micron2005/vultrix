import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { listBeats } from "@/lib/beats";
import { formatDateTime } from "@/lib/utils";
import { listSongs, requireMusicPack } from "@/lib/songs";
import { SongsTabs } from "../SongsTabs";
import { createBeat, deleteBeat } from "./actions";

function patternCount(data: string) {
  try {
    const parsed = JSON.parse(data) as { patterns?: unknown[] };
    return Array.isArray(parsed.patterns) ? parsed.patterns.length : 0;
  } catch {
    return 0;
  }
}

export default async function BeatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ song?: string }>;
}) {
  const { orgId } = await requireMusicPack();
  const [beats, songs] = await Promise.all([listBeats(orgId), listSongs(orgId)]);
  const params = (await searchParams) ?? {};
  const selectedSongId = songs.some((song) => song.id === params.song)
    ? params.song
    : "";
  return (
    <>
      <PageHeader
        title="Beats"
        description="Build drum patterns and bass lines with synthesized sounds."
        actions={<LinkButton href="/songs/beats">New beat</LinkButton>}
      />
      <SongsTabs active="beats" />
      <Card className="max-w-2xl p-5">
        <CardHeader title="New beat" />
        <CardBody>
          <form action={createBeat} className="space-y-3">
            <Input name="title" placeholder="Beat title" required />
            <Select name="songId" defaultValue={selectedSongId} aria-label="Attach new beat to a song">
              <option value="">No song</option>
              {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
            </Select>
            <Button type="submit">Start beat</Button>
          </form>
        </CardBody>
      </Card>
      <section className="mt-6">
        {beats.length === 0 ? (
          <EmptyState
            title="No beats yet"
            description="Start with a kick on 1."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {beats.map((beat) => (
              <Card key={beat.id} className="p-4">
                <Link href={`/songs/beats/${beat.id}`} className="block">
                  <h2 className="font-medium text-zinc-900">{beat.title}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{beat.bpm} BPM · {beat.kit} · {patternCount(beat.data)} patterns</p>
                  {beat.song && <p className="mt-3 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">{beat.song.title}</p>}
                  <p className="mt-3 text-xs text-zinc-500">Updated {formatDateTime(beat.updatedAt)}</p>
                </Link>
                <form
                  action={deleteBeat.bind(null, beat.id)}
                  className="mt-4"
                >
                  <Button type="submit" size="sm" variant="danger">Delete</Button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
