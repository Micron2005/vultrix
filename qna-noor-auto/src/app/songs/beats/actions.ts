"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMusicPack } from "@/lib/songs";
import {
  BeatDataSchema,
  DEFAULT_BEAT_DATA,
  KITS,
} from "./kits";

const BeatCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  songId: z.string().optional(),
});

const BeatSaveSchema = z.object({
  bpm: z.number().int().min(40).max(200),
  swing: z.number().int().min(0).max(60),
  kit: z.enum(KITS),
  data: BeatDataSchema,
});

async function validSongId(orgId: string, raw: string | null) {
  if (!raw) return null;
  const song = await db.song.findFirst({
    where: { id: raw, orgId },
    select: { id: true },
  });
  return song?.id ?? null;
}

function revalidateBeatPaths(id?: string) {
  revalidatePath("/songs/beats");
  if (id) revalidatePath(`/songs/beats/${id}`);
  revalidatePath("/songs");
  revalidatePath("/");
}

export async function createBeat(formData: FormData) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatCreateSchema.parse({
    title: formData.get("title"),
    songId: String(formData.get("songId") ?? "").trim() || undefined,
  });
  const songId = await validSongId(orgId, parsed.songId ?? null);
  const beat = await db.beat.create({
    data: {
      orgId,
      songId,
      title: parsed.title,
      data: JSON.stringify(DEFAULT_BEAT_DATA),
    },
  });
  revalidateBeatPaths(beat.id);
  redirect(`/songs/beats/${beat.id}`);
}

export async function saveBeat(id: string, payload: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatSaveSchema.parse(payload);
  await db.beat.updateMany({
    where: { id, orgId },
    data: {
      bpm: parsed.bpm,
      swing: parsed.swing,
      kit: parsed.kit,
      data: JSON.stringify(parsed.data),
    },
  });
  revalidateBeatPaths(id);
}

export async function renameBeat(id: string, title: string) {
  const { orgId } = await requireMusicPack();
  const parsed = z.string().trim().min(1).max(120).parse(title);
  await db.beat.updateMany({ where: { id, orgId }, data: { title: parsed } });
  revalidateBeatPaths(id);
}

export async function attachBeatToSong(id: string, formData: FormData) {
  const { orgId } = await requireMusicPack();
  const songId = String(formData.get("songId") ?? "").trim() || null;
  const validId = await validSongId(orgId, songId);
  await db.beat.updateMany({
    where: { id, orgId },
    data: { songId: validId },
  });
  revalidateBeatPaths(id);
}

export async function deleteBeat(id: string) {
  const { orgId } = await requireMusicPack();
  await db.beat.deleteMany({ where: { id, orgId } });
  revalidateBeatPaths();
  redirect("/songs/beats");
}
