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

/** Formats year/make/model into a single "2018 Toyota Camry" string for clipboard. */
export function formatVehicleHint(ctx: SupplierLookup): string {
  const parts: string[] = [];
  if (ctx.year) parts.push(String(ctx.year));
  if (ctx.make) parts.push(ctx.make);
  if (ctx.model) parts.push(ctx.model);
  return parts.join(" ").trim();
}

export const PARTS_SUPPLIERS: SupplierDef[] = [
  {
    id: "autozone-pro",
    name: "AutoZone Pro",
    short: "AutoZone",
    description:
      "AutoZone Commercial — set the vehicle in the 'My Zone' selector first, then the part search will be filtered for you.",
    needsVehicleContext: true,
    buildUrl: (ctx) => {
      const q = partOnly(ctx);
      if (!q) return "https://www.autozonepro.com/";
      return `https://www.autozonepro.com/search?searchText=${enc(q)}`;
    },
  },
  {
    id: "oreilly-first-call",
    name: "O'Reilly First Call",
    short: "O'Reilly",
    description:
      "O'Reilly First Call Online — pick the vehicle in First Call's own vehicle selector, then the part search will be filtered.",
    needsVehicleContext: true,
    buildUrl: (ctx) => {
      const q = partOnly(ctx);
      if (!q) return "https://www.firstcallonline.com/";
      return `https://www.firstcallonline.com/search?searchTerm=${enc(q)}`;
    },
  },
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
  {
    id: "rockauto",
    name: "RockAuto",
    short: "RockAuto",
    description:
      "RockAuto parts catalog — if a part number is known, search by it; otherwise we open the catalog home.",
    buildUrl: (ctx) => {
      if (ctx.partNumber && ctx.partNumber.trim()) {
        return `https://www.rockauto.com/en/partsearch/?partnum=${enc(ctx.partNumber.trim())}`;
      }
      const q = combined(ctx);
      if (!q) return "https://www.rockauto.com/";
      return `https://www.rockauto.com/en/partsearch/?partnum=${enc(q)}`;
    },
  },
];

export function getSupplierById(id: string): SupplierDef | undefined {
  return PARTS_SUPPLIERS.find((s) => s.id === id);
}
