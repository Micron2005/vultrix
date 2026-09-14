"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
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

const LyricsMetaLineSchema = z.object({
  bars: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).optional(),
  note: z.string().max(300).optional(),
});

const LyricsMetaSchema = z.object({
  v: z.literal(1),
  lines: z.record(z.string(), LyricsMetaLineSchema),
});

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
    where: { id, orgId },
    select: { releasedAt: true },
  });
  if (!existing) {
    redirect("/songs");
  }
  await db.song.updateMany({
    where: { id, orgId },
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

export async function saveLyrics(
  id: string,
  payload: { lyrics: string; lyricsMeta: unknown },
) {
  const { orgId } = await requireMusicPack();
  const lyrics = z.string().max(20_000).parse(payload.lyrics);
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
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw new Error("Song not found.");
  await db.song.updateMany({
    where: { id, orgId },
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
  await db.songTask.updateMany({
    where: { id, song: { orgId } },
    data: { done },
  });
  revalidatePath("/songs");
}

export async function addSongTask(songId: string, stage: string, formData: FormData) {
  const { orgId } = await requireMusicPack();
  if (!isSongStage(stage)) return;
  const label = z.string().trim().min(1).parse(formData.get("label"));
  const count = await db.songTask.count({ where: { songId, song: { orgId }, stage } });
  await db.songTask.create({ data: { songId, stage, label, sortOrder: count } });
  revalidatePath(`/songs/${songId}`);
}

export async function removeSongTask(id: string) {
  const { orgId } = await requireMusicPack();
  await db.songTask.deleteMany({ where: { id, song: { orgId } } });
  revalidatePath("/songs");
}

export async function deleteSong(id: string) {
  const { orgId } = await requireMusicPack();
  await db.song.deleteMany({ where: { id, orgId } });
  revalidatePath("/songs");
  revalidatePath("/");
  redirect("/songs");
}
