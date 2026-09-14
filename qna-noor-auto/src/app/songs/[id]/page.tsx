import { notFound } from "next/navigation";
import { Button, Card, Input, LinkButton, PageHeader } from "@/components/ui";
import { requireMusicPack, getSong, SONG_STAGES } from "@/lib/songs";
import { SongForm } from "../SongForm";
import { DeleteSongButton } from "../DeleteSongButton";
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
              <summary className="cursor-pointer text-sm text-zinc-700">{stage.label} · {stage.tasks.filter((task) => task.done).length}/{stage.tasks.length}</summary>
            </details>
          ))}
        </div>
      </Card>
      <div className="mt-6">
        <DeleteSongButton action={deleteSong.bind(null, song.id)} />
      </div>
    </>
  );
}
