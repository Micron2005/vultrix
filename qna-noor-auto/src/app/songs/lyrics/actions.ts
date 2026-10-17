"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LineFlowSchema, parseLyricsMeta } from "@/lib/lyrics";
import { requireMusicPack } from "@/lib/songs";
import { beatAccessWhere, songAccessWhere } from "@/lib/songAccess";
import { ensureBeatVocalLayers } from "@/lib/beats";
import { saveLyricsText } from "../actions";

const BeginSongVocalTakeSchema = z.object({
  name: z.string().trim().min(1).max(60),
  audioMimeType: z.string().max(60),
  durationSec: z.number().int().min(1).max(900),
});

const TakeNameSchema = z.string().trim().min(1).max(60);
const UploadChunkSchema = z.string().min(1).max(3_000_000);
const RhymeWordSchema = z.string().trim().min(1).max(40);
const DraftNameSchema = z.string().trim().min(1).max(60);
const DraftLyricsSchema = z.string().max(20_000);
const FlowLineTextSchema = z.string().trim().min(1).max(20_000);
const FlowLineTextsSchema = z.array(FlowLineTextSchema).max(200);

function revalidateLyricsFlow(songId: string) {
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/songs/practice");
  revalidatePath("/songs");
  revalidatePath("/");
  revalidatePath("/songs/lyrics");
}

async function readSongLyricsMeta(songId: string, orgId: string) {
  const song = await db.song.findFirst({
    where: { id: songId, ...songAccessWhere(orgId) },
    select: { lyricsMeta: true },
  });
  if (!song) throw new Error("Song not found.");
  return parseLyricsMeta(song.lyricsMeta);
}

async function writeSongLyricsMeta(
  songId: string,
  orgId: string,
  lines: ReturnType<typeof parseLyricsMeta>["lines"],
) {
  if (Object.keys(lines).length > 200) {
    throw new Error("Lyrics can have at most 200 line settings.");
  }
  await db.song.updateMany({
    where: { id: songId, ...songAccessWhere(orgId) },
    data: { lyricsMeta: JSON.stringify({ v: 1, lines }) },
  });
  revalidateLyricsFlow(songId);
}

export async function saveLineFlow(songId: string, lineText: string, flow: unknown | null) {
  const { orgId } = await requireMusicPack();
  const text = FlowLineTextSchema.parse(lineText);
  const parsedFlow = flow === null ? null : LineFlowSchema.parse(flow);
  const meta = await readSongLyricsMeta(songId, orgId);
  const lines = { ...meta.lines };
  const current = { ...(lines[text] ?? {}) };
  if (parsedFlow) current.flow = parsedFlow;
  else delete current.flow;
  if (Object.keys(current).length) lines[text] = current;
  else delete lines[text];
  await writeSongLyricsMeta(songId, orgId, lines);
}

export async function applyFlowToLines(songId: string, flow: unknown, lineTexts: string[]) {
  const { orgId } = await requireMusicPack();
  const parsedFlow = LineFlowSchema.parse(flow);
  const texts = [...new Set(FlowLineTextsSchema.parse(lineTexts))];
  const meta = await readSongLyricsMeta(songId, orgId);
  const lines = { ...meta.lines };
  for (const text of texts) {
    lines[text] = { ...(lines[text] ?? {}), flow: parsedFlow };
  }
  await writeSongLyricsMeta(songId, orgId, lines);
}

export async function findRhymes(word: string) {
  await requireMusicPack();
  const parsed = RhymeWordSchema.parse(word);
  try {
    const encoded = encodeURIComponent(parsed);
    const [perfectResponse, nearResponse] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_rhy=${encoded}&max=40`, {
        signal: AbortSignal.timeout(5_000),
      }),
      fetch(`https://api.datamuse.com/words?rel_nry=${encoded}&max=20`, {
        signal: AbortSignal.timeout(5_000),
      }),
    ]);
    if (!perfectResponse.ok || !nearResponse.ok) throw new Error("Rhyme lookup failed");
    const [perfect, near] = await Promise.all([perfectResponse.json(), nearResponse.json()]);
    return {
      perfect: Array.isArray(perfect)
        ? perfect.map((item) => item?.word).filter((item): item is string => typeof item === "string")
        : [],
      near: Array.isArray(near)
        ? near.map((item) => item?.word).filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    throw new Error("Rhymes unavailable right now");
  }
}

