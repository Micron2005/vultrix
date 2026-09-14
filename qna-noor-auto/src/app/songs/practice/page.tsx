import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Textarea,
  PageHeader,
} from "@/components/ui";
import { listSongs, requireMusicPack } from "@/lib/songs";
import { formatInTimeZone } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { loadPracticeWeekSummary, listPracticeSessions } from "@/lib/practice";
import { SongsTabs } from "../SongsTabs";
import { Metronome } from "./Metronome";
import { deletePractice, logManualPractice } from "./actions";

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default async function PracticePage() {
  const { orgId } = await requireMusicPack();
  const timezone = await orgTimeZone(orgId);
  const [songs, sessions, summary] = await Promise.all([
    listSongs(orgId),
    listPracticeSessions(orgId),
    loadPracticeWeekSummary(orgId, timezone),
  ]);
  const maxMinutes = Math.max(1, ...summary.days.map((day) => day.minutes));

  return (
    <>
      <PageHeader
        title="Songs"
        description="Practice — metronome, timer and your practice log."
      />
      <SongsTabs active="practice" />
      <Metronome songs={songs.map((song) => ({ id: song.id, title: song.title }))} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="This week" />
          <CardBody className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Minutes</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.totalMinutes}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Sessions</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.sessionCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Streak</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.currentStreak}<span className="ml-1 text-xs font-normal text-zinc-500">days</span></p>
            </div>
          </CardBody>
          <div className="grid grid-cols-7 items-end gap-2 px-5 pb-5">
            {summary.days.map((day) => (
              <div key={day.day} className="text-center">
                <div className="flex h-24 items-end justify-center">
                  <div
                    className="w-full max-w-8 rounded-t bg-[var(--vx-accent-600)]"
                    style={{ height: `${Math.max(day.minutes ? 8 : 2, (day.minutes / maxMinutes) * 100)}%` }}
                    title={`${day.minutes} minutes`}
                  />
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {formatInTimeZone(new Date(`${day.day}T12:00:00Z`), "UTC", { weekday: "short" }).slice(0, 2)}
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Log" />
          <form action={logManualPractice} className="space-y-3 border-b border-zinc-200 p-5">
            <p className="text-xs font-medium text-zinc-700">Forgot to time it? Add minutes</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input name="minutes" type="number" min={1} max={240} placeholder="Minutes" required />
              <Select name="songId" aria-label="Song">
                <option value="">No song</option>
                {songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
              </Select>
              <Input name="bpm" type="number" min={40} max={240} placeholder="BPM (optional)" />
            </div>
            <Textarea name="notes" placeholder="What did you work on?" rows={2} />
            <Button type="submit" size="sm" variant="secondary">Add minutes</Button>
          </form>
          {sessions.length === 0 ? (
            <EmptyState
              title="No practice sessions logged yet"
              className="m-5"
            />
          ) : (
            <div className="divide-y divide-zinc-200">
              {sessions.map((session) => (
                <div key={session.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800">
                      <span>{formatInTimeZone(session.startedAt, timezone, { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="text-zinc-500">{formatDuration(session.durationSec)}</span>
                      {session.bpm && <span className="text-xs text-zinc-500">{session.bpm} BPM</span>}
                    </div>
                    <form action={deletePractice.bind(null, session.id)}>
                      <Button type="submit" size="sm" variant="ghost">Delete</Button>
                    </form>
                  </div>
                  {session.song && <Link href={`/songs/${session.song.id}`} className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200">{session.song.title}</Link>}
                  {session.notes && <p className="whitespace-pre-wrap text-sm text-zinc-600">{session.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
