"use server";

import { randomBytes } from "crypto";
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
import { ensureBeatVocalLayers } from "@/lib/beats";

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

const BeginBeatTakeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  audioMimeType: z.string().max(60),
  durationSec: z.number().int().min(1).max(900),
  offsetMs: z.number().int().min(-2000).max(2000),
  layerId: z.string().optional(),
});

const UploadChunkSchema = z.string().min(1).max(3_000_000);
const BeatTakePatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  offsetMs: z.number().int().min(-2000).max(2000).optional(),
  gain: z.number().int().min(0).max(150).optional(),
  muted: z.boolean().optional(),
  layerId: z.string().optional(),
}).partial();
const BeatVocalLayerPatchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  gain: z.number().int().min(0).max(150).optional(),
  pan: z.number().int().min(-100).max(100).optional(),
  muted: z.boolean().optional(),
  solo: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(7).optional(),
}).partial();

async function appendBeatTakeChunkForOrg(id: string, orgId: string, chunk: string) {
  const parsed = UploadChunkSchema.parse(chunk);
  const rows = await db.$queryRaw<Array<{ length: number }>>`
    SELECT LENGTH("audioDataUrl")::int AS length
    FROM "BeatTake"
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
    UPDATE "BeatTake"
    SET "audioDataUrl" = "audioDataUrl" || ${parsed}
    WHERE id = ${id} AND "orgId" = ${orgId} AND "uploadComplete" = false
  `;
}

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

async function newBeatShareToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(16).toString("base64url");
    const existing = await db.beat.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Could not generate unique beat share token");
}

export async function enableBeatShare(id: string) {
  const { orgId } = await requireMusicPack();
  const beat = await db.beat.findFirst({
    where: { id, orgId },
    select: { shareToken: true },
  });
  if (!beat) return { token: null };
  if (beat.shareToken) return { token: beat.shareToken };
  const token = await newBeatShareToken();
  await db.beat.updateMany({
    where: { id, orgId },
    data: { shareToken: token },
  });
  revalidateBeatPaths(id);
  return { token };
}

