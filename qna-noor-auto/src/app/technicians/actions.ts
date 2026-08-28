"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const TechSchema = z.object({
  name: z.string().min(1, "Name is required"),
  initials: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
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
    role: cleanStr(raw.role),
    defaultRate: parseFloatOrNull(raw.defaultRate),
    active: raw.active !== "off" && raw.active !== "false" && raw.active !== null,
    notes: cleanStr(raw.notes),
  };
}

export async function createTechnician(fd: FormData) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const data = toData(fd);
  const created = await db.technician.create({ data: { ...data, orgId } });
  await logActivity({
    orgId,
    user,
    action: "technician.create",
    entity: "Technician",
    entityId: created.id,
    summary: `Technician ${created.name} created`,
  });
  revalidatePath("/technicians");
  revalidatePath("/repair-orders");
  redirect(`/technicians/${created.id}`);
}

export async function updateTechnician(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);
  await db.technician.updateMany({ where: { id, orgId }, data });
  revalidatePath("/technicians");
  revalidatePath(`/technicians/${id}`);
  revalidatePath("/repair-orders");
  redirect(`/technicians/${id}`);
}

export async function deleteTechnician(id: string) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const owned = await db.technician.findFirst({
    where: { id, orgId },
    select: { id: true, name: true },
  });
  if (!owned) redirect("/technicians");
  const assignedLines = await db.laborLineTech.findMany({
    where: { technicianId: id },
    select: { laborLineId: true },
  });
  await db.$transaction(async (tx) => {
    // Null out scalar references first (preserve historical labor lines).
    await tx.laborLine.updateMany({
      where: { technicianId: id },
      data: { technicianId: null },
    });
    await tx.laborLineTech.deleteMany({ where: { technicianId: id } });

    const remaining = await tx.laborLineTech.findMany({
      where: { laborLineId: { in: assignedLines.map((line) => line.laborLineId) } },
      orderBy: { technicianId: "asc" },
      select: { laborLineId: true, technicianId: true },
    });
    const primaryByLine = new Map<string, string>();
    for (const assignment of remaining) {
      if (!primaryByLine.has(assignment.laborLineId)) {
        primaryByLine.set(assignment.laborLineId, assignment.technicianId);
      }
    }
    for (const [laborLineId, technicianId] of primaryByLine) {
      await tx.laborLine.update({
        where: { id: laborLineId },
        data: { technicianId },
      });
    }
    await tx.technician.delete({ where: { id } });
  });
  await logActivity({
    orgId,
    user,
    action: "technician.delete",
    entity: "Technician",
    entityId: owned.id,
    summary: `Technician ${owned.name} deleted`,
  });
  revalidatePath("/technicians");
  revalidatePath("/repair-orders");
  redirect("/technicians");
}

export async function toggleActive(id: string, active: boolean) {
  const orgId = await requireOrgId();
  await db.technician.updateMany({ where: { id, orgId }, data: { active } });
  revalidatePath("/technicians");
  revalidatePath(`/technicians/${id}`);
}
