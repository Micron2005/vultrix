"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const PartSchema = z.object({
  partNumber: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  costPrice: z.string().optional().nullable(),
  unitPrice: z.string().optional().nullable(),
  qtyOnHand: z.string().optional().nullable(),
  reorderLevel: z.string().optional().nullable(),
  fitsMake: z.string().optional().nullable(),
  fitsModel: z.string().optional().nullable(),
  fitsYearMin: z.string().optional().nullable(),
  fitsYearMax: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  archived: z.string().optional().nullable(),
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
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toData(fd: FormData) {
  const raw = PartSchema.parse(Object.fromEntries(fd.entries()));
  return {
    partNumber: cleanStr(raw.partNumber),
    name: raw.name.trim(),
    description: cleanStr(raw.description),
    source: cleanStr(raw.source),
    costPrice: parseFloatOrNull(raw.costPrice),
    unitPrice: parseFloatOrNull(raw.unitPrice),
    qtyOnHand: parseFloatOrNull(raw.qtyOnHand) ?? 0,
    reorderLevel: parseFloatOrNull(raw.reorderLevel) ?? 0,
    fitsMake: cleanStr(raw.fitsMake),
    fitsModel: cleanStr(raw.fitsModel),
    fitsYearMin: parseIntOrNull(raw.fitsYearMin),
    fitsYearMax: parseIntOrNull(raw.fitsYearMax),
    notes: cleanStr(raw.notes),
    archived: raw.archived === "on" || raw.archived === "true",
  };
}

export async function createPart(fd: FormData) {
  const data = toData(fd);

  // Create part + initial StockMove together if an opening qty was given.
  const part = await db.part.create({ data: { ...data, qtyOnHand: 0 } });

  if (data.qtyOnHand !== 0) {
    await db.part.update({
      where: { id: part.id },
      data: { qtyOnHand: data.qtyOnHand },
    });
    await db.stockMove.create({
      data: {
        partId: part.id,
        delta: data.qtyOnHand,
        reason: "INITIAL",
        note: "Opening balance",
      },
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/");
  redirect(`/inventory/${part.id}`);
}

export async function updatePart(id: string, fd: FormData) {
  const data = toData(fd);

  // qtyOnHand is managed via stock moves — don't clobber it from the form here.
  const { qtyOnHand: _ignore, ...rest } = data;
  void _ignore;
  await db.part.update({ where: { id }, data: rest });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath("/");
  redirect(`/inventory/${id}`);
}

export async function deletePart(id: string) {
  // Null out partId on any historical PartLines (preserve historical invoices).
  await db.partLine.updateMany({
    where: { partId: id },
    data: { partId: null },
  });
  await db.part.delete({ where: { id } });
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect("/inventory");
}

export async function toggleArchived(id: string, archived: boolean) {
  await db.part.update({ where: { id }, data: { archived } });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
}

/**
 * Receive / adjust stock. Positive delta = received; negative = write-off.
 * Logs a StockMove row so the history is visible on the part page.
 */
export async function adjustStock(id: string, fd: FormData) {
  const deltaRaw = String(fd.get("delta") ?? "").trim();
  const reason = String(fd.get("reason") ?? "RECEIVE").trim() || "RECEIVE";
  const note = cleanStr(String(fd.get("note") ?? ""));

  const delta = parseFloat(deltaRaw);
  if (!Number.isFinite(delta) || delta === 0) {
    return;
  }

  await db.part.update({
    where: { id },
    data: { qtyOnHand: { increment: delta } },
  });
  await db.stockMove.create({
    data: {
      partId: id,
      delta,
      reason: reason === "RECEIVE" || reason === "ADJUST" ? reason : "ADJUST",
      note,
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath("/");
}

/**
 * Quick adjust from the mobile QR-scan page (`/s/<id>`). Accepts either
 * `delta` (relative +/- change) or `setTo` (absolute target count). Logs a
 * StockMove row so the audit trail on the part detail page stays intact.
 */
export async function scanAdjustStock(id: string, fd: FormData) {
  const deltaRaw = String(fd.get("delta") ?? "").trim();
  const setToRaw = String(fd.get("setTo") ?? "").trim();
  const reason = String(fd.get("reason") ?? "ADJUST").trim() || "ADJUST";
  const note = cleanStr(String(fd.get("note") ?? ""));

  // Resolve to a relative delta so the StockMove log always records a change.
  let delta: number | null = null;
  if (setToRaw !== "") {
    const target = parseFloat(setToRaw);
    if (!Number.isFinite(target)) return;
    const part = await db.part.findUnique({
      where: { id },
      select: { qtyOnHand: true },
    });
    if (!part) return;
    delta = target - part.qtyOnHand;
  } else if (deltaRaw !== "") {
    const d = parseFloat(deltaRaw);
    if (!Number.isFinite(d)) return;
    delta = d;
  }

  if (delta == null || delta === 0) {
    redirect(`/s/${id}`);
  }

  await db.part.update({
    where: { id },
    data: { qtyOnHand: { increment: delta } },
  });
  await db.stockMove.create({
    data: {
      partId: id,
      delta,
      reason:
        reason === "USE_RO" ||
        reason === "RECEIVE" ||
        reason === "ADJUST" ||
        reason === "RESTOCK_RO"
          ? reason
          : "ADJUST",
      note,
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath(`/s/${id}`);
  revalidatePath("/");
  redirect(`/s/${id}?ok=1`);
}
