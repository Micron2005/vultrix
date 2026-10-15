"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { LyricsMetaSchema, LyricsTextSchema } from "@/lib/lyrics";
import { notify } from "@/lib/notifications";
import { relationship } from "@/lib/people";
import { beatAccessWhere, songAccessWhere } from "@/lib/songAccess";
import {
  DEFAULT_STAGE_TASKS,
  isSongStage,
  moveSong as moveSongRecord,
  requireMusicPack,
  SONG_STAGES,
} from "@/lib/songs";

const SongSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  stage: z.string(),
  musicalKey: z.string().optional(),
  bpm: z.string().optional(),
  genre: z.string().optional(),
  collaborators: z.string().optional(),
  notes: z.string().optional(),
});

const SongRatingSchema = z.number().int().min(1).max(5).nullable();
const SongBestTakeSchema = z.object({
  kind: z.enum(["song", "beat"]),
  id: z.string().min(1),
}).nullable();

function isUniqueConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function songData(formData: FormData) {
  const parsed = SongSchema.parse(Object.fromEntries(formData.entries()));
  const bpm = parsed.bpm?.trim() ? Number.parseInt(parsed.bpm, 10) : null;
  return {
    title: parsed.title,
    stage: isSongStage(parsed.stage) ? parsed.stage : "IDEA",
    musicalKey: parsed.musicalKey?.trim() || null,
    bpm: Number.isFinite(bpm) ? bpm : null,
    genre: parsed.genre?.trim() || null,
    collaborators: parsed.collaborators?.trim() || null,
    notes: parsed.notes?.trim() || null,
  };
}

export async function createSong(formData: FormData) {
  const { orgId } = await requireMusicPack();
  const data = songData(formData);
  const song = await db.song.create({
    data: {
      orgId,
      ...data,
      tasks: {
        create: SONG_STAGES.flatMap((stage) =>
          DEFAULT_STAGE_TASKS[stage.id].map((label, sortOrder) => ({
            stage: stage.id,
            label,
            sortOrder,
          })),
        ),
      },
    },
  });
  revalidatePath("/songs");
  revalidatePath("/");
  redirect(`/songs/${song.id}`);
}

