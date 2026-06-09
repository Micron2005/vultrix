import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

// Returns catalog parts that fit a given vehicle + optional free-text filter.
// A part matches when:
//  (a) it has no fitment tags set (universal), OR
//  (b) every set fitment field matches the vehicle:
//        - fitsMake    matches make    (case-insensitive)
//        - fitsModel   matches model   (case-insensitive, substring ok)
//        - fitsYearMin <= year (if set)
//        - fitsYearMax >= year (if set)
// Plus, if q is provided, the part's name/description/partNumber must contain q.
export async function GET(req: Request) {
  const orgId = await requireOrgId();
  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? "", 10);
  const make = (url.searchParams.get("make") ?? "").trim();
  const model = (url.searchParams.get("model") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "200", 10) || 200,
    500,
  );

  const hasYear = Number.isFinite(year);
  const hasMake = make.length > 0;
  const hasModel = model.length > 0;

  const parts = await db.part.findMany({
    where: {
      orgId,
      archived: false,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { partNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ qtyOnHand: "desc" }, { name: "asc" }],
    take: limit,
  });

  const normalize = (s: string) => s.toLowerCase().trim();
  const makeN = normalize(make);
  const modelN = normalize(model);

  const matches = parts
    .map((p) => {
      const hasAnyTag =
        p.fitsMake != null ||
        p.fitsModel != null ||
        p.fitsYearMin != null ||
        p.fitsYearMax != null;

      if (!hasAnyTag) {
        // Universal part — show for every picked vehicle.
        return { part: p, fit: "universal" as const };
      }

      // Part has fitment tags — only show if every set tag matches.
      if (p.fitsMake && hasMake && normalize(p.fitsMake) !== makeN) return null;
      if (
        p.fitsModel &&
        hasModel &&
        !normalize(p.fitsModel).includes(modelN) &&
        !modelN.includes(normalize(p.fitsModel))
      ) {
        return null;
      }
      if (p.fitsYearMin != null && hasYear && year < p.fitsYearMin) return null;
      if (p.fitsYearMax != null && hasYear && year > p.fitsYearMax) return null;

      // If the caller didn't supply make/model/year at all, only show the part
      // if its tags don't require it (conservative fallback).
      if (p.fitsMake && !hasMake) return null;
      if (p.fitsModel && !hasModel) return null;
      if ((p.fitsYearMin != null || p.fitsYearMax != null) && !hasYear) {
        return null;
      }

      return { part: p, fit: "tagged" as const };
    })
    .filter((m): m is { part: (typeof parts)[number]; fit: "universal" | "tagged" } => m !== null);

  return NextResponse.json({
    vehicle: {
      year: hasYear ? year : null,
      make: hasMake ? make : null,
      model: hasModel ? model : null,
    },
    query: q || null,
    count: matches.length,
    matches: matches.map((m) => ({
      id: m.part.id,
      partNumber: m.part.partNumber,
      name: m.part.name,
      description: m.part.description,
      unitPrice: m.part.unitPrice,
      costPrice: m.part.costPrice,
      qtyOnHand: m.part.qtyOnHand,
      reorderLevel: m.part.reorderLevel,
      source: m.part.source,
      fitsMake: m.part.fitsMake,
      fitsModel: m.part.fitsModel,
      fitsYearMin: m.part.fitsYearMin,
      fitsYearMax: m.part.fitsYearMax,
      fit: m.fit,
    })),
  });
}
