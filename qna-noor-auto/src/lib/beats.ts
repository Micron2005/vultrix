import { db } from "@/lib/db";
import { beatAccessWhere } from "@/lib/songAccess";

export async function ensureBeatVocalLayers(orgId: string, beatId: string) {
  const beat = await db.beat.findFirst({
    where: { id: beatId, ...beatAccessWhere(orgId) },
    select: { id: true, orgId: true },
  });
  if (!beat) return [];
  let layers = await db.beatVocalLayer.findMany({
    where: { orgId: beat.orgId, beatId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (layers.length > 0) return layers;
  const layer = await db.beatVocalLayer.create({
    data: { orgId: beat.orgId, beatId, name: "Lead", sortOrder: 0 },
  });
  await db.beatTake.updateMany({
    where: { orgId: beat.orgId, beatId, layerId: null },
    data: { layerId: layer.id },
  });
  layers = [layer];
  return layers;
}

export async function listBeats(orgId: string) {
  return db.beat.findMany({
    where: beatAccessWhere(orgId),
    orderBy: { updatedAt: "desc" },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function getBeat(orgId: string, id: string) {
  return db.beat.findFirst({
    where: { id, ...beatAccessWhere(orgId) },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function listBeatTakes(orgId: string, beatId: string) {
  const beat = await db.beat.findFirst({
    where: { id: beatId, ...beatAccessWhere(orgId) },
    select: { orgId: true },
  });
  if (!beat) return [];
  return db.beatTake.findMany({
    where: { orgId: beat.orgId, beatId, uploadComplete: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      audioMimeType: true,
      durationSec: true,
      offsetMs: true,
      gain: true,
      muted: true,
      layerId: true,
      trimStartMs: true,
      trimEndMs: true,
      createdAt: true,
    },
  });
}

export async function listBeatVocalLayers(orgId: string, beatId: string) {
  const beat = await db.beat.findFirst({
    where: { id: beatId, ...beatAccessWhere(orgId) },
    select: { orgId: true },
  });
  if (!beat) return [];
  return db.beatVocalLayer.findMany({
    where: { orgId: beat.orgId, beatId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      gain: true,
      pan: true,
      muted: true,
      solo: true,
      reverb: true,
      eqLow: true,
      eqHigh: true,
      compress: true,
      doubler: true,
      sortOrder: true,
    },
  });
}
