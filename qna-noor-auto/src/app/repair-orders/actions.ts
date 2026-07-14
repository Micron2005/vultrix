"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, dbBase } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { getNextRoNumber, getSetting } from "@/lib/shop";
import { parseMileage } from "@/lib/utils";
import { autoLogServicesForRO } from "@/lib/serviceReminders";
import { computeRoTotal } from "@/lib/roTotal";
import type { RoBulkSavePayload } from "./roBulkSave";

const RO_STATUSES = [
  "ESTIMATE",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
  "CANCELLED",
] as const;

const CreateROSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  complaint: z.string().optional().nullable(),
  mileageIn: z.string().optional().nullable(),
});

export async function createRepairOrder(fd: FormData) {
  const orgId = await requireOrgId();
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const parsed = CreateROSchema.parse({
    customerId: raw.customerId,
    vehicleId: raw.vehicleId,
    complaint: raw.complaint || null,
    mileageIn: raw.mileageIn || null,
  });

  // Ensure the customer and vehicle belong to this org before linking them.
  const vehicle = await db.vehicle.findFirst({
    where: { id: parsed.vehicleId, customerId: parsed.customerId, orgId },
    select: { id: true },
  });
  if (!vehicle) throw new Error("Vehicle not found");

  const roNumber = await getNextRoNumber(orgId);
  const defaultTax = parseFloat(await getSetting(orgId, "defaultTaxRate")) || 0;

  const created = await db.repairOrder.create({
    data: {
      roNumber,
      orgId,
      customerId: parsed.customerId,
      vehicleId: parsed.vehicleId,
      complaint: parsed.complaint,
      mileageIn: parseMileage(parsed.mileageIn),
      taxRate: defaultTax,
      status: "ESTIMATE",
    },
  });

  // Also update vehicle mileage if mileageIn was provided and greater
  const createdMileageIn = parseMileage(parsed.mileageIn);
  if (createdMileageIn !== null) {
    await db.vehicle.update({
      where: { id: parsed.vehicleId, orgId },
      data: { mileage: createdMileageIn },
    });
  }

  revalidatePath("/repair-orders");
  revalidatePath("/");
  revalidatePath(`/customers/${parsed.customerId}`);
  revalidatePath(`/vehicles/${parsed.vehicleId}`);
  redirect(`/repair-orders/${created.id}`);
}

const UpdateROSchema = z.object({
  status: z.enum(RO_STATUSES).optional(),
  complaint: z.string().optional().nullable(),
  cause: z.string().optional().nullable(),
  correction: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  mileageIn: z.string().optional().nullable(),
  mileageOut: z.string().optional().nullable(),
  taxRate: z.string().optional().nullable(),
  discount: z.string().optional().nullable(),
});

export async function updateRepairOrder(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const owned = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) redirect("/repair-orders");
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const parsed = UpdateROSchema.parse({
    status: raw.status as (typeof RO_STATUSES)[number] | undefined,
    complaint: raw.complaint || null,
    cause: raw.cause || null,
    correction: raw.correction || null,
    notes: raw.notes || null,
    mileageIn: raw.mileageIn || null,
    mileageOut: raw.mileageOut || null,
    taxRate: raw.taxRate || null,
    discount: raw.discount || null,
  });

  const data: Record<string, unknown> = {
    complaint: parsed.complaint,
    cause: parsed.cause,
    correction: parsed.correction,
    notes: parsed.notes,
    mileageIn: parseMileage(parsed.mileageIn),
    mileageOut: parseMileage(parsed.mileageOut),
    taxRate: parsed.taxRate ? parseFloat(parsed.taxRate) || 0 : 0,
    discount: parsed.discount ? parseFloat(parsed.discount) || 0 : 0,
  };
  if (parsed.status) {
    data.status = parsed.status;
    const now = new Date();
    if (parsed.status === "IN_PROGRESS") data.startedAt = now;
    if (parsed.status === "COMPLETED") data.completedAt = now;
    if (parsed.status === "INVOICED") {
      data.invoicedAt = now;
      data.closedAt = now;
    }
    if (parsed.status === "PAID") {
      data.paidAt = now;
      data.closedAt = now;
    }
    if (parsed.status === "CANCELLED") data.cancelledAt = now;
  }

  await db.repairOrder.update({ where: { id, orgId }, data });
  if (parsed.status === "COMPLETED" || parsed.status === "PAID") {
    await autoLogServicesForRO(id);
  }
  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  // "Save & Exit" clicks set exit=1 in the form data; bounce back to the
  // dashboard instead of re-rendering the detail page.
  if (fd.get("exit") === "1") {
    redirect(`/`);
  }
  // Plain inline "Save": stay on the page. revalidatePath above refreshes the
  // server-rendered data in place, so the SaveButton can show its success
  // animation without a full page reload interrupting it.
}

