"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { adjustInventoryStock, createInventoryPart } from "@/lib/inventory";

const PartSchema = z.object({
  partNumber: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
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
    category: cleanStr(raw.category),
    unit: cleanStr(raw.unit),
    location: cleanStr(raw.location),
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
  const orgId = await requireOrgId();
  const data = toData(fd);
  const { qtyOnHand, ...partData } = data;
  const part = await createInventoryPart(orgId, partData, qtyOnHand);

  revalidatePath("/inventory");
  revalidatePath("/");
  redirect(`/inventory/${part.id}`);
}

export async function updatePart(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);

  // qtyOnHand is managed via stock moves — don't clobber it from the form here.
  const { qtyOnHand: _ignore, ...rest } = data;
  void _ignore;
  await db.part.updateMany({ where: { id, orgId }, data: rest });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath("/");
  redirect(`/inventory/${id}`);
}

export async function deletePart(id: string) {
  const orgId = await requireOrgId();
  const owned = await db.part.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) redirect("/inventory");
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

/**
 * Bulk-set Category / Location / Unit on many parts at once (from the
 * inventory list checkboxes). Only the fields present in `fields` are written,
 * so callers can update just one attribute. A `null` value clears that field.
 */
export async function bulkUpdatePartFields(
  ids: string[],
  fields: {
    category?: string | null;
    location?: string | null;
    unit?: string | null;
  },
) {
  const orgId = await requireOrgId();
  if (!ids.length) return;

  const data: Record<string, string | null> = {};
  if ("category" in fields) data.category = cleanStr(fields.category);
  if ("location" in fields) data.location = cleanStr(fields.location);
  if ("unit" in fields) data.unit = cleanStr(fields.unit);
  if (Object.keys(data).length === 0) return;

  await db.part.updateMany({ where: { id: { in: ids }, orgId }, data });
  revalidatePath("/inventory");
  revalidatePath("/");
}

export async function toggleArchived(id: string, archived: boolean) {
  const orgId = await requireOrgId();
  await db.part.updateMany({ where: { id, orgId }, data: { archived } });
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
}

/**
 * Receive / adjust stock. Positive delta = received; negative = write-off.
 * Logs a StockMove row so the history is visible on the part page.
 */
export async function adjustStock(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const deltaRaw = String(fd.get("delta") ?? "").trim();
  const reason = String(fd.get("reason") ?? "RECEIVE").trim() || "RECEIVE";
  const note = cleanStr(String(fd.get("note") ?? ""));

  const delta = parseFloat(deltaRaw);
  if (!Number.isFinite(delta) || delta === 0) {
    return;
  }

  const owned = await db.part.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) return;

  await adjustInventoryStock(orgId, id, delta, reason, note);

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath("/");
}

/**
 * Quick adjust from the mobile QR-scan page (`/s/<id>`). Accepts either
 * `delta` (relative +/- change) or `setTo` (absolute target count). Logs a
 * StockMove row so the audit trail on the part detail page stays intact.
 *
 * The `setTo` path reads current qty and writes the diff inside a single
 * Prisma interactive transaction so two concurrent scans can't race and
 * leave the part at an unintended count.
 */
