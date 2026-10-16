import { notFound } from "next/navigation";
import Link from "next/link";
import { follow } from "@/app/people/actions";
import { Badge, Button, Card, Input, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { groupShareCandidates } from "@/lib/people";
import { requireMusicPack, getSong, SONG_STAGES } from "@/lib/songs";
import { formatDateTime } from "@/lib/utils";
import { SongForm } from "../SongForm";
import { DeleteSongButton } from "../DeleteSongButton";
import { SongsTabs } from "../SongsTabs";
import { IdeaBody } from "../ideas/IdeaBody";
import { LyricFollowAlong } from "../LyricFollowAlong";
import { addSongTask, deleteSong, moveSong, removeSongMember, removeSongTask, setSongBestTake, toggleSongTask, updateSong } from "../actions";
import { StarRating } from "../StarRating";
import { SongTaskRow } from "../SongTaskRow";
import { SongInviteForm } from "../SongInviteForm";
import { LeaveSongButton } from "../LeaveSongButton";
import { TakeNotes } from "../TakeNotes";
import { DetectKeyButton } from "../DetectKeyButton";

function formatTakeDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default async function SongDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireMusicPack();
  const song = await getSong(orgId, id);
  if (!song) notFound();
  const isOwner = song.orgId === orgId;
  const memberOrgIds = new Set(song.members.map((member) => member.orgId));
  const ownerProfileId = song.organization.profile?.id;
  const shareCandidates =
    isOwner && ownerProfileId
      ? await (async () => {
          const [following, followers] = await Promise.all([
            db.follow.findMany({
              where: { followerId: ownerProfileId },
              select: {
                following: {
                  select: {
                    id: true,
                    orgId: true,
                    handle: true,
                    displayName: true,
                  },
                },
              },
            }),
            db.follow.findMany({
              where: { followingId: ownerProfileId },
              select: {
                follower: {
                  select: {
                    id: true,
                    orgId: true,
                    handle: true,
                    displayName: true,
                  },
                },
              },
            }),
          ]);
          return groupShareCandidates(
            following.map((row) => row.following),
            followers.map((row) => row.follower),
            memberOrgIds,
          );
        })()
      : { mutual: [], followingOnly: [], followersOnly: [] };
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Stage</span>
          <span className="rounded-full bg-zinc-100 px-2 py-1">
            {SONG_STAGES.find((stage) => stage.id === song.stage)?.label ?? song.stage}
          </span>
        </div>
        <StarRating songId={song.id} rating={song.rating} />
      </div>
      <SongsTabs active="board" />
      <SongForm action={updateSong.bind(null, song.id)} song={song} />
      <Card className="mt-6 max-w-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">People on this song</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {isOwner ? "Share this song with mutual connections." : "Song details and linked music are shared with these organizations."}
            </p>
          </div>
          <Badge tone="accent">{isOwner ? "Owner" : "Shared"}</Badge>
        </div>
        <div className="mt-4 divide-y divide-zinc-100">
          <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">
                {song.organization.profile?.displayName ?? song.organization.name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {song.organization.profile?.handle
                  ? `@${song.organization.profile.handle}`
                  : song.organization.name}
              </p>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">Owner</span>
          </div>
          {song.members.map((member) => (
            <div key={member.orgId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {member.organization.profile?.displayName ?? member.organization.name}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {member.organization.profile?.handle
                    ? `@${member.organization.profile.handle}`
                    : member.organization.name}
                </p>
              </div>
              {isOwner ? (
                <form action={removeSongMember.bind(null, song.id, member.orgId)}>
                  <Button type="submit" size="xs" variant="danger">Remove</Button>
                </form>
              ) : member.orgId === orgId ? (
                <span className="shrink-0 text-xs text-zinc-500">You</span>
              ) : null}
            </div>
          ))}
        </div>
        {isOwner ? (
          <div className="mt-4 border-t border-zinc-200 pt-4">
            {song.members.length >= 10 ? (
              <p className="text-sm text-zinc-500">This song has reached the 10-member limit.</p>
            ) : shareCandidates.mutual.length > 0 ? (
              <div>
                <SongInviteForm
                  songId={song.id}
                  connections={shareCandidates.mutual.map(
                    ({ id, handle, displayName }) => ({
                      id,
                      handle,
                      displayName,
                    }),
                  )}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  They need Music on their account (or a free account) to open it.
                </p>
              </div>
            ) : null}
            {shareCandidates.followingOnly.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-zinc-700">
                  Waiting for them to follow you back
                </h3>
                <ul className="space-y-2">
                  {shareCandidates.followingOnly.map((profile) => (
                    <li key={profile.id} className="text-sm text-zinc-600">
                      @{profile.handle} — waiting for them to follow you back
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {shareCandidates.followersOnly.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold text-zinc-700">
                  Followers you can follow back
                </h3>
                <ul className="divide-y divide-zinc-100">
                  {shareCandidates.followersOnly.map((profile) => (
                    <li
                      key={profile.id}
                      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="text-sm text-zinc-600">
                        @{profile.handle} follows you
                      </p>
                      <form action={follow.bind(null, profile.id)}>
                        <input type="hidden" name="songId" value={song.id} />
                        <Button type="submit" size="xs">
                          Follow back
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {shareCandidates.mutual.length === 0 &&
              shareCandidates.followingOnly.length === 0 &&
              shareCandidates.followersOnly.length === 0 && (
                <p className="text-sm text-zinc-500">
                  Follow someone on{" "}
                  <Link
                    href="/people"
                    className="font-medium text-[var(--vx-accent-700)] underline"
                  >
                    People
                  </Link>{" "}
                  and have them follow you back to share this song.
                </p>
              )}
          </div>
        ) : (
          <div className="mt-4 border-t border-zinc-200 pt-4">
            <LeaveSongButton songId={song.id} />
          </div>
        )}
      </Card>
      <Card className="mt-6 max-w-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Lyrics</h2>
          <Link
            href={`/songs/lyrics?song=${song.id}`}
            className="text-xs font-medium text-zinc-700 underline"
          >
            Edit in Lyrics →
          </Link>
        </div>
        {song.lyrics?.trim() ? (
          <LyricFollowAlong
            songId={song.id}
            lyrics={song.lyrics}
            lyricsMeta={song.lyricsMeta}
          />
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No lyrics yet.</p>
        )}
      </Card>
      <Card className="mt-6 max-w-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Takes</h2>
        {(() => {
          const takes = [
            ...song.vocalTakes.map((take) => ({
              id: take.id,
              kind: "song" as const,
              name: take.name,
              source: "Lyrics",
              durationSec: take.durationSec,
              initialCount: take._count.takeNotes,
            })),
            ...song.beats.flatMap((beat) =>
              beat.takes.map((take) => ({
                id: take.id,
                kind: "beat" as const,
                name: take.name,
                source: `${beat.title}${take.layer?.name ? ` · ${take.layer.name}` : ""}`,
                durationSec: take.durationSec,
                initialCount: take._count.takeNotes,
              })),
            ),
          ].sort((left, right) => {
            const leftBest = song.bestTakeKind === left.kind && song.bestTakeId === left.id;
            const rightBest = song.bestTakeKind === right.kind && song.bestTakeId === right.id;
            return Number(rightBest) - Number(leftBest);
          });
          return takes.length ? (
            <div className="mt-4 space-y-2">
              {takes.map((take) => {
                const isBest = song.bestTakeKind === take.kind && song.bestTakeId === take.id;
                return (
                  <div
                    key={`${take.kind}-${take.id}`}
                    className={`rounded-lg border p-3 ${isBest ? "border-amber-400 bg-amber-50/50" : "border-zinc-200"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900">{take.name}</p>
                          {isBest && <span className="text-[11px] font-medium text-amber-700">Best take</span>}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{take.source} · {formatTakeDuration(take.durationSec)}</p>
                      </div>
                      <form action={setSongBestTake.bind(null, song.id, isBest ? null : { kind: take.kind, id: take.id })}>
                        <button type="submit" className={`text-xs font-medium ${isBest ? "text-amber-700" : "text-zinc-500 hover:text-amber-600"}`}>
                          {isBest ? "★ Best" : "☆ Best"}
                        </button>
                      </form>
                    </div>
                    <TakeNotes
                      kind={take.kind}
                      takeId={take.id}
                      src={`/songs/audio/${take.kind}/${take.id}?v=shared-songs-v1`}
                      durationSec={take.durationSec}
                      initialCount={take.initialCount}
                    />
                    <DetectKeyButton
                      src={`/songs/audio/${take.kind}/${take.id}?v=shared-songs-v1`}
                      songId={song.id}
                      canSet
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No takes yet — record one in Lyrics → Sing it or on a beat.
            </p>
          );
        })()}
      </Card>
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
            <SongTaskRow
              key={task.id}
              label={task.label}
              done={task.done}
              onToggle={toggleSongTask.bind(null, task.id)}
              onRemove={removeSongTask.bind(null, task.id)}
            />
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
                  <SongTaskRow
                    key={task.id}
                    label={task.label}
                    done={task.done}
                    onToggle={toggleSongTask.bind(null, task.id)}
                    onRemove={removeSongTask.bind(null, task.id)}
                  />
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
      <Card className="mt-6 max-w-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Beats</h2>
            <p className="mt-1 text-xs text-zinc-500">Patterns attached to this song.</p>
          </div>
          <Link
            href={`/songs/beats?song=${song.id}`}
            className="text-xs font-medium text-zinc-700 underline"
          >
            Open beats →
          </Link>
        </div>
        {song.beats.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No beats attached yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {song.beats.map((beat) => (
              <Link
                key={beat.id}
                href={`/songs/beats/${beat.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-800">{beat.title}</span>
                <span className="text-xs text-zinc-500">{beat.bpm} BPM · {beat.kit}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
      {isOwner && (
        <div className="mt-6">
          <DeleteSongButton action={deleteSong.bind(null, song.id)} />
        </div>
      )}
    </>
  );
}