export async function saveLyricDraft(songId: string, name: string, lyrics: string) {
  const { orgId } = await requireMusicPack();
  const parsedName = DraftNameSchema.parse(name);
  const parsedLyrics = DraftLyricsSchema.parse(lyrics);
  const song = await db.song.findFirst({
    where: { id: songId, ...songAccessWhere(orgId) },
    select: { id: true, orgId: true },
  });
  if (!song) throw new Error("Song not found.");
  const count = await db.songLyricDraft.count({
    where: { songId, song: songAccessWhere(orgId) },
  });
  if (count >= 30) throw new Error("Up to 30 drafts per song");
  const draft = await db.songLyricDraft.create({
    data: { orgId: song.orgId, songId, name: parsedName, lyrics: parsedLyrics },
    select: { id: true, name: true, lyrics: true, createdAt: true },
  });
  revalidatePath("/songs/lyrics");
  return draft;
}

export async function deleteLyricDraft(id: string) {
  const { orgId } = await requireMusicPack();
  await db.songLyricDraft.deleteMany({
    where: { id, song: songAccessWhere(orgId) },
  });
  revalidatePath("/songs/lyrics");
}

export async function restoreLyricDraft(id: string) {
  const { orgId } = await requireMusicPack();
  const draft = await db.songLyricDraft.findFirst({
    where: { id, song: songAccessWhere(orgId) },
    select: { songId: true, lyrics: true },
  });
  if (!draft) throw new Error("Draft not found");
  await saveLyricsText(draft.songId, draft.lyrics);
  return { lyrics: draft.lyrics };
}

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
    where: { id: songId, ...songAccessWhere(orgId) },
    select: { id: true, orgId: true },
  });
  if (!song) throw new Error("Song not found.");
  const count = await db.songVocalTake.count({
    where: { songId, song: songAccessWhere(orgId) },
  });
  if (count >= 30) throw new Error("Up to 30 takes per song.");
  const take = await db.songVocalTake.create({
    data: {
      orgId: song.orgId,
      songId,
      ...parsed,
      audioDataUrl: "",
      uploadComplete: false,
    },
  });
  return { id: take.id };
}

export async function appendSongVocalTakeChunk(id: string, chunk: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id, uploadComplete: false, song: songAccessWhere(orgId) },
    select: { orgId: true },
  });
  if (!take) throw new Error("Pending take not found.");
  await appendSongVocalTakeChunkForOrg(id, take.orgId, chunk);
}

export async function finishSongVocalTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id, uploadComplete: false, song: songAccessWhere(orgId) },
    select: {
      id: true,
      orgId: true,
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
    where: { id, uploadComplete: false, song: songAccessWhere(orgId) },
    data: { uploadComplete: true },
  });
  await db.songVocalTake.deleteMany({
    where: {
      songId: take.songId,
      orgId: take.orgId,
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
  await db.songVocalTake.deleteMany({
    where: { id, uploadComplete: false, song: songAccessWhere(orgId) },
  });
}

export async function renameSongVocalTake(id: string, name: string) {
  const { orgId } = await requireMusicPack();
  const parsed = TakeNameSchema.parse(name);
  const take = await db.songVocalTake.findFirst({
    where: { id, uploadComplete: true, song: songAccessWhere(orgId) },
    select: { songId: true },
  });
  if (!take) throw new Error("Take not found.");
  await db.songVocalTake.updateMany({
    where: { id, song: songAccessWhere(orgId) },
    data: { name: parsed },
  });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
}

export async function deleteSongVocalTake(id: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id, uploadComplete: true, song: songAccessWhere(orgId) },
    select: { songId: true },
  });
  if (!take) return;
  await db.songVocalTake.deleteMany({
    where: { id, song: songAccessWhere(orgId) },
  });
  revalidatePath("/songs/lyrics");
  revalidatePath(`/songs/${take.songId}`);
}

export async function copySongTakeToBeat(takeId: string, beatId: string, layerId?: string) {
  const { orgId } = await requireMusicPack();
  const take = await db.songVocalTake.findFirst({
    where: { id: takeId, uploadComplete: true, song: songAccessWhere(orgId) },
    select: { name: true, audioDataUrl: true, audioMimeType: true, durationSec: true },
  });
  const beat = await db.beat.findFirst({
    where: { id: beatId, ...beatAccessWhere(orgId) },
    select: { id: true, orgId: true },
  });
  if (!take || !beat) throw new Error("Take or beat not found.");
  const layers = await ensureBeatVocalLayers(orgId, beatId);
  const layer = layerId ? layers.find((item) => item.id === layerId) : layers[0];
  if (!layer) throw new Error("Layer not found");
  const count = await db.beatTake.count({
    where: { beatId, orgId: beat.orgId },
  });
  if (count >= 30) throw new Error("Up to 30 takes per beat.");
  const saved = await db.beatTake.create({
    data: {
      orgId: beat.orgId,
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
    trimStartMs: saved.trimStartMs,
    trimEndMs: saved.trimEndMs,
    createdAt: saved.createdAt,
  };
}
