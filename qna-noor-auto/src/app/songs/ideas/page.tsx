import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { listSongIdeas, listSongs, requireMusicPack } from "@/lib/songs";
import { SongsTabs } from "../SongsTabs";
import { AttachSelect } from "./AttachSelect";
import { IdeaBody } from "./IdeaBody";
import { IdeaCapture } from "./IdeaCapture";
import { DeleteIdeaButton } from "./DeleteIdeaButton";
import { deleteIdea, updateIdea } from "./actions";

export default async function SongIdeasPage({
  searchParams,
}: {
  searchParams?: Promise<{ song?: string }>;
}) {
  const { orgId } = await requireMusicPack();
  const params = (await searchParams) ?? {};
  const [songs, ideas] = await Promise.all([
    listSongs(orgId),
    listSongIdeas(orgId),
  ]);
  const selectedSongId = songs.some((song) => song.id === params.song)
    ? params.song
    : undefined;

  return (
    <>
      <PageHeader
        title="Songs"
        description="Ideas — lyric snippets and voice memos, before they're a song."
      />
      <SongsTabs active="ideas" />
      <Card className="max-w-2xl p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900">
          Capture an idea
        </h2>
        <p className="mb-4 text-xs text-zinc-500">
          Save a thought now and turn it into a song later.
        </p>
        <IdeaCapture
          songs={songs.map((song) => ({ id: song.id, title: song.title }))}
          initialSongId={selectedSongId}
        />
      </Card>
      <section className="mt-6 space-y-3">
        {ideas.length === 0 ? (
          <Card className="p-5 text-sm text-zinc-600">
            Nothing captured yet. Hum it, type it, save it.
          </Card>
        ) : (
          ideas.map((idea) => (
            <Card key={idea.id} className="space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {idea.title || "Untitled idea"}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDateTime(idea.createdAt)}
                  </p>
                </div>
                <DeleteIdeaButton action={deleteIdea.bind(null, idea.id)} />
              </div>
              {idea.body && <IdeaBody body={idea.body} />}
              {idea.audioDataUrl && (
                <div className="flex flex-wrap items-center gap-3">
                  <audio
                    controls
                    preload="none"
                    src={idea.audioDataUrl}
                    className="min-w-0 max-w-full"
                  />
                  {idea.durationSec !== null && (
                    <span className="text-xs text-zinc-500">
                      {Math.floor(idea.durationSec / 60)}:
                      {String(idea.durationSec % 60).padStart(2, "0")}
                    </span>
                  )}
                </div>
              )}
              {idea.song && (
                <Link
                  href={`/songs/${idea.song.id}`}
                  className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                >
                  {idea.song.title}
                </Link>
              )}
              <form action={updateIdea.bind(null, idea.id)} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="title" value={idea.title ?? ""} />
                <input type="hidden" name="body" value={idea.body ?? ""} />
                <AttachSelect songs={songs} defaultValue={idea.songId ?? ""} />
              </form>
            </Card>
          ))
        )}
      </section>
    </>
  );
}
