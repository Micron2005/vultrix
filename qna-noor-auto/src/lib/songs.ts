import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
import { songAccessWhere } from "@/lib/songAccess";
import { SONG_STAGES, type SongStage } from "@/lib/songStages";
export { SONG_STAGES, type SongStage } from "@/lib/songStages";

export const DEFAULT_STAGE_TASKS: Record<SongStage, string[]> = {
  IDEA: ["Hook/concept", "Reference tracks"],
  WRITING: ["Lyrics", "Melody", "Structure"],
  DEMO: ["Rough arrangement", "Scratch vocals"],
  RECORDING: ["Vocals", "Instruments", "Comp takes"],
  MIX: ["Balance", "EQ/compression", "Reference check"],
  MASTER: ["Loudness", "Export WAV/MP3"],
  RELEASED: ["Artwork", "Metadata/ISRC", "Distributor upload", "Announce"],
};

export function isSongStage(value: string): value is SongStage {
  return SONG_STAGES.some((stage) => stage.id === value);
}

export async function requireMusicPack(): Promise<{
  user: CurrentUser;
  orgId: string;
}> {
  const user = await requireUser();
  if (!user.orgId || !user.focusPacks.includes("music")) {
    redirect("/");
  }
  if (!user.musicAccess.allowed) redirect("/songs/locked");
  return { user, orgId: user.orgId };
}

export async function listSongs(
  orgId: string,
  options: { includeShared?: boolean } = {},
) {
  return db.song.findMany({
    where: options.includeShared === false ? { orgId } : songAccessWhere(orgId),
    orderBy: [{ updatedAt: "desc" }, { sortOrder: "asc" }],
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      organization: {
        select: {
          name: true,
          profile: { select: { handle: true } },
        },
      },
      _count: { select: { beats: true, members: true } },
    },
  });
}

export async function listSongIdeas(orgId: string) {
  return db.songIdea.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function getSong(orgId: string, id: string) {
  return db.song.findFirst({
    where: { id, ...songAccessWhere(orgId) },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      ideas: { where: { orgId }, orderBy: { createdAt: "desc" } },
      vocalTakes: {
        where: { uploadComplete: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          durationSec: true,
          _count: { select: { takeNotes: true } },
        },
      },
      beats: {
        orderBy: { updatedAt: "desc" },
        include: {
          takes: {
            where: { uploadComplete: true },
            orderBy: { createdAt: "asc" },
            include: {
              layer: { select: { name: true } },
              _count: { select: { takeNotes: true } },
            },
          },
        },
      },
      organization: {
        select: {
          name: true,
          profile: { select: { id: true, handle: true, displayName: true } },
        },
      },
      members: {
        orderBy: { createdAt: "asc" },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              profile: { select: { handle: true, displayName: true } },
            },
          },
        },
      },
    },
  });
}

export async function moveSong(orgId: string, id: string, stage: SongStage) {
  const existing = await db.song.findFirst({
    where: { id, ...songAccessWhere(orgId) },
    select: { releasedAt: true },
  });
  if (!existing) return;
  return db.song.updateMany({
    where: { id, ...songAccessWhere(orgId) },
    data: {
      stage,
      releasedAt:
        stage === "RELEASED" ? existing.releasedAt ?? new Date() : existing.releasedAt,
    },
  });
}
