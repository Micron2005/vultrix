import { db } from "@/lib/db";

export async function listBeats(orgId: string) {
  return db.beat.findMany({
    where: { orgId },
    orderBy: { updatedAt: "desc" },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function getBeat(orgId: string, id: string) {
  return db.beat.findFirst({
    where: { id, orgId },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function listBeatTakes(orgId: string, beatId: string) {
  return db.beatTake.findMany({
    where: { orgId, beatId, uploadComplete: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      audioMimeType: true,
      durationSec: true,
      offsetMs: true,
      gain: true,
      muted: true,
      createdAt: true,
    },
  });
}
