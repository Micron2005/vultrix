/**
 * Phase 20 — External parts supplier deep-links.
 *
 * No API integration: each supplier exposes a URL-builder that prefills the
 * site's search page with the part name / part number / vehicle context.
 * Users stay signed into those sites in their own browser tab; we just route
 * them there.
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
};

function enc(s: string): string {
  return encodeURIComponent(s);
}

function combined(ctx: SupplierLookup, includeVehicle: boolean): string {
  const parts: string[] = [];
  if (ctx.partNumber && ctx.partNumber.trim()) {
    parts.push(ctx.partNumber.trim());
  } else if (ctx.partName && ctx.partName.trim()) {
    parts.push(ctx.partName.trim());
  }
  if (includeVehicle) {
    if (ctx.year) parts.push(String(ctx.year));
    if (ctx.make) parts.push(ctx.make);
    if (ctx.model) parts.push(ctx.model);
  }
  return parts.join(" ").trim();
}

export const PARTS_SUPPLIERS: SupplierDef[] = [
  {
    id: "autozone-pro",
    name: "AutoZone Pro",
    short: "AutoZone",
    description:
      "AutoZone Commercial — sign in with your AutoZonePro account in the opened tab.",
    buildUrl: (ctx) => {
      const q = combined(ctx, true);
      if (!q) return "https://www.autozonepro.com/";
      return `https://www.autozonepro.com/search?searchText=${enc(q)}`;
    },
  },
  {
    id: "oreilly-first-call",
    name: "O'Reilly First Call",
    short: "O'Reilly",
    description:
      "O'Reilly First Call Online — sign in with your First Call account in the opened tab.",
    buildUrl: (ctx) => {
      const q = combined(ctx, true);
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
      const q = combined(ctx, true);
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
      const q = combined(ctx, true);
      if (!q) return "https://www.rockauto.com/";
      return `https://www.rockauto.com/en/partsearch/?partnum=${enc(q)}`;
    },
  },
];

export function getSupplierById(id: string): SupplierDef | undefined {
  return PARTS_SUPPLIERS.find((s) => s.id === id);
}
