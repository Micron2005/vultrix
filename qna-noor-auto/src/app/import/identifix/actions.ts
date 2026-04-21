"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { db } from "@/lib/db";
import {
  parseCustomers,
  parseVehicles,
  parseInvoices,
  type ParsedInvoice,
} from "@/lib/identifixImport";

export type IdentifixImportSummary = {
  ok: boolean;
  message?: string;
  customers: { imported: number; updated: number };
  vehicles: { imported: number; updated: number; orphans: number };
  invoices: {
    imported: number;
    skipped: number;
    skippedReasons: Record<string, number>;
  };
  cleanup: { orphanCustomersDeleted: number };
  errors: string[];
};

async function readFile(file: File | null | undefined): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("utf8");
}

function papa<T extends Record<string, string>>(raw: string): T[] {
  const r = Papa.parse<T>(raw, { header: true, skipEmptyLines: true });
  return r.data;
}

/**
 * Multi-file importer for the Identifix Shop Management export format.
 *
 *   - customersCsv  → A.csv-style (one row per customer, includes Id)
 *   - vehiclesCsv   → B.csv-style (one row per vehicle, CustomerId links to A)
 *   - invoicesCsv   → C.csv-style (multi-row invoice format)
 *
 * All three are optional. Records are linked by the Identifix `Id` stored in
 * our `externalId` field so re-running the import updates existing records
 * rather than creating duplicates.
 *
 * A "wipe ghost customers" option deletes customers with blank names that
 * have no vehicles or repair orders — cleans up failed prior import attempts.
 */
export async function runIdentifixImport(
  prevState: IdentifixImportSummary | null,
  fd: FormData,
): Promise<IdentifixImportSummary> {
  const summary: IdentifixImportSummary = {
    ok: true,
    customers: { imported: 0, updated: 0 },
    vehicles: { imported: 0, updated: 0, orphans: 0 },
    invoices: { imported: 0, skipped: 0, skippedReasons: {} },
    cleanup: { orphanCustomersDeleted: 0 },
    errors: [],
  };

  try {
    const wipeOrphans = fd.get("wipeOrphans") === "on";

    if (wipeOrphans) {
      const ghosts = await db.customer.findMany({
        where: {
          externalId: null,
          OR: [
            { firstName: "" },
            { AND: [{ firstName: "-" }, { lastName: "-" }] },
          ],
          vehicles: { none: {} },
          repairOrders: { none: {} },
        },
        select: { id: true },
      });
      if (ghosts.length > 0) {
        await db.customer.deleteMany({
          where: { id: { in: ghosts.map((g) => g.id) } },
        });
        summary.cleanup.orphanCustomersDeleted = ghosts.length;
      }
    }

    // ---- Customers (A.csv) ----
    const aFile = fd.get("customersCsv");
    const aRaw = aFile instanceof File ? await readFile(aFile) : null;
    let customerExternalToId = new Map<string, string>();
    if (aRaw) {
      const parsed = parseCustomers(papa(aRaw));
      summary.errors.push(...parsed.errors.slice(0, 20));
      for (const c of parsed.customers) {
        const existing = await db.customer.findUnique({
          where: { externalId: c.externalId },
          select: { id: true },
        });
        const data = {
          externalId: c.externalId,
          type: c.type,
          firstName: c.firstName,
          lastName: c.lastName,
          companyName: c.companyName,
          phone: c.phone,
          altPhone: c.altPhone,
          email: c.email,
          street: c.street,
          city: c.city,
          state: c.state,
          zip: c.zip,
        };
        if (existing) {
          await db.customer.update({ where: { id: existing.id }, data });
          customerExternalToId.set(c.externalId, existing.id);
          summary.customers.updated++;
        } else {
          const created = await db.customer.create({ data });
          customerExternalToId.set(c.externalId, created.id);
          summary.customers.imported++;
        }
      }
    }
    // Always backfill from DB so subsequent stages can link even if A wasn't
    // re-uploaded this run.
    const allExisting = await db.customer.findMany({
      where: { externalId: { not: null } },
      select: { id: true, externalId: true },
    });
    for (const c of allExisting) {
      if (c.externalId && !customerExternalToId.has(c.externalId)) {
        customerExternalToId.set(c.externalId, c.id);
      }
    }

    // ---- Vehicles (B.csv) ----
    const bFile = fd.get("vehiclesCsv");
    const bRaw = bFile instanceof File ? await readFile(bFile) : null;
    const vinToVehicleId = new Map<string, string>();
    if (bRaw) {
      const parsed = parseVehicles(papa(bRaw));
      summary.errors.push(...parsed.errors.slice(0, 20));
      if (parsed.errors.length > 20) {
        summary.errors.push(
          `…and ${parsed.errors.length - 20} more vehicle errors truncated.`,
        );
      }
      for (const v of parsed.vehicles) {
        const custId = customerExternalToId.get(v.customerExternalId);
        if (!custId) {
          summary.vehicles.orphans++;
          continue;
        }
        const existing = await db.vehicle.findUnique({
          where: { externalId: v.externalId },
          select: { id: true },
        });
        const data = {
          externalId: v.externalId,
          customerId: custId,
          vin: v.vin,
          year: v.year,
          make: v.make,
          model: v.model,
          engine: v.engine,
          color: v.color,
          licensePlate: v.licensePlate,
          licenseState: v.licenseState,
        };
        let vehicleId: string;
        if (existing) {
          await db.vehicle.update({ where: { id: existing.id }, data });
          vehicleId = existing.id;
          summary.vehicles.updated++;
        } else {
          const created = await db.vehicle.create({ data });
          vehicleId = created.id;
          summary.vehicles.imported++;
        }
        if (v.vin) vinToVehicleId.set(v.vin, vehicleId);
      }
    }
    const allExistingVehicles = await db.vehicle.findMany({
      where: { vin: { not: null } },
      select: { id: true, vin: true },
    });
    for (const ev of allExistingVehicles) {
      if (ev.vin && !vinToVehicleId.has(ev.vin)) {
        vinToVehicleId.set(ev.vin, ev.id);
      }
    }

    // ---- Invoices (C.csv) ----
    const cFile = fd.get("invoicesCsv");
    const cRaw = cFile instanceof File ? await readFile(cFile) : null;
    if (cRaw) {
      const parsed = parseInvoices(cRaw);
      summary.errors.push(...parsed.errors.slice(0, 10));

      const existingROs = await db.repairOrder.findMany({
        select: { roNumber: true },
      });
      const usedRoNumbers = new Set<number>(existingROs.map((r) => r.roNumber));
      let nextRoNumber =
        existingROs.length > 0
          ? Math.max(...existingROs.map((r) => r.roNumber)) + 1
          : 10000;

      for (const inv of parsed.invoices) {
        const reason = await importInvoice(
          inv,
          vinToVehicleId,
          usedRoNumbers,
          () => {
            while (usedRoNumbers.has(nextRoNumber)) nextRoNumber++;
            const n = nextRoNumber;
            usedRoNumbers.add(n);
            nextRoNumber++;
            return n;
          },
        );
        if (reason === null) {
          summary.invoices.imported++;
        } else {
          summary.invoices.skipped++;
          summary.invoices.skippedReasons[reason] =
            (summary.invoices.skippedReasons[reason] ?? 0) + 1;
        }
      }
    }

    summary.message = "Import complete.";
  } catch (e) {
    summary.ok = false;
    summary.message = e instanceof Error ? e.message : "Unknown error";
  }

  revalidatePath("/customers");
  revalidatePath("/vehicles");
  revalidatePath("/repair-orders");
  revalidatePath("/");
  return summary;
}

