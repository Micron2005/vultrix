import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, type CurrentUser } from "@/lib/session";
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
  if (user.accountType !== "PERSONAL" || !user.orgId || !user.focusPacks.includes("music")) {
    redirect("/");
  }
  return { user, orgId: user.orgId };
}

export async function listSongs(orgId: string) {
  return db.song.findMany({
    where: { orgId },
    orderBy: [{ updatedAt: "desc" }, { sortOrder: "asc" }],
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
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
    where: { id, orgId },
    include: {
      tasks: { orderBy: { sortOrder: "asc" } },
      ideas: { orderBy: { createdAt: "desc" } },
      beats: { orderBy: { updatedAt: "desc" } },
    },
  });
}

export async function moveSong(orgId: string, id: string, stage: SongStage) {
  const existing = await db.song.findFirst({
    where: { id, orgId },
    select: { releasedAt: true },
  });
  if (!existing) return;
  return db.song.updateMany({
    where: { id, orgId },
    data: {
      stage,
      releasedAt:
        stage === "RELEASED" ? existing.releasedAt ?? new Date() : existing.releasedAt,
    },
  });
}