/**
 * Save the entire RO detail page in one action: the Details form plus all
 * labor / part / fee line edits. Line-item edits are only applied while the RO
 * is still editable (not INVOICED / PAID / CANCELLED); the Details block (notes,
 * tax, discount, mileage) saves regardless, matching updateRepairOrder.
 */
export async function saveRepairOrderAll(id: string, payload: RoBulkSavePayload) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true, status: true },
  });
  if (!ro) redirect("/repair-orders");

  // --- 1) Details (always allowed, same shape as updateRepairOrder) --------
  const d = payload.details ?? {};
  const parsed = UpdateROSchema.parse({
    complaint: d.complaint || null,
    cause: d.cause || null,
    correction: d.correction || null,
    notes: d.notes || null,
    mileageIn: d.mileageIn || null,
    mileageOut: d.mileageOut || null,
    taxRate: d.taxRate || null,
    discount: d.discount || null,
  });
  await db.repairOrder.update({
    where: { id, orgId },
    data: {
      complaint: parsed.complaint,
      cause: parsed.cause,
      correction: parsed.correction,
      notes: parsed.notes,
      mileageIn: parseMileage(parsed.mileageIn),
      mileageOut: parseMileage(parsed.mileageOut),
      taxRate: parsed.taxRate ? parseFloat(parsed.taxRate) || 0 : 0,
      discount: parsed.discount ? parseFloat(parsed.discount) || 0 : 0,
    },
  });

  // --- 2) Line items (only while the RO is unlocked) -----------------------
  const lineEditsLocked =
    ro.status === "INVOICED" || ro.status === "PAID" || ro.status === "CANCELLED";
  if (!lineEditsLocked) {
    const num = (v: string | undefined) => {
      const s = String(v ?? "").trim();
      if (s === "") return undefined;
      const n = parseFloat(s);
      return !Number.isNaN(n) && n >= 0 ? n : undefined;
    };

    for (const l of payload.labor ?? []) {
      const f = l.fields ?? {};
      const data: Record<string, unknown> = {};
      const desc = String(f.description ?? "").trim();
      if (desc) data.description = desc;
      const h = num(f.hours);
      if (h !== undefined) data.hours = h;
      const r = num(f.rate);
      if (r !== undefined) data.rate = r;
      if (Object.keys(data).length > 0) {
        await db.laborLine.updateMany({ where: { id: l.id, repairOrderId: id }, data });
      }
    }

    for (const p of payload.parts ?? []) {
      const f = p.fields ?? {};
      const data: Record<string, unknown> = {};
      const desc = String(f.description ?? "").trim();
      if (desc) data.description = desc;
      const q = num(f.quantity);
      if (q !== undefined) data.quantity = q;
      const price = num(f.unitPrice);
      if (price !== undefined) data.unitPrice = price;
      if ("costPrice" in f) {
        const costRaw = String(f.costPrice ?? "").trim();
        if (costRaw === "") data.costPrice = null;
        else {
          const c = parseFloat(costRaw);
          if (!Number.isNaN(c) && c >= 0) data.costPrice = c;
        }
      }
      if ("partNumber" in f) {
        const pn = String(f.partNumber ?? "").trim();
        data.partNumber = pn === "" ? null : pn;
      }
      if ("source" in f) {
        const src = String(f.source ?? "").trim();
        data.source = src === "" ? null : src;
      }
      if (Object.keys(data).length > 0) {
        await db.partLine.updateMany({ where: { id: p.id, repairOrderId: id }, data });
      }
    }

    for (const fee of payload.fees ?? []) {
      const f = fee.fields ?? {};
      const data: Record<string, unknown> = {};
      const desc = String(f.description ?? "").trim();
      if (desc) data.description = desc;
      const a = num(f.amount);
      if (a !== undefined) data.amount = Math.round(a * 100) / 100;
      if (Object.keys(data).length > 0) {
        await db.feeLine.updateMany({ where: { id: fee.id, repairOrderId: id }, data });
      }
    }
  }

  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  if (payload.exit) redirect("/");
}

