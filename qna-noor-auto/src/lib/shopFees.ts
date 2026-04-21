import { db } from "@/lib/db";
import { applyShopFees, type AppliedShopFee, type ShopFeeConfig } from "@/lib/totals";

/**
 * Batch helper: given a set of RO IDs and per-RO labor/parts subtotals,
 * return a map roId → AppliedShopFee[]. Uses a single SELECT on exclusions
 * and a single SELECT on active fees, then computes per-RO in memory.
 * Used by list/report pages so we don't do N+1 queries per row.
 */
export async function loadAppliedShopFeesForROs(
  ros: { id: string; partsSubtotal: number; laborSubtotal: number }[],
): Promise<Map<string, AppliedShopFee[]>> {
  const out = new Map<string, AppliedShopFee[]>();
  if (ros.length === 0) return out;
  const roIds = ros.map((r) => r.id);
  const [configs, exclusions] = await Promise.all([
    db.shopFee.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.repairOrderShopFeeExclusion.findMany({
      where: { repairOrderId: { in: roIds } },
      select: { repairOrderId: true, shopFeeId: true },
    }),
  ]);
  const excludedByRO = new Map<string, Set<string>>();
  for (const ex of exclusions) {
    let set = excludedByRO.get(ex.repairOrderId);
    if (!set) {
      set = new Set();
      excludedByRO.set(ex.repairOrderId, set);
    }
    set.add(ex.shopFeeId);
  }
  for (const r of ros) {
    const excluded = excludedByRO.get(r.id) ?? new Set<string>();
    const active: ShopFeeConfig[] = configs
      .filter((f) => !excluded.has(f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        partsPercent: f.partsPercent,
        laborPercent: f.laborPercent,
        maxCap: f.maxCap,
        taxable: f.taxable,
      }));
    out.set(
      r.id,
      applyShopFees(active, {
        partsSubtotal: r.partsSubtotal,
        laborSubtotal: r.laborSubtotal,
      }),
    );
  }
  return out;
}

/**
 * Load the active shop-fee configurations for a repair order, minus any that
 * have been explicitly excluded from this RO, and compute the applied amounts
 * from the RO's current labor + parts subtotals.
 *
 * Callers that already have the labor/parts subtotals handy can pass them in;
 * otherwise we recompute from the RO's lines.
 */
export async function loadAppliedShopFees(
  repairOrderId: string,
  opts: { partsSubtotal: number; laborSubtotal: number },
): Promise<AppliedShopFee[]> {
  const [configs, exclusions] = await Promise.all([
    db.shopFee.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.repairOrderShopFeeExclusion.findMany({
      where: { repairOrderId },
      select: { shopFeeId: true },
    }),
  ]);
  const excluded = new Set(exclusions.map((x) => x.shopFeeId));
  const active: ShopFeeConfig[] = configs
    .filter((f) => !excluded.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      partsPercent: f.partsPercent,
      laborPercent: f.laborPercent,
      maxCap: f.maxCap,
      taxable: f.taxable,
    }));
  return applyShopFees(active, opts);
}

/**
 * Returns the status of each shop fee on this RO: whether it's currently
 * excluded, and what amount it would apply for. Useful for the RO detail page
 * where we want to render BOTH active fees (with a "Remove" button) and
 * excluded fees (with a "Re-add" button).
 */
export type ShopFeeStatusRow = {
  id: string;
  name: string;
  description: string | null;
  partsPercent: number;
  laborPercent: number;
  maxCap: number | null;
  taxable: boolean;
  amount: number;
  excluded: boolean;
};

export async function loadShopFeeStatus(
  repairOrderId: string,
  opts: { partsSubtotal: number; laborSubtotal: number },
): Promise<ShopFeeStatusRow[]> {
  const [configs, exclusions] = await Promise.all([
    db.shopFee.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.repairOrderShopFeeExclusion.findMany({
      where: { repairOrderId },
      select: { shopFeeId: true },
    }),
  ]);
  const excluded = new Set(exclusions.map((x) => x.shopFeeId));
  return configs.map((f) => {
    const raw =
      (opts.partsSubtotal * (f.partsPercent ?? 0)) / 100 +
      (opts.laborSubtotal * (f.laborPercent ?? 0)) / 100;
    const capped = f.maxCap != null ? Math.min(raw, f.maxCap) : raw;
    return {
      id: f.id,
      name: f.name,
      description: f.description,
      partsPercent: f.partsPercent,
      laborPercent: f.laborPercent,
      maxCap: f.maxCap,
      taxable: f.taxable,
      amount: Math.max(0, capped),
      excluded: excluded.has(f.id),
    };
  });
}
