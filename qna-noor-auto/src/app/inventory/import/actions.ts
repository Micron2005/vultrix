"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import type { PartColumnMap, PartField } from "./fields";

/**
 * Bulk inventory importer. Accepts CSV text (also works for data pasted from a
 * spreadsheet — Papa auto-detects tab vs comma) plus a column map from the UI,
 * so any parts list / vendor export can be brought in at once instead of
 * entering parts one at a time.
 */

export async function parsePartsCsv(
  csvText: string,
): Promise<{ headers: string[]; rowCount: number; sample: Record<string, string>[] }> {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).filter((h) => h.trim() !== "");
  return {
    headers,
    rowCount: result.data.length,
    sample: result.data.slice(0, 5),
  };
}

function num(raw: string | undefined): number | null {
  if (raw == null) return null;
  // Strip currency symbols, thousands separators, stray spaces.
  const s = raw.replace(/[^0-9.\-]/g, "").trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(raw: string | undefined): number | null {
  const n = num(raw);
  return n == null ? null : Math.trunc(n);
}

export async function runPartsImport(
  csvText: string,
  columnMapJson: string,
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const orgId = await requireOrgId();
  const columnMap = JSON.parse(columnMapJson) as PartColumnMap;
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Track part numbers seen in this batch so two rows with the same part #
  // don't collide on the (orgId, partNumber) unique index.
  const seenPartNumbers = new Set<string>();

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    try {
      const get = (field: PartField): string | undefined => {
        const src = columnMap[field];
        if (!src) return undefined;
        const v = row[src];
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t || undefined;
      };

      const name = get("name");
      if (!name) {
        skipped++;
        continue;
      }

      const partNumber = get("partNumber") ?? null;
      const qtyOnHand = num(get("qtyOnHand")) ?? 0;

      const fields = {
        name,
        partNumber,
        category: get("category") ?? null,
        unit: get("unit") ?? null,
        location: get("location") ?? null,
        source: get("source") ?? null,
        costPrice: num(get("costPrice")),
        unitPrice: num(get("unitPrice")),
        reorderLevel: num(get("reorderLevel")) ?? 0,
        fitsMake: get("fitsMake") ?? null,
        fitsModel: get("fitsModel") ?? null,
        fitsYearMin: intOrNull(get("fitsYearMin")),
        fitsYearMax: intOrNull(get("fitsYearMax")),
        description: get("description") ?? null,
        notes: get("notes") ?? null,
      };

      // Match an existing part by part number (org-scoped) to update instead of
      // duplicate. Rows without a part number always create a new part.
      const existing =
        partNumber && !seenPartNumbers.has(partNumber)
          ? await db.part.findFirst({
              where: { orgId, partNumber },
              select: { id: true },
            })
          : null;

      if (existing) {
        // Update catalog fields; leave qtyOnHand alone (managed by stock moves).
        await db.part.update({
          where: { id: existing.id },
          data: fields,
        });
        updated++;
      } else {
        const part = await db.part.create({
          data: { ...fields, orgId, qtyOnHand: 0 },
        });
        if (qtyOnHand !== 0) {
          await db.part.update({
            where: { id: part.id },
            data: { qtyOnHand },
          });
          await db.stockMove.create({
            data: {
              partId: part.id,
              delta: qtyOnHand,
              reason: "INITIAL",
              note: "Opening balance (import)",
            },
          });
        }
        created++;
      }

      if (partNumber) seenPartNumbers.add(partNumber);
    } catch (e) {
      errors.push(
        `Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/");

  return { created, updated, skipped, errors };
}
