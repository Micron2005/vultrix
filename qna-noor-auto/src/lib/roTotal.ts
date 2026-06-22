import { db } from "./db";
import { loadAppliedShopFees } from "./shopFees";

/**
 * Authoritative grand total for a repair order (labor + parts + fees + applied
 * shop fees, minus discount, plus tax), excluding lines from declined jobs.
 *
 * Shared so server actions, the customer-payment route, and the Stripe webhook
 * all agree on what a ticket is worth.
 */
export async function computeRoTotal(orgId: string, id: string): Promise<number> {
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    include: {
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
    },
  });
  if (!ro) return 0;
  // Exclude lines from declined jobs.
  const declinedIds = new Set(
    ro.jobs.filter((j) => j.approvalStatus === "DECLINED").map((j) => j.id),
  );
  const activeLabor = ro.laborLines.filter((l) => !l.jobId || !declinedIds.has(l.jobId));
  const activeParts = ro.partLines.filter((p) => !p.jobId || !declinedIds.has(p.jobId));
  const activeFees = ro.feeLines.filter((f) => !f.jobId || !declinedIds.has(f.jobId));
  const labor = activeLabor.reduce((s, l) => s + l.hours * l.rate, 0);
  const parts = activeParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
  const fees = activeFees.reduce((s, f) => s + (f.amount || 0), 0);
  const appliedShopFees = await loadAppliedShopFees(orgId, id, {
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

/** Sum of payments recorded against a repair order. */
export async function computeRoPaid(repairOrderId: string): Promise<number> {
  const payments = await db.payment.findMany({
    where: { repairOrderId },
    select: { amount: true },
  });
  return Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
}