export async function setRepairOrderStatus(id: string, status: string) {
  const orgId = await requireOrgId();
  if (!(RO_STATUSES as readonly string[]).includes(status)) return;
  const owned = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!owned) return;
  const data: Record<string, unknown> = { status };
  const now = new Date();
  if (status === "IN_PROGRESS") data.startedAt = now;
  if (status === "COMPLETED") data.completedAt = now;
  if (status === "INVOICED") {
    data.invoicedAt = now;
    data.closedAt = now;
  }
  if (status === "PAID") {
    data.paidAt = now;
    data.closedAt = now;
  }
  if (status === "CANCELLED") data.cancelledAt = now;
  await db.repairOrder.update({ where: { id, orgId }, data });
  if (status === "COMPLETED" || status === "PAID") {
    await autoLogServicesForRO(id);
  }
  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
}

/**
 * Transition an RO to a new status. Called from action buttons on the RO page.
 * Sets the appropriate lifecycle timestamp.
 */
export async function transitionRepairOrder(id: string, target: string) {
  if (!(RO_STATUSES as readonly string[]).includes(target)) return;
  await setRepairOrderStatus(id, target);
}

export async function deleteRepairOrder(id: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({ where: { id, orgId } });
  if (!ro) return;
  // Soft delete: move the ticket to Trash (recoverable) instead of destroying
  // it and its invoice / line items. Restore from /repair-orders/trash.
  await db.repairOrder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/repair-orders");
  revalidatePath("/repair-orders/trash");
  revalidatePath("/");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath(`/vehicles/${ro.vehicleId}`);
  // Bounce back to the dashboard rather than the RO list — same rule as
  // Save & Exit on the RO detail page.
  redirect("/");
}

/** Restore a soft-deleted repair order from Trash. */
export async function restoreRepairOrder(id: string) {
  const orgId = await requireOrgId();
  const ro = await dbBase.repairOrder.findFirst({
    where: { id, orgId, deletedAt: { not: null } },
  });
  if (!ro) redirect("/repair-orders/trash?error=not_found");
  await dbBase.repairOrder.update({
    where: { id },
    data: { deletedAt: null },
  });
  revalidatePath("/repair-orders");
  revalidatePath("/repair-orders/trash");
  revalidatePath("/");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath(`/vehicles/${ro.vehicleId}`);
  redirect(`/repair-orders/${id}`);
}

/** Permanently delete a ticket from Trash (irreversible). Requires "DELETE". */
export async function purgeRepairOrder(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const confirm = String(fd.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    redirect("/repair-orders/trash?error=confirm_required");
  }
  const ro = await dbBase.repairOrder.findFirst({
    where: { id, orgId, deletedAt: { not: null } },
  });
  if (!ro) redirect("/repair-orders/trash?error=not_found");
  await dbBase.repairOrder.delete({ where: { id } });
  revalidatePath("/repair-orders/trash");
  redirect("/repair-orders/trash?purged=1");
}

