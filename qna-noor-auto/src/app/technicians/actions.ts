"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const TechSchema = z.object({
  name: z.string().min(1, "Name is required"),
  initials: z.string().optional().nullable(),
  defaultRate: z.string().optional().nullable(),
  active: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function cleanStr(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function parseFloatOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function autoInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function toData(fd: FormData) {
  const raw = TechSchema.parse(Object.fromEntries(fd.entries()));
  const name = raw.name.trim();
  const initials = cleanStr(raw.initials)?.toUpperCase().slice(0, 4) ?? autoInitials(name);
  return {
    name,
    initials,
    defaultRate: parseFloatOrNull(raw.defaultRate),
    active: raw.active !== "off" && raw.active !== "false" && raw.active !== null,
    notes: cleanStr(raw.notes),
  };
}

export async function createTechnician(fd: FormData) {
  const data = toData(fd);
  const created = await db.technician.create({ data });
  revalidatePath("/technicians");
  revalidatePath("/repair-orders");
  redirect(`/technicians/${created.id}`);
}

export async function updateTechnician(id: string, fd: FormData) {
  const data = toData(fd);
  await db.technician.update({ where: { id }, data });
  revalidatePath("/technicians");
  revalidatePath(`/technicians/${id}`);
  revalidatePath("/repair-orders");
  redirect(`/technicians/${id}`);
}

export async function deleteTechnician(id: string) {
  // Null out labor-line references first (preserve historical labor lines).
  await db.laborLine.updateMany({
    where: { technicianId: id },
    data: { technicianId: null },
  });
  await db.technician.delete({ where: { id } });
  revalidatePath("/technicians");
  revalidatePath("/repair-orders");
  redirect("/technicians");
}

export async function toggleActive(id: string, active: boolean) {
  await db.technician.update({ where: { id }, data: { active } });
  revalidatePath("/technicians");
  revalidatePath(`/technicians/${id}`);
}
