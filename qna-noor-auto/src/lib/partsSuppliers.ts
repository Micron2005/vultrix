/**
 * Phase 20 — External parts supplier deep-links.
 *
 * No API integration: each supplier exposes a URL-builder that prefills the
 * site's search page with the part name / part number / vehicle context.
 * Users stay signed into those sites in their own browser tab; we just route
 * them there.
 *
 * Phase 27 — AutoZone Pro and O'Reilly First Call have their own "My Zone"
 * session-scoped vehicle selector; their URL scheme doesn't accept a vehicle
 * parameter. Dumping year/make/model into the search text makes the results
 * worse, so these two suppliers search by part name/number only. The
 * `needsVehicleContext` flag tells the UI to copy the vehicle to clipboard
 * so the user can paste into the supplier's own vehicle selector.
 */

export type SupplierLookup = {
  partName?: string | null;
  partNumber?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  /** VIN — pasted into AutoZone Pro / First Call's Add Vehicle dialog. */
  vin?: string | null;
  /** License plate + state — fallback when no VIN is available. */
  licensePlate?: string | null;
  licenseState?: string | null;
};

export type SupplierDef = {
  id: string;
  name: string;
  short: string;
  /** For alt-text and visually-impaired contexts. */
  description: string;
  /** Build a URL that searches this supplier for the given context. */
  buildUrl: (ctx: SupplierLookup) => string;
  /**
   * When true, the supplier has its own session-scoped vehicle selector
   * that our link can't pre-set. The UI should copy the vehicle string to
   * clipboard on click so the user can paste it into the supplier's
   * selector. URL search terms should omit the vehicle.
   */
  needsVehicleContext?: boolean;
};

function enc(s: string): string {
  return encodeURIComponent(s);
}

/** Just the part identifier — used when the supplier filters by its own vehicle selector. */
function partOnly(ctx: SupplierLookup): string {
  if (ctx.partNumber && ctx.partNumber.trim()) return ctx.partNumber.trim();
  if (ctx.partName && ctx.partName.trim()) return ctx.partName.trim();
  return "";
}

/** Part + vehicle concatenated into a free-text search. Used by suppliers without vehicle selectors. */
function combined(ctx: SupplierLookup): string {
  const parts: string[] = [];
  const p = partOnly(ctx);
  if (p) parts.push(p);
  if (ctx.year) parts.push(String(ctx.year));
  if (ctx.make) parts.push(ctx.make);
  if (ctx.model) parts.push(ctx.model);
  return parts.join(" ").trim();
}

/** Year/make/model for display — not the primary clipboard payload. */
export function formatVehicleHint(ctx: SupplierLookup): string {
  const parts: string[] = [];
  if (ctx.year) parts.push(String(ctx.year));
  if (ctx.make) parts.push(ctx.make);
  if (ctx.model) parts.push(ctx.model);
  return parts.join(" ").trim();
}

/**
 * Clipboard payload for suppliers that use an Add-Vehicle dialog.
 *
 * AutoZone Pro and First Call both have an "Add Vehicle" dialog with a
 * VIN input — pasting the raw VIN there (no spaces/labels) gives a
 * one-click vehicle lock-in. If we don't have a VIN, fall back to the
 * plate (they both also accept plate + state). Only fall back to
 * year/make/model as a last resort.
 */
export type SupplierClipboard = {
  text: string;
  kind: "vin" | "plate" | "ymm";
  hint: string;
};

export function formatSupplierClipboard(
  ctx: SupplierLookup,
): SupplierClipboard | null {
  const vin = ctx.vin?.trim().toUpperCase();
  if (vin && vin.length === 17) {
    return {
      text: vin,
      kind: "vin",
      hint: "VIN copied — paste into Add Vehicle → VIN.",
    };
  }
  const plate = ctx.licensePlate?.trim().toUpperCase();
  if (plate) {
    return {
      text: plate,
      kind: "plate",
      hint: `Plate ${plate}${
        ctx.licenseState ? ` (${ctx.licenseState})` : ""
      } copied — paste into Add Vehicle → License Plate.`,
    };
  }
  const ymm = formatVehicleHint(ctx);
  if (ymm) {
    return {
      text: ymm,
      kind: "ymm",
      hint: `${ymm} copied — use Add Vehicle → Year/Make/Model (no VIN on file).`,
    };
  }
  return null;
}

export const PARTS_SUPPLIERS: SupplierDef[] = [
  {
    id: "amazon",
    name: "Amazon",
    short: "Amazon",
    description: "Search Amazon Automotive for this part.",
    buildUrl: (ctx) => {
      const q = combined(ctx);
      if (!q) return "https://www.amazon.com/automotive";
      return `https://www.amazon.com/s?i=automotive&k=${enc(q)}`;
    },
  },
];

export function getSupplierById(id: string): SupplierDef | undefined {
  return PARTS_SUPPLIERS.find((s) => s.id === id);
}
