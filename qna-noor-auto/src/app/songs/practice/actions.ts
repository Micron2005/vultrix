"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMusicPack } from "@/lib/songs";

const PracticeSchema = z.object({
  durationSec: z.string(),
  bpm: z.string().optional(),
  songId: z.string().optional(),
  notes: z.string().optional(),
});

async function validSongId(orgId: string, raw: string | null) {
  if (!raw) return null;
  const song = await db.song.findFirst({
    where: { id: raw, orgId },
    select: { id: true },
  });
  return song?.id ?? null;
}

function parseBpm(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const bpm = Number(raw);
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) {
    throw new Error("BPM must be between 40 and 240.");
  }
  return bpm;
}

async function createPractice(
  formData: FormData,
  durationSec: number,
) {
  const { orgId } = await requireMusicPack();
  if (!Number.isInteger(durationSec) || durationSec < 30 || durationSec > 14400) {
    throw new Error("Practice sessions must be between 30 seconds and 4 hours.");
  }
  const parsed = PracticeSchema.parse({
    durationSec: String(durationSec),
    bpm: String(formData.get("bpm") ?? ""),
    songId: String(formData.get("songId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  const songId = await validSongId(orgId, String(parsed.songId ?? "").trim() || null);
  await db.practiceSession.create({
    data: {
      orgId,
      songId,
      startedAt: new Date(Date.now() - durationSec * 1000),
      durationSec,
      bpm: parseBpm(parsed.bpm),
      notes: parsed.notes?.trim() || null,
    },
  });
  revalidatePath("/songs/practice");
  revalidatePath("/");
}

export async function logPractice(formData: FormData) {
  const rawDuration = String(formData.get("durationSec") ?? "").trim();
  const durationSec = Number(rawDuration);
  await createPractice(formData, durationSec);
}

export async function logManualPractice(formData: FormData) {
  const minutes = Number(formData.get("minutes") ?? "");
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error("Enter between 1 and 240 minutes.");
  }
  await createPractice(formData, minutes * 60);
}

export async function deletePractice(id: string) {
  const { orgId } = await requireMusicPack();
  await db.practiceSession.deleteMany({ where: { id, orgId } });
  revalidatePath("/songs/practice");
  revalidatePath("/");
}