export async function scanAdjustStock(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  let deltaRaw = String(fd.get("delta") ?? "").trim();
  const setToRaw = String(fd.get("setTo") ?? "").trim();
  const reason = String(fd.get("reason") ?? "ADJUST").trim() || "ADJUST";
  const note = cleanStr(String(fd.get("note") ?? ""));

  // "Used a specific amount" enters a positive quantity (e.g. 5 qt from a
  // barrel); convert it to a negative delta. Ignored when blank/<=0.
  const useQtyRaw = String(fd.get("useQty") ?? "").trim();
  if (deltaRaw === "" && useQtyRaw !== "") {
    const used = parseFloat(useQtyRaw);
    if (Number.isFinite(used) && used > 0) {
      deltaRaw = String(-used);
    } else {
      redirect(`/s/${id}`);
    }
  }

  const owned = await db.part.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) redirect("/inventory");

  const safeReason =
    reason === "USE_RO" ||
    reason === "RECEIVE" ||
    reason === "ADJUST" ||
    reason === "RESTOCK_RO"
      ? reason
      : "ADJUST";

  if (setToRaw !== "") {
    const target = parseFloat(setToRaw);
    if (!Number.isFinite(target)) return;

    // Direct `set target` instead of `increment: delta`. Under READ COMMITTED,
    // two concurrent scans could both read the same stale qty and both apply
    // their delta — leaving the final qty wrong. Writing `target` directly
    // makes the setTo flow idempotent: whichever tx commits last wins and
    // the part ends at exactly `target`. The logged StockMove delta reflects
    // what this scan saw, which is accurate audit for this specific request.
    const appliedDelta = await db.$transaction(async (tx) => {
      const part = await tx.part.findUnique({
        where: { id },
        select: { qtyOnHand: true },
      });
      if (!part) return 0;
      const d = target - part.qtyOnHand;
      if (d === 0) return 0;
      await tx.part.update({
        where: { id },
        data: { qtyOnHand: target },
      });
      await tx.stockMove.create({
        data: { partId: id, delta: d, reason: safeReason, note },
      });
      return d;
    });

    if (appliedDelta === 0) {
      redirect(`/s/${id}`);
    }
  } else if (deltaRaw !== "") {
    const d = parseFloat(deltaRaw);
    if (!Number.isFinite(d) || d === 0) {
      redirect(`/s/${id}`);
    }
    await db.part.update({
      where: { id },
      data: { qtyOnHand: { increment: d } },
    });
    await db.stockMove.create({
      data: { partId: id, delta: d, reason: safeReason, note },
    });
  } else {
    redirect(`/s/${id}`);
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${id}`);
  revalidatePath(`/s/${id}`);
  revalidatePath("/");
  redirect(`/s/${id}?ok=1`);
}

/**
 * Reverses a single StockMove entry created by the quick-scan flow. Used by
 * the "Undo" button on `/q/<id>/done`. Applies the opposite delta, logs a
 * compensating StockMove so the audit log shows the undo, and redirects
 * back to the inventory detail page.
 */
// Public flow: reached from the no-login quick-scan confirmation page
// (`/q/<id>/done`), so this is NOT org-scoped. The move is identified by the
// signed quick-scan that created it; we only verify the move belongs to the
// given part before reverting.
export async function undoScanMove(fd: FormData) {
  const moveId = String(fd.get("moveId") ?? "").trim();
  const partId = String(fd.get("partId") ?? "").trim();
  if (!moveId || !partId) return;

  const move = await db.stockMove.findUnique({
    where: { id: moveId },
    select: { id: true, partId: true, delta: true, undone: true },
  });
  if (!move || move.partId !== partId) {
    redirect(`/q/${partId}/done`);
  }

  // Idempotency guard: flip `undone` from false -> true atomically as part
  // of the same transaction that writes the compensating move. If the row
  // is already undone (double-click / back+resubmit), updateMany returns 0
  // and we skip the inverse delta so stock can't drift.
  const inverse = -move.delta;
  const appliedInverse = await db.$transaction(async (tx) => {
    const flagged = await tx.stockMove.updateMany({
      where: { id: moveId, undone: false },
      data: { undone: true },
    });
    if (flagged.count !== 1) return 0;

    await tx.part.update({
      where: { id: partId },
      data: { qtyOnHand: { increment: inverse } },
    });
    await tx.stockMove.create({
      data: {
        partId,
        delta: inverse,
        reason: "ADJUST",
        note: "Scan: undo",
        // The compensating move itself can't be undone again.
        undone: true,
      },
    });
    return inverse;
  });

  if (appliedInverse !== 0) {
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${partId}`);
    revalidatePath(`/s/${partId}`);
    revalidatePath("/");
  }
  redirect(`/q/${partId}/done?undone=1`);
}
