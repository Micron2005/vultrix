import { notFound } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, LinkButton, PageHeader } from "@/components/ui";
import { requireMusicPack, getSong, SONG_STAGES } from "@/lib/songs";
import { formatDateTime } from "@/lib/utils";
import { SongForm } from "../SongForm";
import { DeleteSongButton } from "../DeleteSongButton";
import { SongsTabs } from "../SongsTabs";
import { IdeaBody } from "../ideas/IdeaBody";
import { addSongTask, deleteSong, moveSong, removeSongTask, toggleSongTask, updateSong } from "../actions";

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireMusicPack();
  const song = await getSong(orgId, id);
  if (!song) notFound();
  const currentTasks = song.tasks.filter((task) => task.stage === song.stage);
  const otherTasks = SONG_STAGES.filter((stage) => stage.id !== song.stage).map((stage) => ({
    ...stage,
    tasks: song.tasks.filter((task) => task.stage === stage.id),
  }));
  return (
    <>
      <PageHeader
        title={song.title}
        description={[SONG_STAGES.find((stage) => stage.id === song.stage)?.label, song.musicalKey, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(" · ")}
        actions={<LinkButton href="/songs" variant="secondary">Back to songs</LinkButton>}
      />
      <SongsTabs active="board" />
      <SongForm action={updateSong.bind(null, song.id)} song={song} />
      <Card className="mt-6 max-w-2xl p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Stage</h2>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {SONG_STAGES.map((stage) => (
            <form key={stage.id} action={moveSong.bind(null, song.id, stage.id)}>
              <button type="submit" className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${song.stage === stage.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>{stage.label}</button>
            </form>
          ))}
        </div>
        <h2 className="mt-5 text-sm font-semibold text-zinc-900">Checklist</h2>
        <div className="mt-2 space-y-2">
          {currentTasks.map((task) => (
            <form key={task.id} action={toggleSongTask.bind(null, task.id, !task.done)} className="flex items-center justify-between gap-2">
              <button type="submit" className="flex min-w-0 items-center gap-2 text-left text-sm">
                <input type="checkbox" checked={task.done} readOnly />
                <span className={task.done ? "text-zinc-400 line-through" : "text-zinc-700"}>{task.label}</span>
              </button>
              <button formAction={removeSongTask.bind(null, task.id)} className="text-xs text-red-600">Remove</button>
            </form>
          ))}
        </div>
        <form action={addSongTask.bind(null, song.id, song.stage)} className="mt-4 flex gap-2">
          <Input name="label" placeholder="Add a task" required />
          <Button type="submit" size="sm">Add</Button>
        </form>
        <div className="mt-5 space-y-2">
          {otherTasks.map((stage) => (
            <details key={stage.id} className="rounded-md border border-zinc-200 px-3 py-2">
              <summary className="cursor-pointer text-sm text-zinc-700">
                {stage.label} · {stage.tasks.filter((task) => task.done).length}/{stage.tasks.length}
              </summary>
              <div className="mt-2 space-y-2">
                {stage.tasks.map((task) => (
                  <form
                    key={task.id}
                    action={toggleSongTask.bind(null, task.id, !task.done)}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      type="submit"
                      className="flex min-w-0 items-center gap-2 text-left text-sm"
                    >
                      <input type="checkbox" checked={task.done} readOnly />
                      <span
                        className={
                          task.done
                            ? "text-zinc-400 line-through"
                            : "text-zinc-700"
                        }
                      >
                        {task.label}
                      </span>
                    </button>
                    <button
                      formAction={removeSongTask.bind(null, task.id)}
                      className="text-xs text-red-600"
                    >
                      Remove
                    </button>
                  </form>
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>
      <Card className="mt-6 max-w-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Ideas for this song
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Keep rough thoughts attached while the song takes shape.
            </p>
          </div>
          <Link
            href={`/songs/ideas?song=${song.id}`}
            className="text-xs font-medium text-zinc-700 underline"
          >
            Capture an idea →
          </Link>
        </div>
        {song.ideas.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No ideas attached yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {song.ideas.map((idea) => (
              <div key={idea.id} className="space-y-2 border-t border-zinc-200 pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-zinc-900">
                    {idea.title || "Untitled idea"}
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {formatDateTime(idea.createdAt)}
                  </span>
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
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="mt-6">
        <DeleteSongButton action={deleteSong.bind(null, song.id)} />
      </div>
    </>
  );
}
