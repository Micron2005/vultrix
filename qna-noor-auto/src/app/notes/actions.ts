"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

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
});

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
  };
}

export async function createNote(fd: FormData) {
  const data = toData(fd);
  const created = await db.repairNote.create({ data });
  revalidatePath("/notes");
  redirect(`/notes/${created.id}`);
}

export async function updateNote(id: string, fd: FormData) {
  const data = toData(fd);
  await db.repairNote.update({ where: { id }, data });
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  redirect(`/notes/${id}`);
}

export async function deleteNote(id: string) {
  await db.repairNote.delete({ where: { id } });
  revalidatePath("/notes");
  redirect("/notes");
}
