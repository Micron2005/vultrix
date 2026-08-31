"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { createNoteForOrg } from "@/lib/notes";
import { assertCanDelete } from "@/lib/permissions";

const NoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  yearMin: z.string().optional().nullable(),
  yearMax: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  engine: z.string().optional().nullable(),
  symptom: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  fix: z.string().optional().nullable(),
  partsNotes: z.string().optional().nullable(),
  laborHoursEstimate: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

type NoteImageInput = { dataUrl: string; caption?: string | null };
const MAX_NOTE_IMAGES = 12;
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;

function parseYear(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return n;
}

function parseFloatOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeTags(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;
  // de-dupe, preserve order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out.join(",");
}

function parseImages(raw: FormDataEntryValue | null): NoteImageInput[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, MAX_NOTE_IMAGES).flatMap((item): NoteImageInput[] => {
    if (!item || typeof item !== "object") return [];
    const dataUrl = "dataUrl" in item && typeof item.dataUrl === "string"
      ? item.dataUrl
      : "";
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return [];
    }
    const caption = "caption" in item && typeof item.caption === "string"
      ? item.caption.trim().slice(0, 500) || null
      : null;
    return [{ dataUrl, caption }];
  });
}

function toData(fd: FormData) {
  const raw = NoteSchema.parse(Object.fromEntries(fd.entries()));
  const clean = (s: string | null | undefined) => {
    if (s == null) return null;
    const t = String(s).trim();
    return t === "" ? null : t;
  };
  return {
    title: raw.title.trim(),
    yearMin: parseYear(raw.yearMin),
    yearMax: parseYear(raw.yearMax),
    make: clean(raw.make),
    model: clean(raw.model),
    engine: clean(raw.engine),
    symptom: clean(raw.symptom),
    diagnosis: clean(raw.diagnosis),
    fix: clean(raw.fix),
    partsNotes: clean(raw.partsNotes),
    laborHoursEstimate: parseFloatOrNull(raw.laborHoursEstimate),
    tags: normalizeTags(raw.tags),
    category: clean(raw.category),
  };
}

export async function createNote(fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);
  const images = parseImages(fd.get("images"));
  const created = await createNoteForOrg(orgId, data);
  if (images.length > 0) {
    await db.noteImage.createMany({
      data: images.map((image, sortOrder) => ({ ...image, noteId: created.id, orgId, sortOrder })),
    });
  }
  revalidatePath("/notes");
  redirect(`/notes/${created.id}`);
}

export async function updateNote(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);
  const images = parseImages(fd.get("images"));
  await db.$transaction(async (tx) => {
    const result = await tx.repairNote.updateMany({ where: { id, orgId }, data });
    if (result.count === 0) return;
    await tx.noteImage.deleteMany({ where: { noteId: id, orgId } });
    if (images.length > 0) {
      await tx.noteImage.createMany({
        data: images.map((image, sortOrder) => ({ ...image, noteId: id, orgId, sortOrder })),
      });
    }
  });
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  redirect(`/notes/${id}`);
}

export async function deleteNote(id: string) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  assertCanDelete(user.role);
  await db.repairNote.deleteMany({ where: { id, orgId } });
  revalidatePath("/notes");
  redirect("/notes");
}
