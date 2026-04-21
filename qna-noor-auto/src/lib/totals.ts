export type AppliedShopFee = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  taxable: boolean;
};

export type RepairOrderLines = {
  laborLines: { hours: number; rate: number }[];
  partLines: { quantity: number; unitPrice: number }[];
  feeLines?: { amount: number }[];
  shopFees?: AppliedShopFee[];
  taxRate: number;
  discount: number;
};

export function computeTotals(ro: RepairOrderLines) {
  const laborSubtotal = ro.laborLines.reduce(
    (s, l) => s + (l.hours ?? 0) * (l.rate ?? 0),
    0,
  );
  const partsSubtotal = ro.partLines.reduce(
    (s, p) => s + (p.quantity ?? 0) * (p.unitPrice ?? 0),
    0,
  );
  const feesSubtotal = (ro.feeLines ?? []).reduce(
    (s, f) => s + (f.amount ?? 0),
    0,
  );
  // Identifix-style shop fees: split into taxable + non-taxable buckets so the
  // tax is only applied to the taxable portion.
  const shopFeesTaxable = (ro.shopFees ?? [])
    .filter((f) => f.taxable)
    .reduce((s, f) => s + (f.amount ?? 0), 0);
  const shopFeesNonTaxable = (ro.shopFees ?? [])
    .filter((f) => !f.taxable)
    .reduce((s, f) => s + (f.amount ?? 0), 0);
  const shopFeesSubtotal = shopFeesTaxable + shopFeesNonTaxable;

  const taxableBase = laborSubtotal + partsSubtotal + feesSubtotal + shopFeesTaxable;
  const afterDiscount = Math.max(0, taxableBase - (ro.discount ?? 0));
  const tax = afterDiscount * ((ro.taxRate ?? 0) / 100);
  const subtotal = laborSubtotal + partsSubtotal + feesSubtotal + shopFeesSubtotal;
  const total = Math.max(0, subtotal - (ro.discount ?? 0)) + tax;
  return {
    laborSubtotal,
    partsSubtotal,
    feesSubtotal,
    shopFeesSubtotal,
    subtotal,
    discount: ro.discount ?? 0,
    tax,
    total,
  };
}

/**
 * Given the RO's labor + parts subtotals and a list of shop-fee configurations
 * (active ones only, with any excluded-for-this-RO already filtered out),
 * compute the applied amount for each fee. Each fee amount is
 *   min(maxCap ?? Infinity, partsSubtotal * partsPercent + laborSubtotal * laborPercent)
 */
export type ShopFeeConfig = {
  id: string;
  name: string;
  description: string | null;
  partsPercent: number;
  laborPercent: number;
  maxCap: number | null;
  taxable: boolean;
};

export function applyShopFees(
  fees: ShopFeeConfig[],
  opts: { partsSubtotal: number; laborSubtotal: number },
): AppliedShopFee[] {
  return fees.map((f) => {
    const raw =
      (opts.partsSubtotal * (f.partsPercent ?? 0)) / 100 +
      (opts.laborSubtotal * (f.laborPercent ?? 0)) / 100;
    const capped = f.maxCap != null ? Math.min(raw, f.maxCap) : raw;
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      amount: Math.max(0, capped),
      taxable: !!f.taxable,
    };
  });
}
