import JSZip from "jszip";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

export const dynamic = "force-dynamic";

function toIso(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString();
}

function csv<T extends object>(rows: T[]): string {
  if (rows.length === 0) {
    return "";
  }
  return Papa.unparse(rows as unknown as object[], {
    header: true,
    quotes: true,
  });
}

export async function GET() {
  const orgId = await requireOrgId();
  const [
    customers,
    vehicles,
    repairOrders,
    laborLines,
    partLines,
    payments,
    parts,
    stockMoves,
    appointments,
    notes,
    technicians,
    expenses,
    cannedJobs,
    cannedJobLabor,
    cannedJobParts,
    settings,
  ] = await Promise.all([
    db.customer.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.vehicle.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.repairOrder.findMany({ where: { orgId }, orderBy: { roNumber: "asc" } }),
    db.laborLine.findMany({
      where: { repairOrder: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.partLine.findMany({
      where: { repairOrder: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.payment.findMany({ where: { orgId }, orderBy: { paidAt: "asc" } }),
    db.part.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.stockMove.findMany({
      where: { part: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.appointment.findMany({ where: { orgId }, orderBy: { startsAt: "asc" } }),
    db.repairNote.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.technician.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.expense.findMany({ where: { orgId }, orderBy: { paidAt: "asc" } }),
    db.cannedJob.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.cannedJobLabor.findMany({
      where: { cannedJob: { orgId } },
      orderBy: { sortOrder: "asc" },
    }),
    db.cannedJobPart.findMany({
      where: { cannedJob: { orgId } },
      orderBy: { sortOrder: "asc" },
    }),
    db.shopSetting.findMany({ where: { orgId }, orderBy: { key: "asc" } }),
  ]);

  const zip = new JSZip();

  zip.file(
    "customers.csv",
    csv(
      customers.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
        altPhone: c.altPhone ?? "",
        street: c.street ?? "",
        city: c.city ?? "",
        state: c.state ?? "",
        zip: c.zip ?? "",
        notes: c.notes ?? "",
        createdAt: toIso(c.createdAt),
        updatedAt: toIso(c.updatedAt),
      })),
    ),
  );

  zip.file(
    "vehicles.csv",
    csv(
      vehicles.map((v) => ({
        id: v.id,
        customerId: v.customerId,
        year: v.year ?? "",
        make: v.make ?? "",
        model: v.model ?? "",
        trim: v.trim ?? "",
        engine: v.engine ?? "",
        transmission: v.transmission ?? "",
        drivetrain: v.drivetrain ?? "",
        vin: v.vin ?? "",
        licensePlate: v.licensePlate ?? "",
        color: v.color ?? "",
        mileage: v.mileage ?? "",
        notes: v.notes ?? "",
        createdAt: toIso(v.createdAt),
        updatedAt: toIso(v.updatedAt),
      })),
    ),
  );

  zip.file(
    "repair-orders.csv",
    csv(
      repairOrders.map((r) => ({
        id: r.id,
        roNumber: r.roNumber,
        customerId: r.customerId,
        vehicleId: r.vehicleId,
        status: r.status,
        complaint: r.complaint ?? "",
        cause: r.cause ?? "",
        correction: r.correction ?? "",
        mileageIn: r.mileageIn ?? "",
        mileageOut: r.mileageOut ?? "",
        taxRate: r.taxRate ?? "",
        discount: r.discount ?? "",
        notes: r.notes ?? "",
        openedAt: toIso(r.openedAt),
        startedAt: toIso(r.startedAt),
        completedAt: toIso(r.completedAt),
        invoicedAt: toIso(r.invoicedAt),
        paidAt: toIso(r.paidAt),
        cancelledAt: toIso(r.cancelledAt),
        approvedAt: toIso(r.approvedAt),
        estimateDeclinedAt: toIso(r.estimateDeclinedAt),
        customerResponseNote: r.customerResponseNote ?? "",
      })),
    ),
  );

  zip.file(
    "labor-lines.csv",
    csv(
      laborLines.map((l) => ({
        id: l.id,
        repairOrderId: l.repairOrderId,
        technicianId: l.technicianId ?? "",
        description: l.description,
        hours: l.hours,
        rate: l.rate,
        sortOrder: l.sortOrder,
        createdAt: toIso(l.createdAt),
      })),
    ),
  );

  zip.file(
    "part-lines.csv",
    csv(
      partLines.map((p) => ({
        id: p.id,
        repairOrderId: p.repairOrderId,
        partId: p.partId ?? "",
        partNumber: p.partNumber ?? "",
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice ?? "",
        source: p.source ?? "",
        sortOrder: p.sortOrder,
        createdAt: toIso(p.createdAt),
      })),
    ),
  );

  zip.file(
    "payments.csv",
    csv(
      payments.map((p) => ({
        id: p.id,
        repairOrderId: p.repairOrderId,
        amount: p.amount,
        method: p.method,
        reference: p.reference ?? "",
        paidAt: toIso(p.paidAt),
      })),
    ),
  );

  zip.file(
    "inventory-parts.csv",
    csv(
      parts.map((p) => ({
        id: p.id,
        name: p.name,
        partNumber: p.partNumber ?? "",
        description: p.description ?? "",
        source: p.source ?? "",
        costPrice: p.costPrice ?? "",
        unitPrice: p.unitPrice ?? "",
        qtyOnHand: p.qtyOnHand,
        reorderLevel: p.reorderLevel,
        archived: p.archived,
        notes: p.notes ?? "",
        createdAt: toIso(p.createdAt),
        updatedAt: toIso(p.updatedAt),
      })),
    ),
  );

  zip.file(
    "stock-moves.csv",
    csv(
      stockMoves.map((s) => ({
        id: s.id,
        partId: s.partId,
        delta: s.delta,
        reason: s.reason,
        note: s.note ?? "",
        partLineId: s.partLineId ?? "",
        createdAt: toIso(s.createdAt),
      })),
    ),
  );

  zip.file(
    "appointments.csv",
    csv(
      appointments.map((a) => ({
        id: a.id,
        customerId: a.customerId,
        vehicleId: a.vehicleId ?? "",
        repairOrderId: a.repairOrderId ?? "",
        reason: a.reason,
        startsAt: toIso(a.startsAt),
        durationMinutes: a.durationMinutes,
        status: a.status,
        notes: a.notes ?? "",
        createdAt: toIso(a.createdAt),
      })),
    ),
  );

  zip.file(
    "notes.csv",
    csv(
      notes.map((n) => ({
        id: n.id,
        title: n.title,
        yearMin: n.yearMin ?? "",
        yearMax: n.yearMax ?? "",
        make: n.make ?? "",
        model: n.model ?? "",
        engine: n.engine ?? "",
        symptom: n.symptom ?? "",
        diagnosis: n.diagnosis ?? "",
        fix: n.fix ?? "",
        partsNotes: n.partsNotes ?? "",
        laborHoursEstimate: n.laborHoursEstimate ?? "",
        tags: n.tags ?? "",
        createdAt: toIso(n.createdAt),
        updatedAt: toIso(n.updatedAt),
      })),
    ),
  );

  zip.file(
    "technicians.csv",
    csv(
      technicians.map((t) => ({
        id: t.id,
        name: t.name,
        initials: t.initials ?? "",
        defaultRate: t.defaultRate ?? "",
        active: t.active,
        notes: t.notes ?? "",
        createdAt: toIso(t.createdAt),
      })),
    ),
  );

  zip.file(
    "expenses.csv",
    csv(
      expenses.map((e) => ({
        id: e.id,
        paidAt: toIso(e.paidAt),
        amount: e.amount,
        category: e.category,
        vendor: e.vendor ?? "",
        reference: e.reference ?? "",
        method: e.method ?? "",
        note: e.note ?? "",
        createdAt: toIso(e.createdAt),
      })),
    ),
  );

  zip.file(
    "canned-jobs.csv",
    csv(
      cannedJobs.map((j) => ({
        id: j.id,
        name: j.name,
        description: j.description ?? "",
        category: j.category ?? "",
        notes: j.notes ?? "",
        archived: j.archived,
        createdAt: toIso(j.createdAt),
      })),
    ),
  );

  zip.file(
    "canned-job-labor.csv",
    csv(
      cannedJobLabor.map((l) => ({
        id: l.id,
        cannedJobId: l.cannedJobId,
        description: l.description,
        hours: l.hours,
        rate: l.rate ?? "",
        sortOrder: l.sortOrder,
      })),
    ),
  );

  zip.file(
    "canned-job-parts.csv",
    csv(
      cannedJobParts.map((p) => ({
        id: p.id,
        cannedJobId: p.cannedJobId,
        partId: p.partId ?? "",
        partNumber: p.partNumber ?? "",
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice ?? "",
        sortOrder: p.sortOrder,
      })),
    ),
  );

  zip.file(
    "shop-settings.csv",
    csv(
      settings.map((s) => ({
        key: s.key,
        value: s.value,
      })),
    ),
  );

  const readme = [
    "QNA / Noor Auto Repair — data export",
    `Exported: ${new Date().toISOString()}`,
    "",
    "Each CSV is a direct dump of one table. Use IDs to cross-reference:",
    "  customers.id → vehicles.customerId, repair-orders.customerId, appointments.customerId",
    "  vehicles.id → repair-orders.vehicleId, appointments.vehicleId",
    "  repair-orders.id → labor-lines.repairOrderId, part-lines.repairOrderId, payments.repairOrderId, appointments.repairOrderId",
    "  inventory-parts.id → part-lines.partId, stock-moves.partId, canned-job-parts.partId",
    "  technicians.id → labor-lines.technicianId",
    "  canned-jobs.id → canned-job-labor.cannedJobId, canned-job-parts.cannedJobId",
    "",
    "Open any CSV in Excel, Google Sheets, Numbers, or any spreadsheet app.",
  ].join("\n");
  zip.file("README.txt", readme);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `qna-noor-auto-export-${new Date()
    .toISOString()
    .slice(0, 10)}.zip`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
