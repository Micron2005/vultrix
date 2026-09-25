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

const BeatTakeSaveSchema = z.object({
  name: z.string().trim().min(1).max(60),
  audioDataUrl: z.string().startsWith("data:audio/").max(14_000_000),
  audioMimeType: z.string().max(60),
  durationSec: z.number().int().min(1).max(900),
  offsetMs: z.number().int().min(-2000).max(2000),
});

const BeatTakePatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  offsetMs: z.number().int().min(-2000).max(2000).optional(),
  gain: z.number().int().min(0).max(150).optional(),
  muted: z.boolean().optional(),
}).partial();

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

export async function saveBeatTake(beatId: string, payload: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatTakeSaveSchema.parse(payload);
  const beat = await db.beat.findFirst({
    where: { id: beatId, orgId },
    select: { id: true },
  });
  if (!beat) throw new Error("Beat not found");
  const count = await db.beatTake.count({ where: { beatId, orgId } });
  if (count >= 30) throw new Error("Up to 30 takes per beat");
  const take = await db.beatTake.create({
    data: {
      orgId,
      beatId,
      name: parsed.name,
      audioDataUrl: parsed.audioDataUrl,
      audioMimeType: parsed.audioMimeType,
      durationSec: parsed.durationSec,
      offsetMs: parsed.offsetMs,
    },
  });
  revalidatePath(`/songs/beats/${beatId}`);
  return {
    id: take.id,
    name: take.name,
    audioMimeType: take.audioMimeType,
    durationSec: take.durationSec,
    offsetMs: take.offsetMs,
    gain: take.gain,
    muted: take.muted,
    createdAt: take.createdAt,
  };
}

export async function updateBeatTake(id: string, patch: unknown) {
  const { orgId } = await requireMusicPack();
  const parsed = BeatTakePatchSchema.parse(patch);
  const take = await db.beatTake.findFirst({
    where: { id, orgId },
    select: { beatId: true },
  });
  if (!take) return;
  await db.beatTake.updateMany({
    where: { id, orgId },
    data: parsed,
  });
  revalidatePath(`/songs/beats/${take.beatId}`);
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
