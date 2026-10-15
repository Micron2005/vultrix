"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { beatAccessWhere, songAccessWhere } from "@/lib/songAccess";
import { requireMusicPack } from "@/lib/songs";
import { formatClock, hasExactlyOneTakeId, takeTargetIds, type TakeKind } from "@/lib/takeNotes";
import { notify } from "@/lib/notifications";

const TakeTargetSchema = z.object({
  kind: z.enum(["song", "beat"]),
  takeId: z.string().min(1).max(40),
});

const AddNoteSchema = TakeTargetSchema.extend({
  atMs: z.number().int().min(0),
  text: z.string().trim().min(1).max(300),
});

type AccessibleTake =
  | {
      kind: "song";
      id: string;
      orgId: string;
      name: string;
      durationSec: number;
      song: { id: string; orgId: string; members: Array<{ orgId: string }> };
    }
  | {
      kind: "beat";
      id: string;
      orgId: string;
      name: string;
      durationSec: number;
      beat: {
        id: string;
        orgId: string;
        song: { id: string; orgId: string; members: Array<{ orgId: string }> } | null;
      };
    };

async function accessibleTake(orgId: string, kind: TakeKind, takeId: string): Promise<AccessibleTake | null> {
  if (kind === "song") {
    const take = await db.songVocalTake.findFirst({
      where: { id: takeId, uploadComplete: true, song: songAccessWhere(orgId) },
      select: {
        id: true,
        orgId: true,
        name: true,
        durationSec: true,
        song: { select: { id: true, orgId: true, members: { select: { orgId: true } } } },
      },
    });
    return take ? { ...take, kind: "song" } : null;
  }

  const take = await db.beatTake.findFirst({
    where: { id: takeId, uploadComplete: true, beat: beatAccessWhere(orgId) },
    select: {
      id: true,
      orgId: true,
      name: true,
      durationSec: true,
      beat: {
        select: {
          id: true,
          orgId: true,
          song: { select: { id: true, orgId: true, members: { select: { orgId: true } } } },
        },
      },
    },
  });
  return take ? { ...take, kind: "beat" } : null;
}

function revalidateTake(take: AccessibleTake) {
  revalidatePath("/songs");
  if (take.kind === "song") {
    revalidatePath(`/songs/${take.song.id}`);
    revalidatePath("/songs/lyrics");
  } else {
    revalidatePath(`/songs/beats/${take.beat.id}`);
    if (take.beat.song) revalidatePath(`/songs/${take.beat.song.id}`);
  }
}

export async function listTakeNotes(kind: TakeKind, takeId: string) {
  const { orgId } = await requireMusicPack();
  const target = TakeTargetSchema.safeParse({ kind, takeId });
  if (!target.success) return [];
  const take = await accessibleTake(orgId, target.data.kind, target.data.takeId);
  if (!take) return [];
  const fk = takeTargetIds(take.kind, take.id);
  if (!hasExactlyOneTakeId(fk)) return [];
  const notes = await db.takeNote.findMany({
    where: fk,
    orderBy: [{ atMs: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      authorOrgId: true,
      authorName: true,
      atMs: true,
      text: true,
      resolved: true,
      createdAt: true,
    },
  });
  return notes.map(({ authorOrgId, ...note }) => ({
    ...note,
    createdAt: note.createdAt.toISOString(),
    canDelete: authorOrgId === orgId || take.orgId === orgId,
  }));
}

export async function addTakeNote(kind: TakeKind, takeId: string, atMs: number, text: string) {
  const { user, orgId } = await requireMusicPack();
  const parsed = AddNoteSchema.safeParse({ kind, takeId, atMs, text });
  if (!parsed.success) throw new Error("Enter a valid time and a note of 1–300 characters.");
  const take = await accessibleTake(orgId, parsed.data.kind, parsed.data.takeId);
  if (!take || parsed.data.atMs > take.durationSec * 1000) return null;
  const fk = takeTargetIds(take.kind, take.id);
  if (!hasExactlyOneTakeId(fk)) return null;
  const count = await db.takeNote.count({ where: fk });
  if (count >= 100) throw new Error("This take already has 100 notes.");
  const author = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, profile: { select: { displayName: true } } },
  });
  const authorName = author?.profile?.displayName ?? author?.name ?? user.orgName ?? "Someone";
  const note = await db.takeNote.create({
    data: {
      ...fk,
      orgId: take.orgId,
      authorOrgId: orgId,
      authorName,
      atMs: parsed.data.atMs,
      text: parsed.data.text,
    },
    select: {
      id: true,
      authorName: true,
      atMs: true,
      text: true,
      resolved: true,
      createdAt: true,
    },
  });

  const song = take.kind === "song" ? take.song : take.beat.song;
  const recipientOrgIds = new Set(
    song ? [song.orgId, ...song.members.map((member) => member.orgId)] : [take.orgId],
  );
  recipientOrgIds.delete(orgId);
  const title = `${authorName} left a note on “${take.name}” at ${formatClock(parsed.data.atMs)}`;
  const href = song ? `/songs/${song.id}` : `/songs/beats/${take.kind === "beat" ? take.beat.id : ""}`;
  await Promise.all(
    [...recipientOrgIds].map((recipientOrgId) =>
      notify({ orgId: recipientOrgId, kind: "take_note", title, href, dedupeKey: title }),
    ),
  );
  revalidateTake(take);
  return { ...note, createdAt: note.createdAt.toISOString(), canDelete: true };
}

async function accessibleNote(orgId: string, id: string) {
  const note = await db.takeNote.findUnique({
    where: { id },
    select: { id: true, orgId: true, authorOrgId: true, songTakeId: true, beatTakeId: true },
  });
  if (!note || !hasExactlyOneTakeId(note)) return null;
  const kind = note.songTakeId ? "song" : "beat";
  const take = await accessibleTake(orgId, kind, (note.songTakeId ?? note.beatTakeId)!);
  return take ? { note, take } : null;
}

export async function setTakeNoteResolved(id: string, resolved: boolean) {
  const { orgId } = await requireMusicPack();
  const parsed = z.object({ id: z.string().min(1).max(40), resolved: z.boolean() }).safeParse({ id, resolved });
  if (!parsed.success) return;
  const target = await accessibleNote(orgId, parsed.data.id);
  if (!target) return;
  await db.takeNote.updateMany({ where: { id: target.note.id }, data: { resolved: parsed.data.resolved } });
  revalidateTake(target.take);
}

export async function deleteTakeNote(id: string) {
  const { orgId } = await requireMusicPack();
  const parsed = z.string().min(1).max(40).safeParse(id);
  if (!parsed.success) return;
  const target = await accessibleNote(orgId, parsed.data);
  if (!target || (target.note.authorOrgId !== orgId && target.note.orgId !== orgId)) return;
  await db.takeNote.deleteMany({ where: { id: target.note.id } });
  revalidateTake(target.take);
}