/** Returns null on success, or a short skip-reason string. */
async function importInvoice(
  inv: ParsedInvoice,
  vinToVehicleId: Map<string, string>,
  usedRoNumbers: Set<number>,
  allocateRoNumber: () => number,
): Promise<string | null> {
  if (!inv.vin) return "no-vin";
  const vehicleId = vinToVehicleId.get(inv.vin);
  if (!vehicleId) return "vehicle-not-found";

  const vehicle = await db.vehicle.findUnique({
    where: { id: vehicleId },
    select: { customerId: true },
  });
  if (!vehicle) return "vehicle-not-found";

  const marker = `[Identifix invoice #${inv.invoiceNumber}]`;
  const dup = await db.repairOrder.findFirst({
    where: { notes: { contains: marker } },
    select: { id: true },
  });
  if (dup) return "already-imported";

  let roNumber = parseInt(inv.invoiceNumber, 10) || 0;
  if (!roNumber || usedRoNumbers.has(roNumber)) {
    roNumber = allocateRoNumber();
  } else {
    usedRoNumbers.add(roNumber);
  }

  const balance = inv.totals.balanceDue ?? 0;
  const paid = inv.totals.paid ?? 0;
  const status = balance <= 0.009 ? "PAID" : "INVOICED";

  let openedAt: Date = new Date();
  if (inv.date) {
    const parts = inv.date.split("/").map((x) => parseInt(x, 10));
    if (parts.length === 3 && parts.every((x) => !isNaN(x))) {
      const [m, d, y] = parts;
      const dt = new Date(y, m - 1, d);
      if (!isNaN(dt.getTime())) openedAt = dt;
    }
  }

  const techNote = inv.technicians.length
    ? `Technicians: ${inv.technicians.join(", ")}`
    : "";
  const customerNotes = inv.customerNotes
    ? `\nCustomer notes: ${inv.customerNotes}`
    : "";
  const notes = `${marker}${techNote ? "\n" + techNote : ""}${customerNotes}`;

  const labor: Array<{
    description: string;
    hours: number;
    rate: number;
    sortOrder: number;
  }> = [];
  const parts: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    sortOrder: number;
  }> = [];

  let sort = 0;
  for (let ji = 0; ji < inv.jobs.length; ji++) {
    const job = inv.jobs[ji];
    const jobPrefix = inv.jobs.length > 1 ? `Job ${ji + 1}: ` : "";
    for (const line of job.lines) {
      if ((line.type ?? "").toLowerCase() === "labor") {
        labor.push({
          description: jobPrefix + (line.description || "Labor"),
          hours: line.quantity || 1,
          rate: line.unitPrice || 0,
          sortOrder: sort++,
        });
      } else {
        parts.push({
          description: jobPrefix + (line.description || "Part"),
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice || 0,
          sortOrder: sort++,
        });
      }
    }
  }

  const ro = await db.repairOrder.create({
    data: {
      roNumber,
      customerId: vehicle.customerId,
      vehicleId,
      status,
      openedAt,
      closedAt: openedAt,
      invoicedAt: openedAt,
      paidAt: status === "PAID" ? openedAt : null,
      mileageIn: inv.odometer ?? null,
      mileageOut: inv.odometer ?? null,
      notes,
      laborLines: { create: labor },
      partLines: { create: parts },
    },
  });

  if (paid > 0) {
    await db.payment.create({
      data: {
        repairOrderId: ro.id,
        amount: paid,
        method: "OTHER",
        note: "Imported from Identifix invoice history",
        paidAt: openedAt,
      },
    });
  }

  return null;
}
