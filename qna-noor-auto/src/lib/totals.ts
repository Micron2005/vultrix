export type RepairOrderLines = {
  laborLines: { hours: number; rate: number }[];
  partLines: { quantity: number; unitPrice: number }[];
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
  const subtotal = laborSubtotal + partsSubtotal;
  const afterDiscount = Math.max(0, subtotal - (ro.discount ?? 0));
  const tax = afterDiscount * ((ro.taxRate ?? 0) / 100);
  const total = afterDiscount + tax;
  return {
    laborSubtotal,
    partsSubtotal,
    subtotal,
    discount: ro.discount ?? 0,
    tax,
    total,
  };
}