// Jobs
export async function addJob(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const max = await db.job.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.job.create({
    data: {
      repairOrderId,
      name,
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updateJob(id: string, repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  // Only update the fields actually present on the submitted form, so the
  // rename form (name) and the notes form (notes) don't clobber each other.
  const data: { name?: string; notes?: string | null } = {};
  if (fd.has("name")) {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    data.name = name;
  }
  if (fd.has("notes")) {
    data.notes = String(fd.get("notes") ?? "").trim() || null;
  }
  if (Object.keys(data).length === 0) return;
  await db.job.updateMany({ where: { id, repairOrderId }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deleteJob(id: string, repairOrderId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);

  const catalogParts = await db.partLine.findMany({
    where: { jobId: id, repairOrderId, partId: { not: null } },
    select: { partId: true, quantity: true },
  });

  await db.$transaction(async (tx) => {
    for (const pl of catalogParts) {
      if (!pl.partId) continue;
      await tx.part.update({
        where: { id: pl.partId },
        data: { qtyOnHand: { increment: pl.quantity } },
      });
      await tx.stockMove.create({
        data: {
          partId: pl.partId,
          delta: pl.quantity,
          reason: "RESTOCK_RO",
          note: "Job deleted from RO",
        },
      });
    }
    await tx.job.deleteMany({ where: { id, repairOrderId } });
  });

  if (catalogParts.length > 0) {
    revalidatePath("/inventory");
  }
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

// Lines
export async function addLaborLine(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  if (!description) return;
  const hours = parseFloat(String(fd.get("hours") ?? "0")) || 0;
  const technicianId = String(fd.get("technicianId") ?? "").trim() || null;
  const jobId = String(fd.get("jobId") ?? "").trim() || null;

  // If no rate given, use tech's default rate; else shop default.
  let rate = parseFloat(String(fd.get("rate") ?? "0")) || 0;
  if (rate === 0 && technicianId) {
    const tech = await db.technician.findFirst({
      where: { id: technicianId, orgId },
      select: { defaultRate: true },
    });
    if (tech?.defaultRate) rate = tech.defaultRate;
  }
  if (rate === 0) {
    rate = parseFloat(await getSetting(orgId, "defaultLaborRate")) || 0;
  }

  const max = await db.laborLine.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.laborLine.create({
    data: {
      repairOrderId,
      jobId,
      description,
      hours,
      rate,
      technicianId,
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updateLaborLineTech(
  id: string,
  repairOrderId: string,
  technicianId: string | null,
) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const clean = technicianId && technicianId.trim() !== "" ? technicianId : null;
  if (clean) {
    const tech = await db.technician.findFirst({
      where: { id: clean, orgId },
      select: { id: true },
    });
    if (!tech) return;
  }
  await db.laborLine.updateMany({
    where: { id, repairOrderId },
    data: { technicianId: clean },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

// Status values beyond which line edits are locked: once money has been
// billed or collected, changing prices or quantities retroactively would
// desync the printed invoice from the stored record.
const LOCKED_STATUSES = new Set(["INVOICED", "PAID", "CANCELLED"]);

async function assertROEditable(
  orgId: string,
  repairOrderId: string,
): Promise<void> {
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { status: true },
  });
  if (!ro) throw new Error("Repair order not found");
  if (LOCKED_STATUSES.has(ro.status)) {
    throw new Error(
      `This repair order is ${ro.status.toLowerCase()} — line items are locked. Change the status back to In Progress to edit prices.`,
    );
  }
}

export async function updateLaborLine(
  id: string,
  repairOrderId: string,
  fd: FormData,
) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  const hoursRaw = String(fd.get("hours") ?? "").trim();
  const rateRaw = String(fd.get("rate") ?? "").trim();
  const data: Record<string, unknown> = {};
  if (description) data.description = description;
  if (hoursRaw !== "") {
    const h = parseFloat(hoursRaw);
    if (!Number.isNaN(h) && h >= 0) data.hours = h;
  }
  if (rateRaw !== "") {
    const r = parseFloat(rateRaw);
    if (!Number.isNaN(r) && r >= 0) data.rate = r;
  }
  if (Object.keys(data).length === 0) return;
  await db.laborLine.updateMany({ where: { id, repairOrderId }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deleteLaborLine(id: string, repairOrderId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  await db.laborLine.deleteMany({ where: { id, repairOrderId } });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function addPartLine(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const partId = String(fd.get("partId") ?? "").trim() || null;
  const jobId = String(fd.get("jobId") ?? "").trim() || null;

  // If picking from the catalog, copy that part's details forward and skip
  // the free-text fields.
  let catalog: Awaited<ReturnType<typeof db.part.findFirst>> = null;
  if (partId) {
    catalog = await db.part.findFirst({ where: { id: partId, orgId } });
    if (!catalog) return;
  }

  const description =
    catalog?.name ?? String(fd.get("description") ?? "").trim();
  if (!description) return;
  const partNumber =
    catalog?.partNumber ?? (String(fd.get("partNumber") ?? "").trim() || null);
  const quantity = parseFloat(String(fd.get("quantity") ?? "1")) || 1;

  const rawUnit = String(fd.get("unitPrice") ?? "").trim();
  const unitPrice =
    rawUnit === ""
      ? (catalog?.unitPrice ?? 0)
      : parseFloat(rawUnit) || 0;

  const rawCost = String(fd.get("costPrice") ?? "").trim();
  const costPrice =
    rawCost === ""
      ? (catalog?.costPrice ?? null)
      : (() => {
          const v = parseFloat(rawCost);
          return Number.isNaN(v) ? null : v;
        })();

  const source =
    String(fd.get("source") ?? "").trim() || catalog?.source || null;

  const max = await db.partLine.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const line = await db.partLine.create({
    data: {
      repairOrderId,
      jobId,
      partId: catalog?.id ?? null,
      description,
      partNumber,
      quantity,
      unitPrice,
      costPrice,
      source,
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });

  // Auto-deduct inventory if the line was created from the catalog.
  if (catalog) {
    await db.part.update({
      where: { id: catalog.id },
      data: { qtyOnHand: { decrement: quantity } },
    });
    await db.stockMove.create({
      data: {
        partId: catalog.id,
        delta: -quantity,
        reason: "USE_RO",
        partLineId: line.id,
      },
    });
    revalidatePath(`/inventory/${catalog.id}`);
    revalidatePath(`/inventory`);
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
}

// Fees
export async function addFeeLine(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  if (!description) return;
  const amount = parseFloat(String(fd.get("amount") ?? "0")) || 0;
  const jobId = String(fd.get("jobId") ?? "").trim() || null;

  const max = await db.feeLine.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.feeLine.create({
    data: {
      repairOrderId,
      jobId,
      description,
      amount: Math.round(amount * 100) / 100,
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deleteFeeLine(id: string, repairOrderId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  await db.feeLine.deleteMany({ where: { id, repairOrderId } });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updatePartLine(
  id: string,
  repairOrderId: string,
  fd: FormData,
) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  const qtyRaw = String(fd.get("quantity") ?? "").trim();
  const priceRaw = String(fd.get("unitPrice") ?? "").trim();
  const costRaw = String(fd.get("costPrice") ?? "").trim();
  const data: Record<string, unknown> = {};
  if (description) data.description = description;
  if (qtyRaw !== "") {
    const q = parseFloat(qtyRaw);
    if (!Number.isNaN(q) && q >= 0) data.quantity = q;
  }
  if (priceRaw !== "") {
    const p = parseFloat(priceRaw);
    if (!Number.isNaN(p) && p >= 0) data.unitPrice = p;
  }
  if (fd.has("costPrice")) {
    if (costRaw === "") {
      data.costPrice = null;
    } else {
      const c = parseFloat(costRaw);
      if (!Number.isNaN(c) && c >= 0) data.costPrice = c;
    }
  }
  if (fd.has("partNumber")) {
    const pn = String(fd.get("partNumber") ?? "").trim();
    data.partNumber = pn === "" ? null : pn;
  }
  if (fd.has("source")) {
    const src = String(fd.get("source") ?? "").trim();
    data.source = src === "" ? null : src;
  }
  if (Object.keys(data).length === 0) return;
  await db.partLine.updateMany({ where: { id, repairOrderId }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updateFeeLine(
  id: string,
  repairOrderId: string,
  fd: FormData,
) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  const amountRaw = String(fd.get("amount") ?? "").trim();
  const data: Record<string, unknown> = {};
  if (description) data.description = description;
  if (amountRaw !== "") {
    const a = parseFloat(amountRaw);
    if (!Number.isNaN(a) && a >= 0) data.amount = Math.round(a * 100) / 100;
  }
  if (Object.keys(data).length === 0) return;
  await db.feeLine.updateMany({ where: { id, repairOrderId }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deletePartLine(id: string, repairOrderId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, repairOrderId);
  const line = await db.partLine.findFirst({
    where: { id, repairOrderId },
    select: { id: true, partId: true, quantity: true },
  });
  if (!line) return;

  await db.partLine.delete({ where: { id } });

  // Restock inventory if the line was linked to the catalog.
  if (line.partId) {
    await db.part.update({
      where: { id: line.partId },
      data: { qtyOnHand: { increment: line.quantity } },
    });
    await db.stockMove.create({
      data: {
        partId: line.partId,
        delta: line.quantity,
        reason: "RESTOCK_RO",
        note: "Part line removed from RO",
      },
    });
    revalidatePath(`/inventory/${line.partId}`);
    revalidatePath(`/inventory`);
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
}

// Payments

const PAYMENT_METHODS = ["CASH", "CARD", "CHECK", "TRANSFER", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export async function recordPayment(repairOrderId: string, fd: FormData) {
  const orgId = await requireOrgId();
  const ownedRO = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ownedRO) return;
  const amount = parseFloat(String(fd.get("amount") ?? "0"));
  if (!Number.isFinite(amount) || amount <= 0) return;

  const rawMethod = String(fd.get("method") ?? "CASH").toUpperCase();
  const method = (PAYMENT_METHODS as readonly string[]).includes(rawMethod)
    ? rawMethod
    : "OTHER";

  const reference = String(fd.get("reference") ?? "").trim() || null;
  const note = String(fd.get("note") ?? "").trim() || null;

  const rawPaidAt = String(fd.get("paidAt") ?? "").trim();
  const paidAt = rawPaidAt ? new Date(rawPaidAt) : new Date();

  await db.payment.create({
    data: {
      orgId,
      repairOrderId,
      amount: Math.round(amount * 100) / 100,
      method,
      reference,
      note,
      paidAt: isNaN(paidAt.getTime()) ? new Date() : paidAt,
    },
  });

  // If the running total of payments covers the RO total, auto-flip to PAID.
  const [ro, payments, total] = await Promise.all([
    db.repairOrder.findFirst({ where: { id: repairOrderId, orgId } }),
    db.payment.findMany({
      where: { repairOrderId },
      select: { amount: true },
    }),
    computeRoTotal(orgId, repairOrderId),
  ]);
  if (ro) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    // Also advance to INVOICED if the shop records a payment before formally
    // invoicing — that's a real shop workflow (customer hands over cash on
    // pickup before you hit "Generate Invoice").
    const data: Record<string, unknown> = {};
    if (ro.status === "ESTIMATE" || ro.status === "IN_PROGRESS" || ro.status === "COMPLETED") {
      data.status = "INVOICED";
      if (!ro.invoicedAt) data.invoicedAt = new Date();
    }
    if (paid + 0.005 >= total && ro.status !== "PAID" && ro.status !== "CANCELLED") {
      data.status = "PAID";
      data.paidAt = new Date();
      data.closedAt = new Date();
    }
    if (Object.keys(data).length > 0) {
      await db.repairOrder.update({ where: { id: repairOrderId, orgId }, data });
    }
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
}

export async function deletePayment(id: string, repairOrderId: string) {
  const orgId = await requireOrgId();
  const ownedRO = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ownedRO) return;
  await db.payment.deleteMany({ where: { id, repairOrderId } });

  // If deleting the payment drops us back below the total, reopen from PAID
  // to INVOICED so the user isn't left lying about having been paid.
  const [ro, payments, total] = await Promise.all([
    db.repairOrder.findFirst({ where: { id: repairOrderId, orgId } }),
    db.payment.findMany({
      where: { repairOrderId },
      select: { amount: true },
    }),
    computeRoTotal(orgId, repairOrderId),
  ]);
  if (ro && ro.status === "PAID") {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    if (paid + 0.005 < total) {
      await db.repairOrder.update({
        where: { id: repairOrderId, orgId },
        data: { status: "INVOICED", paidAt: null },
      });
    }
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
}

/**
 * Undo an accidental "Paid" status. Reverts the RO back to INVOICED, clears
 * the paid/closed/cleared timestamps, and removes any recorded payments so the
 * full balance is owed again — i.e. the ticket is treated as never paid.
 */
export async function undoPaid(id: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, customerId: true, clearedAt: true },
  });
  if (!ro || ro.status !== "PAID") return;
  // A cleared ticket is final — it can't be unpaid.
  if (ro.clearedAt) return;

  await db.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { repairOrderId: id } });
    await tx.repairOrder.update({
      where: { id, orgId },
      data: {
        status: "INVOICED",
        paidAt: null,
        closedAt: null,
        clearedAt: null,
      },
    });
  });

  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath("/");
}

/**
 * Mark a paid ticket as "cleared" — closed out of the active list. Only valid
 * for PAID repair orders; cleared tickets move to a separate section but stay
 * in the system.
 */
export async function clearRepairOrder(id: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, customerId: true },
  });
  if (!ro || ro.status !== "PAID") return;

  await db.repairOrder.update({
    where: { id, orgId },
    data: { clearedAt: new Date() },
  });

  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath("/");
}

/**
 * Revert an invoice back to a working repair order. Only valid for INVOICED
 * tickets: the ticket returns to COMPLETED (editable again) and the invoice
 * timestamps are cleared. From COMPLETED the only forward move is "Generate
 * Invoice" again — there is no further revert, so this is a single step back.
 */
export async function revertInvoiceToRepairOrder(id: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: { id: true, status: true, customerId: true },
  });
  if (!ro || ro.status !== "INVOICED") return;

  await db.repairOrder.update({
    where: { id, orgId },
    data: {
      status: "COMPLETED",
      invoicedAt: null,
      closedAt: null,
    },
  });

  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath("/");
}

/**
 * Inline edit of vehicle identifiers from the RO page. Only touches
 * VIN, license plate, license state, and mileage — the fields a tech
 * might need to update at the service counter without clicking over
 * to the full vehicle edit page.
 */
const VehicleInlineSchema = z.object({
  repairOrderId: z.string().min(1),
  vehicleId: z.string().min(1),
  vin: z.string().optional().nullable(),
  licensePlate: z.string().optional().nullable(),
  licenseState: z.string().optional().nullable(),
  mileage: z.string().optional().nullable(),
});

export async function updateROVehicleInfo(fd: FormData) {
  const orgId = await requireOrgId();
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const cleaned: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw)) cleaned[k] = v === "" ? null : v;
  const parsed = VehicleInlineSchema.parse(cleaned);

  // Guard: ensure the vehicleId actually belongs to the RO so a crafted
  // form can't edit an unrelated vehicle via this endpoint.
  const ro = await db.repairOrder.findFirst({
    where: { id: parsed.repairOrderId, orgId },
    select: { id: true, vehicleId: true },
  });
  if (!ro || ro.vehicleId !== parsed.vehicleId) {
    redirect(`/repair-orders/${parsed.repairOrderId}`);
  }

  await db.vehicle.update({
    where: { id: parsed.vehicleId, orgId },
    data: {
      vin: parsed.vin?.toUpperCase() ?? null,
      licensePlate: parsed.licensePlate?.toUpperCase() ?? null,
      licenseState: parsed.licenseState?.toUpperCase() ?? null,
      mileage: parseMileage(parsed.mileage),
    },
  });

  revalidatePath(`/repair-orders/${parsed.repairOrderId}`);
  revalidatePath(`/vehicles/${parsed.vehicleId}`);
  // Stay on the RO page so the inline vehicle-info SaveButton can complete its
  // success animation; revalidatePath above refreshes the displayed values.
}

// Admin approve/decline jobs

export async function approveJobAdmin(jobId: string, roId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, roId);
  await db.job.updateMany({
    where: { id: jobId, repairOrderId: roId },
    data: {
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
    },
  });
  revalidatePath(`/repair-orders/${roId}`);
}

export async function declineJobAdmin(jobId: string, roId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, roId);
  await db.job.updateMany({
    where: { id: jobId, repairOrderId: roId },
    data: {
      approvalStatus: "DECLINED",
      declinedAt: new Date(),
    },
  });
  revalidatePath(`/repair-orders/${roId}`);
}

export async function resetJobApproval(jobId: string, roId: string) {
  const orgId = await requireOrgId();
  await assertROEditable(orgId, roId);
  await db.job.updateMany({
    where: { id: jobId, repairOrderId: roId },
    data: {
      approvalStatus: "PENDING",
      approvedAt: null,
      declinedAt: null,
      customerNote: null,
    },
  });
  revalidatePath(`/repair-orders/${roId}`);
}
