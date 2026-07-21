import { db } from "@/lib/db";
import { computeRoPaid } from "@/lib/roTotal";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFees } from "@/lib/shopFees";

export async function getInvoiceTotals(orgId: string, id: string) {
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    include: {
      jobs: { select: { id: true, approvalStatus: true } },
      laborLines: true,
      partLines: true,
      feeLines: true,
    },
  });
  if (!ro) return null;

  const filtered = excludeDeclinedJobLines(ro);
  const preliminary = computeTotals(filtered);
  const shopFees = await loadAppliedShopFees(orgId, id, {
    partsSubtotal: preliminary.partsSubtotal,
    laborSubtotal: preliminary.laborSubtotal,
  });
  const totals = computeTotals({ ...filtered, shopFees });
  const paid = await computeRoPaid(id);
  const round = (value: number) => Math.round(value * 100) / 100;
  const total = round(totals.total);
  const roundedPaid = round(paid);
  return {
    laborSubtotal: round(totals.laborSubtotal),
    partsSubtotal: round(totals.partsSubtotal),
    feesSubtotal: round(totals.feesSubtotal),
    shopFeesSubtotal: round(totals.shopFeesSubtotal),
    subtotal: round(totals.subtotal),
    discount: round(totals.discount),
    tax: round(totals.tax),
    total,
    paid: roundedPaid,
    balanceDue: Math.max(0, round(total - roundedPaid)),
  };
}
