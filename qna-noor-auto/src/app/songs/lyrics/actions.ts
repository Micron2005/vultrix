"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMusicPack } from "@/lib/songs";

const SongVocalTakeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  audioDataUrl: z.string().startsWith("data:audio/").max(14_000_000),
  audioMimeType: z.string().max(60),
  durationSec: z.number().int().min(1).max(900),
});

const TakeNameSchema = z.string().trim().min(1).max(60);

export async function saveSongVocalTake(songId: string, payload: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = SongVocalTakeSchema.parse(payload);
  const song = await db.song.findFirst({
    where: { id: songId, orgId },
    select: { id: true },
  });
  if (!song) throw new Error("Song not found.");
  const count = await db.songVocalTake.count({ where: { songId, orgId } });
  if (count >= 30) throw new Error("Up to 30 takes per song.");
  const take = await db.songVocalTake.create({
    data: { orgId, songId, ...parsed },
  });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${songId}`);
  return {
    id: take.id,
    songId: take.songId,
    name: take.name,
    audioMimeType: take.audioMimeType,
    durationSec: take.durationSec,
    createdAt: take.createdAt,
  };
}

export async function renameSongVocalTake(id: string, name: string) {
  const { orgId } = await requireMusicPack();
  const parsed = TakeNameSchema.parse(name);
  const take = await db.songVocalTake.findFirst({
    where: { id, orgId },
    select: { songId: true },
  });
  if (!take) throw new Error("Take not found.");
  await db.songVocalTake.updateMany({ where: { id, orgId }, data: { name: parsed } });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
}

export async function deleteSongVocalTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id, orgId },
    select: { songId: true },
  });
  if (!take) return;
  await db.songVocalTake.deleteMany({ where: { id, orgId } });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
}

export async function copySongTakeToBeat(takeId: string, beatId: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id: takeId, orgId },
    select: { name: true, audioDataUrl: true, audioMimeType: true, durationSec: true },
  });
  const beat = await db.beat.findFirst({
    where: { id: beatId, orgId },
    select: { id: true },
  });
  if (!take || !beat) throw new Error("Take or beat not found.");
  const count = await db.beatTake.count({ where: { beatId, orgId } });
  if (count >= 30) throw new Error("Up to 30 takes per beat.");
  const saved = await db.beatTake.create({
    data: {
      orgId,
      beatId,
      name: take.name,
      audioDataUrl: take.audioDataUrl,
      audioMimeType: take.audioMimeType,
      durationSec: take.durationSec,
      offsetMs: 0,
    },
  });
  revalidatePath(`/songs/beats/${beatId}`);
  return {
    id: saved.id,
    name: saved.name,
    audioMimeType: saved.audioMimeType,
    durationSec: saved.durationSec,
    offsetMs: saved.offsetMs,
    gain: saved.gain,
    muted: saved.muted,
    createdAt: saved.createdAt,
  };
}
