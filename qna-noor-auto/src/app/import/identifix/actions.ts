"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  parseCustomers,
  parseVehicles,
  parseInvoices,
  type ParsedInvoice,
} from "@/lib/identifixImport";

export type StepResult = {
  ok: boolean;
  message: string;
  stats: Record<string, number>;
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

/** Run `fn` in parallel over `items`, at most `concurrency` at a time. */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (x: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return out;
}

// ------------------------------------------------------------------
// RESET: nuke all imported data so the user can start fresh.
// Deletes every RepairOrder (cascades to labor/part/fee/payment lines),
// every Appointment, every Vehicle, and every Customer.
// Kept OUT of normal delete flows — only callable from the Identifix
// import page.
// ------------------------------------------------------------------
export async function resetImportedData(
  confirm: string,
): Promise<StepResult> {
  const res: StepResult = {
    ok: true,
    message: "",
    stats: {
      repairOrders: 0,
      appointments: 0,
      vehicles: 0,
      customers: 0,
    },
    errors: [],
  };
  if (confirm !== "DELETE EVERYTHING") {
    res.ok = false;
    res.message =
      "Reset not executed. Confirmation text did not match 'DELETE EVERYTHING'.";
    return res;
  }
  const orgId = await requireOrgId();
  try {
    // Order matters: RO first (has FK to customer/vehicle without cascade),
    // then appointments, then vehicles, then customers.
    const ro = await db.repairOrder.deleteMany({ where: { orgId } });
    res.stats.repairOrders = ro.count;
    const ap = await db.appointment.deleteMany({ where: { orgId } });
    res.stats.appointments = ap.count;
    const vh = await db.vehicle.deleteMany({ where: { orgId } });
    res.stats.vehicles = vh.count;
    const cu = await db.customer.deleteMany({ where: { orgId } });
    res.stats.customers = cu.count;
    res.message = `Wiped ${res.stats.customers} customers, ${res.stats.vehicles} vehicles, ${res.stats.repairOrders} repair orders, and ${res.stats.appointments} appointments. Database is now clean — run Step 1 next.`;
  } catch (e) {
    res.ok = false;
    res.message = e instanceof Error ? e.message : "Unknown error";
  }
  revalidatePath("/customers");
  revalidatePath("/vehicles");
  revalidatePath("/repair-orders");
  revalidatePath("/appointments");
  return res;
}

// ------------------------------------------------------------------
// Step 0: heal data from a prior broken import.
//   (1) Customers whose firstName looks like an Identifix ObjectID
//       (24 hex chars) and have no externalId — move the ID into
//       externalId so the A.csv import will UPDATE (not duplicate)
//       them and fill in real names.
//   (2) Truly blank rows (no name, no externalId, no vehicles, no
//       ROs) — delete as ghosts.
// ------------------------------------------------------------------
const OBJECT_ID_RE = /^[0-9a-f]{24}$/;

export async function wipeOrphans(): Promise<StepResult> {
  const res: StepResult = {
    ok: true,
    message: "",
    stats: { healed: 0, deleted: 0 },
    errors: [],
  };
  const orgId = await requireOrgId();
  try {
    // (1) Heal hex-ID-named customers
    const nullExt = await db.customer.findMany({
      where: { orgId, externalId: null },
      select: { id: true, firstName: true, lastName: true },
    });
    const toHeal = nullExt.filter((c) =>
      OBJECT_ID_RE.test((c.firstName ?? "").trim().toLowerCase()),
    );
    if (toHeal.length > 0) {
      await mapConcurrent(toHeal, 10, async (c) => {
        const id = c.firstName.trim().toLowerCase();
        try {
          await db.customer.update({
            where: { id: c.id },
            data: { externalId: id, firstName: "", lastName: "" },
          });
        } catch (e) {
          // externalId uniqueness violation — means another row already
          // claims this Identifix ID (shouldn't happen, but be defensive).
          if (res.errors.length < 20) {
            const msg = e instanceof Error ? e.message : "unknown";
            res.errors.push(`heal ${id}: ${msg}`);
          }
        }
      });
      res.stats.healed = toHeal.length;
    }

    // (2) Delete truly-blank ghost rows
    const ghosts = await db.customer.findMany({
      where: {
        orgId,
        externalId: null,
        OR: [
          { AND: [{ firstName: "" }, { lastName: "" }] },
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
    }
    res.stats.deleted = ghosts.length;
    res.message = `Healed ${res.stats.healed} hex-ID-named customers (ready to get their real names from A.csv) and deleted ${res.stats.deleted} blank ghost records.`;
  } catch (e) {
    res.ok = false;
    res.message = e instanceof Error ? e.message : "Unknown error";
  }
  revalidatePath("/customers");
  return res;
}

// ------------------------------------------------------------------
// Step 1: customers (A.csv)
// ------------------------------------------------------------------
export async function runCustomersImport(
  _prev: StepResult | null,
  fd: FormData,
): Promise<StepResult> {
  const res: StepResult = {
    ok: true,
    message: "",
    stats: { parsed: 0, imported: 0, updated: 0 },
    errors: [],
  };

  try {
    const file = fd.get("customersCsv");
    const raw = file instanceof File ? await readFile(file) : null;
    if (!raw) {
      res.ok = false;
      res.message = "No customers file uploaded.";
      return res;
    }

    const parsed = parseCustomers(papa(raw));
    res.stats.parsed = parsed.customers.length;
    res.errors = parsed.errors.slice(0, 20);

    const orgId = await requireOrgId();
    const externalIds = parsed.customers.map((c) => c.externalId);
    const existing = await db.customer.findMany({
      where: { orgId, externalId: { in: externalIds } },
      select: { id: true, externalId: true },
    });
    const existingByExt = new Map(
      existing.map((e) => [e.externalId!, e.id] as const),
    );

    const toCreate = parsed.customers.filter(
      (c) => !existingByExt.has(c.externalId),
    );
    const toUpdate = parsed.customers.filter((c) =>
      existingByExt.has(c.externalId),
    );

    if (toCreate.length > 0) {
      await db.customer.createMany({
        data: toCreate.map((c) => ({
          orgId,
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
        })),
        skipDuplicates: true,
      });
      res.stats.imported = toCreate.length;
    }

    if (toUpdate.length > 0) {
      await mapConcurrent(toUpdate, 10, async (c) => {
        await db.customer.updateMany({
          where: { orgId, externalId: c.externalId },
          data: {
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
          },
        });
      });
      res.stats.updated = toUpdate.length;
    }

    res.message = `Imported ${res.stats.imported} new + ${res.stats.updated} updated customers.`;
  } catch (e) {
    res.ok = false;
    res.message = e instanceof Error ? e.message : "Unknown error";
  }

  revalidatePath("/customers");
  revalidatePath("/businesses");
  revalidatePath("/");
  return res;
}

// ------------------------------------------------------------------
// Step 2: vehicles (B.csv)
// ------------------------------------------------------------------
export async function runVehiclesImport(
  _prev: StepResult | null,
  fd: FormData,
): Promise<StepResult> {
  const res: StepResult = {
    ok: true,
    message: "",
    stats: { parsed: 0, imported: 0, updated: 0, orphans: 0 },
    errors: [],
  };

  try {
    const file = fd.get("vehiclesCsv");
    const raw = file instanceof File ? await readFile(file) : null;
    if (!raw) {
      res.ok = false;
      res.message = "No vehicles file uploaded.";
      return res;
    }

    const orgId = await requireOrgId();
    const parsed = parseVehicles(papa(raw));
    res.stats.parsed = parsed.vehicles.length;
    res.errors = parsed.errors.slice(0, 20);

    const customerExternalIds = Array.from(
      new Set(parsed.vehicles.map((v) => v.customerExternalId)),
    );
    const custRows = await db.customer.findMany({
      where: { orgId, externalId: { in: customerExternalIds } },
      select: { id: true, externalId: true },
    });
    const custByExt = new Map(
      custRows.map((c) => [c.externalId!, c.id] as const),
    );

    const linked = parsed.vehicles
      .map((v) => ({
        ...v,
        customerId: custByExt.get(v.customerExternalId),
      }))
      .filter((v) => {
        if (!v.customerId) {
          res.stats.orphans++;
          return false;
        }
        return true;
      }) as Array<(typeof parsed.vehicles)[number] & { customerId: string }>;

    const vehExternalIds = linked.map((v) => v.externalId);
    const existing = await db.vehicle.findMany({
      where: { orgId, externalId: { in: vehExternalIds } },
      select: { id: true, externalId: true },
    });
    const existingByExt = new Map(
      existing.map((e) => [e.externalId!, e.id] as const),
    );

    const toCreate = linked.filter((v) => !existingByExt.has(v.externalId));
    const toUpdate = linked.filter((v) => existingByExt.has(v.externalId));

    if (toCreate.length > 0) {
      await db.vehicle.createMany({
        data: toCreate.map((v) => ({
          orgId,
          externalId: v.externalId,
          customerId: v.customerId,
          vin: v.vin,
          year: v.year,
          make: v.make,
          model: v.model,
          engine: v.engine,
          color: v.color,
          licensePlate: v.licensePlate,
          licenseState: v.licenseState,
        })),
        skipDuplicates: true,
      });
      res.stats.imported = toCreate.length;
    }

    if (toUpdate.length > 0) {
      await mapConcurrent(toUpdate, 10, async (v) => {
        await db.vehicle.updateMany({
          where: { orgId, externalId: v.externalId },
          data: {
            customerId: v.customerId,
            vin: v.vin,
            year: v.year,
            make: v.make,
            model: v.model,
            engine: v.engine,
            color: v.color,
            licensePlate: v.licensePlate,
            licenseState: v.licenseState,
          },
        });
      });
      res.stats.updated = toUpdate.length;
    }

    res.message = `Imported ${res.stats.imported} new + ${res.stats.updated} updated vehicles (${res.stats.orphans} skipped with no matching customer).`;
  } catch (e) {
    res.ok = false;
    res.message = e instanceof Error ? e.message : "Unknown error";
  }

  revalidatePath("/vehicles");
  revalidatePath("/");
  return res;
}

// ------------------------------------------------------------------
// Step 3: invoices (C.csv)
// ------------------------------------------------------------------
export async function runInvoicesImport(
  _prev: StepResult | null,
  fd: FormData,
): Promise<StepResult> {
  const res: StepResult = {
    ok: true,
    message: "",
    stats: {
      parsed: 0,
      imported: 0,
      skippedNoVin: 0,
      skippedNoVehicle: 0,
      skippedAlreadyImported: 0,
    },
    errors: [],
  };

  try {
    const file = fd.get("invoicesCsv");
    const raw = file instanceof File ? await readFile(file) : null;
    if (!raw) {
      res.ok = false;
      res.message = "No invoices file uploaded.";
      return res;
    }

    const orgId = await requireOrgId();
    const parsed = parseInvoices(raw);
    res.stats.parsed = parsed.invoices.length;
    res.errors = parsed.errors.slice(0, 20);

    const allVehicles = await db.vehicle.findMany({
      where: { orgId, vin: { not: null } },
      select: { id: true, vin: true, customerId: true },
    });
    const vinToVehicle = new Map(
      allVehicles.map((v) => [v.vin!, v] as const),
    );

    const existingROs = await db.repairOrder.findMany({
      where: { orgId },
      select: { roNumber: true, notes: true },
    });
    const usedRoNumbers = new Set<number>(existingROs.map((r) => r.roNumber));
    let nextRoNumber =
      existingROs.length > 0
        ? Math.max(...existingROs.map((r) => r.roNumber)) + 1
        : 10000;
    const alreadyImported = new Set<string>();
    for (const ro of existingROs) {
      if (ro.notes) {
        const m = ro.notes.match(/\[Identifix invoice #([^\]]+)\]/);
        if (m) alreadyImported.add(m[1]);
      }
    }

    // Classify invoices up front.
    type Task = {
      inv: ParsedInvoice;
      vehicleId: string;
      customerId: string;
      roNumber: number;
    };
    const tasks: Task[] = [];
    for (const inv of parsed.invoices) {
      if (!inv.vin) {
        res.stats.skippedNoVin++;
        continue;
      }
      const veh = vinToVehicle.get(inv.vin);
      if (!veh) {
        res.stats.skippedNoVehicle++;
        continue;
      }
      if (alreadyImported.has(inv.invoiceNumber)) {
        res.stats.skippedAlreadyImported++;
        continue;
      }
      let roNumber = parseInt(inv.invoiceNumber, 10) || 0;
      if (!roNumber || usedRoNumbers.has(roNumber)) {
        while (usedRoNumbers.has(nextRoNumber)) nextRoNumber++;
        roNumber = nextRoNumber;
        nextRoNumber++;
      }
      usedRoNumbers.add(roNumber);
      tasks.push({
        inv,
        vehicleId: veh.id,
        customerId: veh.customerId,
        roNumber,
      });
    }

    // Create ROs in parallel, capped at 8 concurrent to avoid Neon pool
    // exhaustion. Each create also nests laborLines/partLines/payments.
    let imported = 0;
    await mapConcurrent(tasks, 8, async (t) => {
      try {
        await createInvoiceRo(orgId, t.inv, t.vehicleId, t.customerId, t.roNumber);
        imported++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown";
        if (res.errors.length < 30) {
          res.errors.push(`Invoice #${t.inv.invoiceNumber}: ${msg}`);
        }
      }
    });
    res.stats.imported = imported;

    res.message = `Imported ${imported} invoices. Skipped: ${res.stats.skippedNoVin} (no VIN), ${res.stats.skippedNoVehicle} (vehicle not in DB), ${res.stats.skippedAlreadyImported} (already imported).`;
  } catch (e) {
    res.ok = false;
    res.message = e instanceof Error ? e.message : "Unknown error";
  }

  revalidatePath("/repair-orders");
  revalidatePath("/");
  return res;
}

async function createInvoiceRo(
  orgId: string,
  inv: ParsedInvoice,
  vehicleId: string,
  customerId: string,
  roNumber: number,
): Promise<void> {
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

  const marker = `[Identifix invoice #${inv.invoiceNumber}]`;
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

  await db.repairOrder.create({
    data: {
      orgId,
      roNumber,
      customerId,
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
      payments:
        paid > 0
          ? {
              create: {
                orgId,
                amount: paid,
                method: "OTHER",
                note: "Imported from Identifix invoice history",
                paidAt: openedAt,
              },
            }
          : undefined,
    },
  });
}
