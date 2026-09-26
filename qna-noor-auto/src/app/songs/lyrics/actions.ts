"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMusicPack } from "@/lib/songs";
import { ensureBeatVocalLayers } from "@/lib/beats";

const BeginSongVocalTakeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  audioMimeType: z.string().max(60),
  durationSec: z.number().int().min(1).max(900),
});

const TakeNameSchema = z.string().trim().min(1).max(60);
const UploadChunkSchema = z.string().min(1).max(3_000_000);

async function appendSongVocalTakeChunkForOrg(id: string, orgId: string, chunk: string) {
  const parsed = UploadChunkSchema.parse(chunk);
  const rows = await db.$queryRaw<Array<{ length: number }>>`
    SELECT LENGTH("audioDataUrl")::int AS length
    FROM "SongVocalTake"
    WHERE id = ${id} AND "orgId" = ${orgId} AND "uploadComplete" = false
  `;
  const current = rows[0];
  if (!current) throw new Error("Pending take not found.");
  if (
    current.length === 0
      ? !/^data:audio\/[^,]+,[A-Za-z0-9+/=]*$/.test(parsed)
      : !/^[A-Za-z0-9+/=]*$/.test(parsed)
  ) {
    throw new Error("Invalid audio chunk.");
  }
  if (current.length + parsed.length > 20_000_000) {
    throw new Error("Recording is too large.");
  }
  await db.$executeRaw`
    UPDATE "SongVocalTake"
    SET "audioDataUrl" = "audioDataUrl" || ${parsed}
    WHERE id = ${id} AND "orgId" = ${orgId} AND "uploadComplete" = false
  `;
}

export async function beginSongVocalTake(songId: string, payload: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeginSongVocalTakeSchema.parse(payload);
  const song = await db.song.findFirst({
    where: { id: songId, orgId },
    select: { id: true },
  });
  if (!song) throw new Error("Song not found.");
  const count = await db.songVocalTake.count({ where: { songId, orgId } });
  if (count >= 30) throw new Error("Up to 30 takes per song.");
  const take = await db.songVocalTake.create({
    data: { orgId, songId, ...parsed, audioDataUrl: "", uploadComplete: false },
  });
  return { id: take.id };
}

export async function appendSongVocalTakeChunk(id: string, chunk: string) {
  const { orgId } = await requireMusicPack();
  await appendSongVocalTakeChunkForOrg(id, orgId, chunk);
}

export async function finishSongVocalTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id, orgId, uploadComplete: false },
    select: {
      id: true,
      songId: true,
      name: true,
      audioDataUrl: true,
      audioMimeType: true,
      durationSec: true,
      createdAt: true,
    },
  });
  if (!take || !take.audioDataUrl.startsWith("data:audio/") || take.audioDataUrl.length <= 100) {
    throw new Error("Incomplete audio upload.");
  }
  await db.songVocalTake.updateMany({
    where: { id, orgId, uploadComplete: false },
    data: { uploadComplete: true },
  });
  await db.songVocalTake.deleteMany({
    where: {
      songId: take.songId,
      orgId,
      uploadComplete: false,
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
  return {
    id: take.id,
    songId: take.songId,
    name: take.name,
    audioMimeType: take.audioMimeType,
    durationSec: take.durationSec,
    createdAt: take.createdAt,
  };
}

export async function discardSongVocalTake(id: string) {
  const { orgId } = await requireMusicPack();
  await db.songVocalTake.deleteMany({ where: { id, orgId, uploadComplete: false } });
}

export async function renameSongVocalTake(id: string, name: string) {
  const { orgId } = await requireMusicPack();
  const parsed = TakeNameSchema.parse(name);
  const take = await db.songVocalTake.findFirst({
    where: { id, orgId, uploadComplete: true },
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
    where: { id, orgId, uploadComplete: true },
    select: { songId: true },
  });
  if (!take) return;
  await db.songVocalTake.deleteMany({ where: { id, orgId } });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
}

export async function copySongTakeToBeat(takeId: string, beatId: string, layerId?: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id: takeId, orgId, uploadComplete: true },
    select: { name: true, audioDataUrl: true, audioMimeType: true, durationSec: true },
  });
  const beat = await db.beat.findFirst({
    where: { id: beatId, orgId },
    select: { id: true },
  });
  if (!take || !beat) throw new Error("Take or beat not found.");
  const layers = await ensureBeatVocalLayers(orgId, beatId);
  const layer = layerId ? layers.find((item) => item.id === layerId) : layers[0];
  if (!layer) throw new Error("Layer not found");
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
      layerId: layer.id,
      uploadComplete: true,
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
    layerId: saved.layerId,
    createdAt: saved.createdAt,
  };
}
