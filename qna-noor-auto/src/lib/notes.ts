import { db } from "@/lib/db";
import type { RepairNote } from "@prisma/client";

type VehicleMatchSpec = {
  year?: number | null;
  make?: string | null;
  model?: string | null;
};

// Find repair notes that match a given vehicle.
// Strategy: exact-ish make/model match (case-insensitive via SQLite collation via
// .toLowerCase() compare in JS) + year range overlap. Notes with no targeting at
// all (universal) are excluded here — surface them on the Knowledge page, not
// on every vehicle.
export async function findNotesForVehicle(
  v: VehicleMatchSpec,
): Promise<RepairNote[]> {
  const make = v.make?.trim();
  const model = v.model?.trim();
  const year = v.year ?? null;

  // If no make/model, don't auto-match — every note would show up on every vehicle.
  if (!make && !model) return [];

  // Pull candidates by make (broadest, then filter). SQLite is case-sensitive
  // by default for `contains`, so pull wider and filter in JS.
  const all = await db.repairNote.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const matches: RepairNote[] = [];
  for (const n of all) {
    if (!matchesVehicle(n, { year, make, model })) continue;
    matches.push(n);
  }
  return matches.slice(0, 20);
}

function ciIncludes(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  return a.toLowerCase().includes(b.toLowerCase());
}

function matchesVehicle(
  n: RepairNote,
  v: { year: number | null; make?: string; model?: string },
): boolean {
  // Make: if the note targets a make, it must match.
  if (n.make) {
    if (!v.make || !ciIncludes(n.make, v.make) && !ciIncludes(v.make, n.make)) {
      // allow loose match either direction
      const a = n.make.toLowerCase();
      const b = v.make?.toLowerCase() ?? "";
      if (!(a === b || a.includes(b) || b.includes(a))) return false;
    }
  }
  // Model: if the note targets a model, it must match.
  if (n.model) {
    if (!v.model) return false;
    const a = n.model.toLowerCase();
    const b = v.model.toLowerCase();
    if (!(a === b || a.includes(b) || b.includes(a))) return false;
  }
  // Year: if the note has a min/max, the vehicle year must overlap (if known).
  if (n.yearMin || n.yearMax) {
    if (v.year == null) {
      // Unknown vehicle year — don't exclude; we'll show the note but it's a soft match.
    } else {
      if (n.yearMin != null && v.year < n.yearMin) return false;
      if (n.yearMax != null && v.year > n.yearMax) return false;
    }
  }
  // If the note has no targeting (no make, no model, no year) — skip to avoid noise.
  if (!n.make && !n.model && !n.yearMin && !n.yearMax) return false;

  // Require at least one positive signal — either make OR model must be set on the note.
  if (!n.make && !n.model) return false;

  return true;
}