export async function disableBeatShare(id: string) {
  const { orgId } = await requireMusicPack();
  await db.beat.updateMany({
    where: { id, orgId },
    data: { shareToken: null },
  });
  revalidateBeatPaths(id);
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

export async function beginBeatTake(beatId: string, payload: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeginBeatTakeSchema.parse(payload);
  const beat = await db.beat.findFirst({
    where: { id: beatId, orgId },
    select: { id: true },
  });
  if (!beat) throw new Error("Beat not found");
  const layers = await ensureBeatVocalLayers(orgId, beatId);
  const layer = parsed.layerId
    ? layers.find((item) => item.id === parsed.layerId)
    : layers[0];
  if (!layer) throw new Error("Layer not found");
  const count = await db.beatTake.count({ where: { beatId, orgId } });
  if (count >= 30) throw new Error("Up to 30 takes per beat");
  const take = await db.beatTake.create({
    data: {
      orgId,
      beatId,
      name: parsed.name,
      audioDataUrl: "",
      audioMimeType: parsed.audioMimeType,
      durationSec: parsed.durationSec,
      offsetMs: parsed.offsetMs,
      layerId: layer.id,
      uploadComplete: false,
    },
  });
  return { id: take.id };
}

export async function appendBeatTakeChunk(id: string, chunk: string) {
  const { orgId } = await requireMusicPack();
  await appendBeatTakeChunkForOrg(id, orgId, chunk);
}

export async function finishBeatTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.beatTake.findFirst({
    where: { id, orgId, uploadComplete: false },
    select: {
      id: true,
      beatId: true,
      name: true,
      audioDataUrl: true,
      audioMimeType: true,
      durationSec: true,
      offsetMs: true,
      gain: true,
      muted: true,
      layerId: true,
      createdAt: true,
    },
  });
  if (!take || !take.audioDataUrl.startsWith("data:audio/") || take.audioDataUrl.length <= 100) {
    throw new Error("Incomplete audio upload.");
  }
  await db.beatTake.updateMany({
    where: { id, orgId, uploadComplete: false },
    data: { uploadComplete: true },
  });
  await db.beatTake.deleteMany({
    where: {
      beatId: take.beatId,
      orgId,
      uploadComplete: false,
      createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  revalidatePath(`/songs/beats/${take.beatId}`);
  return {
    id: take.id,
    name: take.name,
    audioMimeType: take.audioMimeType,
    durationSec: take.durationSec,
    offsetMs: take.offsetMs,
    gain: take.gain,
    muted: take.muted,
    layerId: take.layerId,
    createdAt: take.createdAt,
  };
}

export async function discardBeatTake(id: string) {
  const { orgId } = await requireMusicPack();
  await db.beatTake.deleteMany({ where: { id, orgId, uploadComplete: false } });
}

export async function updateBeatTake(id: string, patch: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatTakePatchSchema.parse(patch);
  const take = await db.beatTake.findFirst({
    where: { id, orgId },
    select: { beatId: true },
  });
  if (!take) return;
  if (parsed.layerId) {
    const layer = await db.beatVocalLayer.findFirst({
      where: { id: parsed.layerId, orgId, beatId: take.beatId },
      select: { id: true },
    });
    if (!layer) throw new Error("Layer not found");
  }
  await db.beatTake.updateMany({
    where: { id, orgId },
    data: parsed,
  });
  revalidatePath(`/songs/beats/${take.beatId}`);
}

export async function createBeatVocalLayer(beatId: string, name: string) {
  const { orgId } = await requireMusicPack();
  const parsed = z.string().trim().min(1).max(40).parse(name);
  const beat = await db.beat.findFirst({
    where: { id: beatId, orgId },
    select: { id: true },
  });
  if (!beat) throw new Error("Beat not found");
  const count = await db.beatVocalLayer.count({ where: { beatId, orgId } });
  if (count >= 8) throw new Error("Up to 8 layers per beat");
  const layer = await db.beatVocalLayer.create({
    data: { orgId, beatId, name: parsed, sortOrder: count },
    select: { id: true, name: true, gain: true, pan: true, muted: true, solo: true, sortOrder: true },
  });
  revalidateBeatPaths(beatId);
  return layer;
}

export async function updateBeatVocalLayer(id: string, patch: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatVocalLayerPatchSchema.parse(patch);
  const layer = await db.beatVocalLayer.findFirst({
    where: { id, orgId },
    select: { beatId: true },
  });
  if (!layer) return;
  await db.beatVocalLayer.updateMany({ where: { id, orgId }, data: parsed });
  revalidateBeatPaths(layer.beatId);
}

export async function deleteBeatVocalLayer(id: string) {
  const { orgId } = await requireMusicPack();
  const layer = await db.beatVocalLayer.findFirst({
    where: { id, orgId },
    select: { beatId: true },
  });
  if (!layer) return;
  const layers = await db.beatVocalLayer.findMany({
    where: { beatId: layer.beatId, orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (layers.length <= 1) throw new Error("Keep at least one layer");
  const target = layers.find((item) => item.id !== id);
  if (!target) throw new Error("Keep at least one layer");
  await db.$transaction([
    db.beatTake.updateMany({ where: { beatId: layer.beatId, orgId, layerId: id }, data: { layerId: target.id } }),
    db.beatVocalLayer.deleteMany({ where: { id, orgId } }),
  ]);
  revalidateBeatPaths(layer.beatId);
}

export async function deleteBeatTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.beatTake.findFirst({
    where: { id, orgId },
    select: { beatId: true },
  });
  if (!take) return;
  await db.beatTake.deleteMany({ where: { id, orgId } });
  revalidatePath(`/songs/beats/${take.beatId}`);
}
