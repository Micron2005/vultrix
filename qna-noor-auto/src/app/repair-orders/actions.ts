"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getNextRoNumber, getSetting } from "@/lib/shop";
import { autoLogServicesForRO } from "@/lib/serviceReminders";

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
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const parsed = CreateROSchema.parse({
    customerId: raw.customerId,
    vehicleId: raw.vehicleId,
    complaint: raw.complaint || null,
    mileageIn: raw.mileageIn || null,
  });

  const roNumber = await getNextRoNumber();
  const defaultTax = parseFloat(await getSetting("defaultTaxRate")) || 0;

  const created = await db.repairOrder.create({
    data: {
      roNumber,
      customerId: parsed.customerId,
      vehicleId: parsed.vehicleId,
      complaint: parsed.complaint,
      mileageIn: parsed.mileageIn
        ? parseInt(parsed.mileageIn, 10) || null
        : null,
      taxRate: defaultTax,
      status: "ESTIMATE",
    },
  });

  // Also update vehicle mileage if mileageIn was provided and greater
  if (parsed.mileageIn) {
    const mi = parseInt(parsed.mileageIn, 10);
    if (!isNaN(mi)) {
      await db.vehicle.update({
        where: { id: parsed.vehicleId },
        data: { mileage: mi },
      });
    }
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
    mileageIn: parsed.mileageIn
      ? parseInt(parsed.mileageIn, 10) || null
      : null,
    mileageOut: parsed.mileageOut
      ? parseInt(parsed.mileageOut, 10) || null
      : null,
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

  await db.repairOrder.update({ where: { id }, data });
  if (parsed.status === "COMPLETED" || parsed.status === "PAID") {
    await autoLogServicesForRO(id);
  }
  revalidatePath(`/repair-orders/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(`/repair-orders/${id}`);
}

export async function setRepairOrderStatus(id: string, status: string) {
  if (!(RO_STATUSES as readonly string[]).includes(status)) return;
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
  await db.repairOrder.update({ where: { id }, data });
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
  const ro = await db.repairOrder.findUnique({ where: { id } });
  if (!ro) return;
  await db.repairOrder.delete({ where: { id } });
  revalidatePath("/repair-orders");
  revalidatePath("/");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath(`/vehicles/${ro.vehicleId}`);
  redirect("/repair-orders");
}

// Lines
export async function addLaborLine(repairOrderId: string, fd: FormData) {
  await assertROEditable(repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  if (!description) return;
  const hours = parseFloat(String(fd.get("hours") ?? "0")) || 0;
  const technicianId = String(fd.get("technicianId") ?? "").trim() || null;

  // If no rate given, use tech's default rate; else shop default.
  let rate = parseFloat(String(fd.get("rate") ?? "0")) || 0;
  if (rate === 0 && technicianId) {
    const tech = await db.technician.findUnique({
      where: { id: technicianId },
      select: { defaultRate: true },
    });
    if (tech?.defaultRate) rate = tech.defaultRate;
  }
  if (rate === 0) {
    rate = parseFloat(await getSetting("defaultLaborRate")) || 0;
  }

  const max = await db.laborLine.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.laborLine.create({
    data: {
      repairOrderId,
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
  const clean = technicianId && technicianId.trim() !== "" ? technicianId : null;
  await db.laborLine.update({
    where: { id },
    data: { technicianId: clean },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

// Status values beyond which line edits are locked: once money has been
// billed or collected, changing prices or quantities retroactively would
// desync the printed invoice from the stored record.
const LOCKED_STATUSES = new Set(["INVOICED", "PAID", "CANCELLED"]);

async function assertROEditable(repairOrderId: string): Promise<void> {
  const ro = await db.repairOrder.findUnique({
    where: { id: repairOrderId },
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
  await assertROEditable(repairOrderId);
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
  await db.laborLine.update({ where: { id }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deleteLaborLine(id: string, repairOrderId: string) {
  await assertROEditable(repairOrderId);
  await db.laborLine.delete({ where: { id } });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function addPartLine(repairOrderId: string, fd: FormData) {
  await assertROEditable(repairOrderId);
  const partId = String(fd.get("partId") ?? "").trim() || null;

  // If picking from the catalog, copy that part's details forward and skip
  // the free-text fields.
  let catalog: Awaited<ReturnType<typeof db.part.findUnique>> = null;
  if (partId) {
    catalog = await db.part.findUnique({ where: { id: partId } });
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
  await assertROEditable(repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  if (!description) return;
  const amount = parseFloat(String(fd.get("amount") ?? "0")) || 0;

  const max = await db.feeLine.findFirst({
    where: { repairOrderId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.feeLine.create({
    data: {
      repairOrderId,
      description,
      amount: Math.round(amount * 100) / 100,
      sortOrder: (max?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deleteFeeLine(id: string, repairOrderId: string) {
  await assertROEditable(repairOrderId);
  await db.feeLine.delete({ where: { id } });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updatePartLine(
  id: string,
  repairOrderId: string,
  fd: FormData,
) {
  await assertROEditable(repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  const qtyRaw = String(fd.get("quantity") ?? "").trim();
  const priceRaw = String(fd.get("unitPrice") ?? "").trim();
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
  if (Object.keys(data).length === 0) return;
  await db.partLine.update({ where: { id }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function updateFeeLine(
  id: string,
  repairOrderId: string,
  fd: FormData,
) {
  await assertROEditable(repairOrderId);
  const description = String(fd.get("description") ?? "").trim();
  const amountRaw = String(fd.get("amount") ?? "").trim();
  const data: Record<string, unknown> = {};
  if (description) data.description = description;
  if (amountRaw !== "") {
    const a = parseFloat(amountRaw);
    if (!Number.isNaN(a) && a >= 0) data.amount = Math.round(a * 100) / 100;
  }
  if (Object.keys(data).length === 0) return;
  await db.feeLine.update({ where: { id }, data });
  revalidatePath(`/repair-orders/${repairOrderId}`);
}

export async function deletePartLine(id: string, repairOrderId: string) {
  await assertROEditable(repairOrderId);
  const line = await db.partLine.findUnique({
    where: { id },
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

/**
 * Compute the total of labor + parts + tax − discount for an RO, same math as
 * lib/totals. Duplicated here to avoid importing a client-side util into a
 * server action module. Keep in sync with computeTotals().
 */
async function computeRoTotal(id: string): Promise<number> {
  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: { laborLines: true, partLines: true, feeLines: true },
  });
  if (!ro) return 0;
  const labor = ro.laborLines.reduce((s, l) => s + l.hours * l.rate, 0);
  const parts = ro.partLines.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const fees = ro.feeLines.reduce((s, f) => s + (f.amount || 0), 0);
  const { loadAppliedShopFees } = await import("@/lib/shopFees");
  const appliedShopFees = await loadAppliedShopFees(id, {
    partsSubtotal: parts,
    laborSubtotal: labor,
  });
  const shopFeesTaxable = appliedShopFees
    .filter((f) => f.taxable)
    .reduce((s, f) => s + f.amount, 0);
  const shopFeesNonTaxable = appliedShopFees
    .filter((f) => !f.taxable)
    .reduce((s, f) => s + f.amount, 0);
  const taxableBase = labor + parts + fees + shopFeesTaxable;
  const afterDiscount = Math.max(taxableBase - (ro.discount || 0), 0);
  const tax = afterDiscount * ((ro.taxRate || 0) / 100);
  const subtotal = labor + parts + fees + shopFeesTaxable + shopFeesNonTaxable;
  const total = Math.max(0, subtotal - (ro.discount || 0)) + tax;
  return Math.round(total * 100) / 100;
}

export async function recordPayment(repairOrderId: string, fd: FormData) {
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
    db.repairOrder.findUnique({ where: { id: repairOrderId } }),
    db.payment.findMany({
      where: { repairOrderId },
      select: { amount: true },
    }),
    computeRoTotal(repairOrderId),
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
      await db.repairOrder.update({ where: { id: repairOrderId }, data });
    }
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
}

export async function deletePayment(id: string, repairOrderId: string) {
  await db.payment.delete({ where: { id } });

  // If deleting the payment drops us back below the total, reopen from PAID
  // to INVOICED so the user isn't left lying about having been paid.
  const [ro, payments, total] = await Promise.all([
    db.repairOrder.findUnique({ where: { id: repairOrderId } }),
    db.payment.findMany({
      where: { repairOrderId },
      select: { amount: true },
    }),
    computeRoTotal(repairOrderId),
  ]);
  if (ro && ro.status === "PAID") {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    if (paid + 0.005 < total) {
      await db.repairOrder.update({
        where: { id: repairOrderId },
        data: { status: "INVOICED", paidAt: null },
      });
    }
  }

  revalidatePath(`/repair-orders/${repairOrderId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
}