export async function updateSong(id: string, formData: FormData) {
  const { orgId } = await requireMusicPack();
  const data = songData(formData);
  const existing = await db.song.findFirst({
    where: { id, ...songAccessWhere(orgId) },
    select: { releasedAt: true },
  });
  if (!existing) {
    redirect("/songs");
  }
  await db.song.updateMany({
    where: { id, ...songAccessWhere(orgId) },
    data: {
      ...data,
      releasedAt:
        data.stage === "RELEASED"
          ? existing.releasedAt ?? new Date()
          : existing.releasedAt,
    },
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${id}`);
  revalidatePath("/");
  redirect(`/songs/${id}`);
}

export async function setSongRating(songId: string, rating: number | null) {
  const { orgId } = await requireMusicPack();
  const parsed = SongRatingSchema.parse(rating);
  await db.song.updateMany({
    where: { id: songId, ...songAccessWhere(orgId) },
    data: { rating: parsed },
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
}

export async function setSongBestTake(
  songId: string,
  ref: { kind: "song" | "beat"; id: string } | null,
) {
  const { orgId } = await requireMusicPack();
  const parsed = SongBestTakeSchema.parse(ref);
  const song = await db.song.findFirst({
    where: { id: songId, ...songAccessWhere(orgId) },
    select: { id: true },
  });
  if (!song) return;
  if (parsed) {
    const take =
      parsed.kind === "song"
        ? await db.songVocalTake.findFirst({
            where: {
              id: parsed.id,
              songId,
              uploadComplete: true,
              song: songAccessWhere(orgId),
            },
            select: { id: true },
          })
        : await db.beatTake.findFirst({
            where: {
              id: parsed.id,
              uploadComplete: true,
              beat: { AND: [{ songId }, beatAccessWhere(orgId)] },
            },
            select: { id: true },
          });
    if (!take) throw new Error("Take not found");
  }
  await db.song.updateMany({
    where: { id: songId, ...songAccessWhere(orgId) },
    data: {
      bestTakeKind: parsed?.kind ?? null,
      bestTakeId: parsed?.id ?? null,
    },
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
}

export async function saveLyrics(
  id: string,
  payload: { lyrics: string; lyricsMeta: unknown },
) {
  const { orgId } = await requireMusicPack();
  const lyrics = LyricsTextSchema.parse(payload.lyrics);
  const lyricsMeta = LyricsMetaSchema.parse(payload.lyricsMeta);
  const entries = Object.entries(lyricsMeta.lines);
  if (entries.length > 200) {
    throw new Error("Lyrics can have at most 200 line settings.");
  }
  const lines: Record<string, { bars: 1 | 2 | 4 | 8; note?: string }> = {};
  for (const [rawText, value] of entries) {
    const text = rawText.trim();
    if (!text) throw new Error("Lyrics line settings need text.");
    if (text !== rawText && lines[text]) throw new Error("Duplicate lyric line settings.");
    lines[text] = {
      bars: value.bars ?? 2,
      ...(value.note?.trim() ? { note: value.note.trim() } : {}),
    };
  }
  const existing = await db.song.findFirst({
    where: { id, ...songAccessWhere(orgId) },
    select: { id: true },
  });
  if (!existing) throw new Error("Song not found.");
  await db.song.updateMany({
    where: { id, ...songAccessWhere(orgId) },
    data: {
      lyrics,
      lyricsMeta: JSON.stringify({ v: 1, lines }),
    },
  });
  revalidatePath(`/songs/${id}`);
  revalidatePath("/songs/practice");
  revalidatePath("/songs");
  revalidatePath("/");
}

export async function saveLyricsText(id: string, text: string) {
  const { orgId } = await requireMusicPack();
  const lyrics = LyricsTextSchema.parse(text);
  await db.song.updateMany({
    where: { id, ...songAccessWhere(orgId) },
    data: { lyrics },
  });
  revalidatePath(`/songs/${id}`);
  revalidatePath("/songs/practice");
  revalidatePath("/songs/beats");
}

export async function moveSong(id: string, stage: string) {
  const { orgId } = await requireMusicPack();
  if (!isSongStage(stage)) return;
  await moveSongRecord(orgId, id, stage);
  revalidatePath("/songs");
  revalidatePath(`/songs/${id}`);
  revalidatePath("/");
}

export async function toggleSongTask(id: string, done: boolean) {
  const { orgId } = await requireMusicPack();
  const task = await db.songTask.findFirst({
    where: { id, song: songAccessWhere(orgId) },
    select: { songId: true },
  });
  if (!task) return;
  await db.songTask.updateMany({
    where: { id, song: songAccessWhere(orgId) },
    data: { done },
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${task.songId}`);
}

export async function addSongTask(songId: string, stage: string, formData: FormData) {
  const { orgId } = await requireMusicPack();
  if (!isSongStage(stage)) return;
  const label = z.string().trim().min(1).parse(formData.get("label"));
  const song = await db.song.findFirst({
    where: { id: songId, ...songAccessWhere(orgId) },
    select: { id: true },
  });
  if (!song) return;
  const count = await db.songTask.count({ where: { songId, song: songAccessWhere(orgId), stage } });
  await db.songTask.create({ data: { songId, stage, label, sortOrder: count } });
  revalidatePath(`/songs/${songId}`);
}

export async function removeSongTask(id: string) {
  const { orgId } = await requireMusicPack();
  const task = await db.songTask.findFirst({
    where: { id, song: songAccessWhere(orgId) },
    select: { songId: true },
  });
  if (!task) return;
  await db.songTask.deleteMany({ where: { id, song: songAccessWhere(orgId) } });
  revalidatePath("/songs");
  revalidatePath(`/songs/${task.songId}`);
}

export async function deleteSong(id: string) {
  const { orgId } = await requireMusicPack();
  await db.song.deleteMany({ where: { id, orgId } });
  revalidatePath("/songs");
  revalidatePath("/");
  redirect("/songs");
}

export async function addSongMember(songId: string, profileId: string) {
  const { orgId } = await requireMusicPack();
  const song = await db.song.findFirst({
    where: { id: songId, orgId },
    select: {
      id: true,
      title: true,
      organization: {
        select: {
          name: true,
          profile: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  if (!song) return;
  const target = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, orgId: true },
  });
  if (!target || target.orgId === orgId) {
    throw new Error("Choose a different organization.");
  }
  const ownerProfile = song.organization.profile;
  if (!ownerProfile) throw new Error("Create a profile on People before inviting.");
  const connection = await relationship(ownerProfile.id, target.id);
  if (!connection.connected) {
    throw new Error("Only mutual connections can be invited.");
  }

  try {
    const added = await db.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Song" WHERE "id" = ${song.id} FOR UPDATE
      `;
      const existing = await tx.songMember.findUnique({
        where: { songId_orgId: { songId, orgId: target.orgId } },
        select: { id: true },
      });
      if (existing) return false;
      const memberCount = await tx.songMember.count({ where: { songId } });
      if (memberCount >= 10) throw new Error("A song can have up to 10 members.");
      await tx.songMember.create({
        data: { songId, orgId: target.orgId },
      });
      return true;
    });
    if (!added) return;
  } catch (error) {
    if (isUniqueConflict(error)) return;
    throw error;
  }

  const ownerName = ownerProfile.displayName || song.organization.name;
  const title = `${ownerName} added you to “${song.title}”`;
  await notify({
    orgId: target.orgId,
    kind: "song_shared",
    title,
    href: `/songs/${song.id}`,
    dedupeKey: title,
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${song.id}`);
}

export async function removeSongMember(songId: string, memberOrgId: string) {
  const { orgId } = await requireMusicPack();
  const song = await db.song.findFirst({
    where: { id: songId, orgId },
    select: { id: true },
  });
  if (!song || memberOrgId === orgId) return;
  await db.$transaction([
    db.beat.updateMany({
      where: { songId, orgId: memberOrgId },
      data: { songId: null },
    }),
    db.songMember.deleteMany({ where: { songId, orgId: memberOrgId } }),
  ]);
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/songs/beats");
}

export async function leaveSong(songId: string) {
  const { orgId } = await requireMusicPack();
  const song = await db.song.findFirst({
    where: { id: songId, members: { some: { orgId } } },
    select: {
      id: true,
      title: true,
      orgId: true,
      organization: { select: { name: true } },
    },
  });
  if (!song || song.orgId === orgId) redirect("/songs");
  const memberProfile = await db.profile.findUnique({
    where: { orgId },
    select: { displayName: true },
  });
  const memberName = memberProfile?.displayName ?? (await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  }))?.name ?? "A member";
  await db.$transaction([
    db.beat.updateMany({
      where: { songId, orgId },
      data: { songId: null },
    }),
    db.songMember.deleteMany({ where: { songId, orgId } }),
  ]);
  await notify({
    orgId: song.orgId,
    kind: "song_left",
    title: `${memberName} left “${song.title}”`,
    href: `/songs/${song.id}`,
  });
  revalidatePath("/songs");
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/songs/beats");
  redirect("/songs");
}
