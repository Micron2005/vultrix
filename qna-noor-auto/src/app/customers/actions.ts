"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const CustomerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function cleanEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

function parseFormData(fd: FormData) {
  const obj = Object.fromEntries(fd.entries());
  return CustomerSchema.parse(cleanEmpty(obj));
}

export async function createCustomer(fd: FormData) {
  const data = parseFormData(fd);
  const created = await db.customer.create({ data });
  revalidatePath("/customers");
  revalidatePath("/");
  redirect(`/customers/${created.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  const data = parseFormData(fd);
  await db.customer.update({ where: { id }, data });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/");
  redirect("/customers");
}

// ---------------------------------------------------------------------------
// Bulk payment
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = ["CASH", "CARD", "CHECK", "TRANSFER", "OTHER"] as const;

async function computeRoTotal(id: string): Promise<number> {
  const ro = await db.repairOrder.findUnique({
    where: { id },
    include: {
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
    },
  });
  if (!ro) return 0;
  const declinedIds = new Set(
    ro.jobs.filter((j) => j.approvalStatus === "DECLINED").map((j) => j.id),
  );
  const activeLabor = ro.laborLines.filter((l) => !l.jobId || !declinedIds.has(l.jobId));
  const activeParts = ro.partLines.filter((p) => !p.jobId || !declinedIds.has(p.jobId));
  const activeFees = ro.feeLines.filter((f) => !f.jobId || !declinedIds.has(f.jobId));
  const labor = activeLabor.reduce((s, l) => s + l.hours * l.rate, 0);
  const parts = activeParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const fees = activeFees.reduce((s, f) => s + (f.amount || 0), 0);
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
  // Fee lines are flat pass-through charges and are never taxed.
  const taxableBase = labor + parts + shopFeesTaxable;
  const afterDiscount = Math.max(taxableBase - (ro.discount || 0), 0);
  const tax = afterDiscount * ((ro.taxRate || 0) / 100);
  const subtotal = labor + parts + fees + shopFeesTaxable + shopFeesNonTaxable;
  const total = Math.max(0, subtotal - (ro.discount || 0)) + tax;
  return Math.round(total * 100) / 100;
}

export async function recordBulkPayment(
  fd: FormData,
): Promise<{ ok: boolean; message: string }> {
  const customerId = String(fd.get("customerId") ?? "");
  const totalAmount = parseFloat(String(fd.get("amount") ?? "0"));
  if (!customerId || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { ok: false, message: "Invalid payment amount." };
  }

  const rawMethod = String(fd.get("method") ?? "CASH").toUpperCase();
  const method = (PAYMENT_METHODS as readonly string[]).includes(rawMethod)
    ? rawMethod
    : "OTHER";
  const reference = String(fd.get("reference") ?? "").trim() || null;
  const note = String(fd.get("note") ?? "").trim() || null;

  let allocations: { roId: string; applied: number }[];
  try {
    allocations = JSON.parse(String(fd.get("allocations") ?? "[]"));
  } catch {
    return { ok: false, message: "Invalid allocation data." };
  }

  if (!Array.isArray(allocations) || allocations.length === 0) {
    return { ok: false, message: "No invoices to allocate payment to." };
  }

  // Verify all ROs belong to this customer
  const roIds = allocations.map((a) => a.roId);
  const ros = await db.repairOrder.findMany({
    where: { id: { in: roIds }, customerId },
    select: { id: true },
  });
  const validIds = new Set(ros.map((r) => r.id));
  const validAllocations = allocations.filter(
    (a) => validIds.has(a.roId) && a.applied > 0,
  );

  if (validAllocations.length === 0) {
    return { ok: false, message: "No valid invoices found for this customer." };
  }

  const paidAt = new Date();
  let appliedCount = 0;
  let clearedCount = 0;

  for (const alloc of validAllocations) {
    const paymentAmount = Math.round(alloc.applied * 100) / 100;
    if (paymentAmount <= 0) continue;

    // Record the payment on this RO
    await db.payment.create({
      data: {
        repairOrderId: alloc.roId,
        amount: paymentAmount,
        method,
        reference,
        note: note
          ? `Bulk payment: ${note}`
          : "Bulk payment",
        paidAt,
      },
    });

    appliedCount++;

    // Check if this RO is now fully paid
    const [ro, payments, total] = await Promise.all([
      db.repairOrder.findUnique({ where: { id: alloc.roId } }),
      db.payment.findMany({
        where: { repairOrderId: alloc.roId },
        select: { amount: true },
      }),
      computeRoTotal(alloc.roId),
    ]);

    if (ro) {
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      const data: Record<string, unknown> = {};
      if (ro.status === "ESTIMATE" || ro.status === "IN_PROGRESS" || ro.status === "COMPLETED") {
        data.status = "INVOICED";
        if (!ro.invoicedAt) data.invoicedAt = paidAt;
      }
      if (paid + 0.005 >= total && ro.status !== "PAID" && ro.status !== "CANCELLED") {
        data.status = "PAID";
        data.paidAt = paidAt;
        data.closedAt = paidAt;
        clearedCount++;
      }
      if (Object.keys(data).length > 0) {
        await db.repairOrder.update({ where: { id: alloc.roId }, data });
      }
    }
  }

  // Revalidate all relevant paths
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  for (const alloc of validAllocations) {
    revalidatePath(`/repair-orders/${alloc.roId}`);
  }

  const totalApplied = validAllocations.reduce((s, a) => s + a.applied, 0);
  return {
    ok: true,
    message: `Applied ${formatMoney(totalApplied)} across ${appliedCount} invoice${appliedCount !== 1 ? "s" : ""}. ${clearedCount} fully cleared.`,
  };
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

/**
 * Delete a set of repair orders belonging to a customer. Mirrors the behavior
 * of the single-RO delete (cascade delete; inventory is not restocked) so bulk
 * delete is equivalent to deleting each ticket individually.
 */
export async function bulkDeleteRepairOrders(
  customerId: string,
  roIds: string[],
): Promise<{ ok: boolean; message: string }> {
  if (!customerId || !Array.isArray(roIds) || roIds.length === 0) {
    return { ok: false, message: "No tickets selected." };
  }

  // Only delete ROs that actually belong to this customer.
  const ros = await db.repairOrder.findMany({
    where: { id: { in: roIds }, customerId },
    select: { id: true, vehicleId: true },
  });
  if (ros.length === 0) {
    return { ok: false, message: "No matching tickets found for this customer." };
  }

  const validIds = ros.map((r) => r.id);
  await db.repairOrder.deleteMany({ where: { id: { in: validIds } } });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  for (const r of ros) {
    revalidatePath(`/vehicles/${r.vehicleId}`);
  }

  return {
    ok: true,
    message: `Deleted ${validIds.length} ticket${validIds.length !== 1 ? "s" : ""}.`,
  };
}

/**
 * Pay off a set of selected repair orders in full — records a payment equal to
 * each RO's remaining balance and marks it PAID. Used when the user hand-picks
 * which tickets to clear (vs. the smart-allocation bulk payment).
 */
export async function paySelectedRepairOrders(
  customerId: string,
  roIds: string[],
  method: string,
): Promise<{ ok: boolean; message: string }> {
  if (!customerId || !Array.isArray(roIds) || roIds.length === 0) {
    return { ok: false, message: "No tickets selected." };
  }

  const payMethod = (PAYMENT_METHODS as readonly string[]).includes(
    String(method).toUpperCase(),
  )
    ? String(method).toUpperCase()
    : "CASH";

  const ros = await db.repairOrder.findMany({
    where: { id: { in: roIds }, customerId },
    select: { id: true, status: true, invoicedAt: true },
  });
  if (ros.length === 0) {
    return { ok: false, message: "No matching tickets found for this customer." };
  }

  const paidAt = new Date();
  let clearedCount = 0;
  let totalApplied = 0;

  for (const ro of ros) {
    if (ro.status === "CANCELLED") continue;
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where: { repairOrderId: ro.id },
        select: { amount: true },
      }),
      computeRoTotal(ro.id),
    ]);
    const alreadyPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.round((total - alreadyPaid) * 100) / 100;
    if (balance <= 0) continue;

    await db.payment.create({
      data: {
        repairOrderId: ro.id,
        amount: balance,
        method: payMethod,
        note: "Paid via bulk selection",
        paidAt,
      },
    });
    totalApplied += balance;
    clearedCount++;

    await db.repairOrder.update({
      where: { id: ro.id },
      data: {
        status: "PAID",
        paidAt,
        closedAt: paidAt,
        ...(ro.invoicedAt ? {} : { invoicedAt: paidAt }),
      },
    });
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  for (const ro of ros) {
    revalidatePath(`/repair-orders/${ro.id}`);
  }

  if (clearedCount === 0) {
    return { ok: false, message: "Selected tickets had no outstanding balance." };
  }
  return {
    ok: true,
    message: `Paid ${formatMoney(totalApplied)} across ${clearedCount} ticket${clearedCount !== 1 ? "s" : ""}.`,
  };
}
