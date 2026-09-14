"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMusicPack } from "@/lib/songs";

const MAX_AUDIO_DATA_URL_LENGTH = 4_000_000;

const IdeaSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  songId: z.string().optional(),
  audioDataUrl: z.string().optional(),
  audioMimeType: z.string().optional(),
  durationSec: z.string().optional(),
});

function ideaData(formData: FormData) {
  const parsed = IdeaSchema.parse(Object.fromEntries(formData.entries()));
  const title = parsed.title?.trim() || null;
  const body = parsed.body?.trim() || null;
  const audioDataUrl = parsed.audioDataUrl?.trim() || null;
  const audioMimeType = parsed.audioMimeType?.trim() || null;
  const durationSec = parsed.durationSec?.trim()
    ? Number.parseInt(parsed.durationSec, 10)
    : null;

  if (!body && !audioDataUrl) {
    throw new Error("Add some text or record a voice memo before saving.");
  }
  if (audioDataUrl) {
    if (
      !audioDataUrl.startsWith("data:audio/") ||
      audioDataUrl.length > MAX_AUDIO_DATA_URL_LENGTH
    ) {
      throw new Error("That voice memo is too large or is not a supported audio file.");
    }
  }
  if (
    durationSec !== null &&
    (!Number.isFinite(durationSec) || durationSec < 0 || durationSec > 120)
  ) {
    throw new Error("Voice memos must be two minutes or shorter.");
  }

  return {
    title,
    body,
    audioDataUrl,
    audioMimeType,
    durationSec,
  };
}

async function validSongId(orgId: string, rawSongId: string | null) {
  if (!rawSongId) return null;
  const song = await db.song.findFirst({
    where: { id: rawSongId, orgId },
    select: { id: true },
  });
  return song?.id ?? null;
}

function revalidateIdeaPaths(songId?: string | null) {
  revalidatePath("/songs/ideas");
  if (songId) revalidatePath(`/songs/${songId}`);
  revalidatePath("/songs");
}

export async function createIdea(formData: FormData) {
  const { orgId } = await requireMusicPack();
  const data = ideaData(formData);
  const requestedSongId = String(formData.get("songId") ?? "").trim() || null;
  const songId = await validSongId(orgId, requestedSongId);
  await db.songIdea.create({
    data: {
      orgId,
      ...data,
      songId,
    },
  });
  revalidateIdeaPaths(songId);
}

export async function updateIdea(id: string, formData: FormData) {
  const { orgId } = await requireMusicPack();
  const parsed = IdeaSchema.pick({
    title: true,
    body: true,
    songId: true,
  }).parse(Object.fromEntries(formData.entries()));
  const existing = await db.songIdea.findFirst({
    where: { id, orgId },
    select: { songId: true },
  });
  const songId = await validSongId(orgId, parsed.songId?.trim() || null);
  await db.songIdea.updateMany({
    where: { id, orgId },
    data: {
      title: parsed.title?.trim() || null,
      body: parsed.body?.trim() || null,
      songId,
    },
  });
  revalidateIdeaPaths(existing?.songId);
  revalidateIdeaPaths(songId);
}

export async function deleteIdea(id: string) {
  const { orgId } = await requireMusicPack();
  const existing = await db.songIdea.findFirst({
    where: { id, orgId },
    select: { songId: true },
  });
  await db.songIdea.deleteMany({ where: { id, orgId } });
  revalidateIdeaPaths(existing?.songId);
}
