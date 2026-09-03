import JSZip from "jszip";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { requireFinancialAccess } from "@/lib/permissions";
import { APP_NAME } from "@/lib/branding";

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

function extFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

function addAttachment(
  zip: JSZip,
  dataUrl: string,
  directory: string,
  id: string,
): string {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return "";
  const path = `attachments/${directory}/${id}.${extFor(match[1])}`;
  zip.file(path, Buffer.from(match[2], "base64"));
  return path;
}

function slugFor(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vultrix"
  );
}

export async function GET() {
  await requireFinancialAccess();
  const orgId = await requireOrgId();
  const [
    customers,
    vehicles,
    repairOrders,
    laborLines,
    laborLineTech,
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
    sales,
    income,
    goals,
    goalCheckIns,
    goalEntries,
    goalMilestones,
    routines,
    routineItems,
    routineCheckOffs,
    budgets,
    recurringEntries,
    calendarEvents,
    recurringInvoices,
    recurringInvoiceLines,
    jobs,
    feeLines,
    customerContacts,
    categories,
    serviceLogs,
    reminderLogs,
    activityLogs,
    expenseReceipts,
    noteImages,
    repairOrderPhotos,
  ] = await Promise.all([
    db.customer.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.vehicle.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.repairOrder.findMany({ where: { orgId }, orderBy: { roNumber: "asc" } }),
    db.laborLine.findMany({
      where: { repairOrder: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.laborLineTech.findMany({
      where: { laborLine: { repairOrder: { orgId } } },
      orderBy: { laborLineId: "asc" },
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
    db.sale.findMany({ where: { orgId }, orderBy: { soldAt: "asc" } }),
    db.income.findMany({ where: { orgId }, orderBy: { receivedAt: "asc" } }),
    db.goal.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.goalCheckIn.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.goalEntry.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.goalMilestone.findMany({
      where: { orgId },
      orderBy: [{ goalId: "asc" }, { position: "asc" }],
    }),
    db.routine.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    db.routineItem.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.routineCheckOff.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.budget.findMany({ where: { orgId }, orderBy: { category: "asc" } }),
    db.recurringEntry.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.calendarEvent.findMany({
      where: { orgId },
      orderBy: { startsAt: "asc" },
    }),
    db.recurringInvoice.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.recurringInvoiceLine.findMany({
      where: { recurringInvoice: { orgId } },
      orderBy: { sortOrder: "asc" },
    }),
    db.job.findMany({
      where: { repairOrder: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.feeLine.findMany({
      where: { repairOrder: { orgId } },
      orderBy: { createdAt: "asc" },
    }),
    db.customerContact.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    db.serviceLog.findMany({
      where: { vehicle: { orgId } },
      include: { interval: { select: { key: true, label: true } } },
      orderBy: { performedAt: "asc" },
    }),
    db.reminderLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.activityLog.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.expenseReceipt.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.noteImage.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
    db.repairOrderPhoto.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
    }),
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
    "labor-line-tech.csv",
    csv(
      laborLineTech.map((assignment) => ({
        laborLineId: assignment.laborLineId,
        technicianId: assignment.technicianId,
        hours: assignment.hours,
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
    "sales.csv",
    csv(
      sales.map((s) => ({
        id: s.id,
        orgId: s.orgId,
        soldAt: toIso(s.soldAt),
        partId: s.partId ?? "",
        itemName: s.itemName,
        quantity: s.quantity,
        unitPrice: s.unitPrice,
        unitCost: s.unitCost ?? "",
        channel: s.channel ?? "",
        note: s.note ?? "",
        incomeId: s.incomeId ?? "",
        createdAt: toIso(s.createdAt),
        updatedAt: toIso(s.updatedAt),
      })),
    ),
  );

  zip.file(
    "income.csv",
    csv(
      income.map((i) => ({
        id: i.id,
        receivedAt: toIso(i.receivedAt),
        amount: i.amount,
        source: i.source,
        frequency: i.frequency,
        note: i.note ?? "",
        createdAt: toIso(i.createdAt),
        updatedAt: toIso(i.updatedAt),
        orgId: i.orgId,
        recurringId: i.recurringId ?? "",
      })),
    ),
  );

  zip.file(
    "goals.csv",
    csv(
      goals.map((g) => ({
        id: g.id,
        orgId: g.orgId,
        title: g.title,
        metric: g.metric,
        target: g.target,
        period: g.period,
        category: g.category ?? "",
        startDate: toIso(g.startDate),
        dueDate: toIso(g.dueDate),
        manualProgress: g.manualProgress ?? "",
        direction: g.direction,
        unit: g.unit ?? "",
        notes: g.notes ?? "",
        archived: g.archived,
        createdAt: toIso(g.createdAt),
        updatedAt: toIso(g.updatedAt),
      })),
    ),
  );

  zip.file(
    "goal-check-ins.csv",
    csv(
      goalCheckIns.map((c) => ({
        id: c.id,
        goalId: c.goalId,
        orgId: c.orgId,
        day: c.day,
        note: c.note ?? "",
        createdAt: toIso(c.createdAt),
      })),
    ),
  );

  zip.file(
    "goal-entries.csv",
    csv(
      goalEntries.map((e) => ({
        id: e.id,
        goalId: e.goalId,
        orgId: e.orgId,
        day: e.day,
        value: e.value,
        note: e.note ?? "",
        createdAt: toIso(e.createdAt),
      })),
    ),
  );

  zip.file(
    "goal-milestones.csv",
    csv(
      goalMilestones.map((m) => ({
        id: m.id,
        goalId: m.goalId,
        orgId: m.orgId,
        title: m.title,
        position: m.position,
        dueDay: m.dueDay ?? "",
        doneDay: m.doneDay ?? "",
        doneByUserId: m.doneByUserId ?? "",
        createdAt: toIso(m.createdAt),
        updatedAt: toIso(m.updatedAt),
      })),
    ),
  );

  zip.file(
    "routines.csv",
    csv(
      routines.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        goalId: r.goalId ?? "",
        title: r.title,
        kind: r.kind,
        weekdays: r.weekdays ?? "",
        day: r.day ?? "",
        dueTime: r.dueTime ?? "",
        archived: r.archived,
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt),
      })),
    ),
  );

  zip.file(
    "routine-items.csv",
    csv(
      routineItems.map((i) => ({
        id: i.id,
        routineId: i.routineId,
        orgId: i.orgId,
        label: i.label,
        target: i.target ?? "",
        unit: i.unit ?? "",
        dueTime: i.dueTime ?? "",
        position: i.position,
        createdAt: toIso(i.createdAt),
      })),
    ),
  );

  zip.file(
    "routine-check-offs.csv",
    csv(
      routineCheckOffs.map((c) => ({
        id: c.id,
        itemId: c.itemId,
        routineId: c.routineId,
        orgId: c.orgId,
        day: c.day,
        late: c.late,
        note: c.note ?? "",
        value: c.value ?? "",
        createdAt: toIso(c.createdAt),
      })),
    ),
  );

  zip.file(
    "budgets.csv",
    csv(
      budgets.map((b) => ({
        id: b.id,
        orgId: b.orgId,
        category: b.category,
        amount: b.amount,
        createdAt: toIso(b.createdAt),
        updatedAt: toIso(b.updatedAt),
      })),
    ),
  );

  zip.file(
    "recurring-entries.csv",
    csv(
      recurringEntries.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        kind: r.kind,
        amount: r.amount,
        interval: r.interval,
        startDate: toIso(r.startDate),
        endDate: toIso(r.endDate),
        nextRunAt: toIso(r.nextRunAt),
        lastPostedAt: toIso(r.lastPostedAt),
        autoPost: r.autoPost,
        active: r.active,
        category: r.category ?? "",
        vendor: r.vendor ?? "",
        method: r.method ?? "",
        reference: r.reference ?? "",
        source: r.source ?? "",
        note: r.note ?? "",
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt),
      })),
    ),
  );

  zip.file(
    "calendar-events.csv",
    csv(
      calendarEvents.map((e) => ({
        id: e.id,
        orgId: e.orgId,
        title: e.title,
        startsAt: toIso(e.startsAt),
        endsAt: toIso(e.endsAt),
        allDay: e.allDay,
        isReminder: e.isReminder,
        notes: e.notes ?? "",
        createdAt: toIso(e.createdAt),
        updatedAt: toIso(e.updatedAt),
      })),
    ),
  );

  zip.file(
    "recurring-invoices.csv",
    csv(
      recurringInvoices.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        customerId: r.customerId,
        vehicleId: r.vehicleId ?? "",
        interval: r.interval,
        startDate: toIso(r.startDate),
        endDate: toIso(r.endDate),
        nextRunAt: toIso(r.nextRunAt),
        lastPostedAt: toIso(r.lastPostedAt),
        autoPost: r.autoPost,
        active: r.active,
        taxRate: r.taxRate,
        discount: r.discount,
        label: r.label ?? "",
        notes: r.notes ?? "",
        createdAt: toIso(r.createdAt),
        updatedAt: toIso(r.updatedAt),
      })),
    ),
  );

  zip.file(
    "recurring-invoice-lines.csv",
    csv(
      recurringInvoiceLines.map((l) => ({
        id: l.id,
        recurringInvoiceId: l.recurringInvoiceId,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        partNumber: l.partNumber ?? "",
        sortOrder: l.sortOrder,
      })),
    ),
  );

  zip.file(
    "jobs.csv",
    csv(
      jobs.map((j) => ({
        id: j.id,
        repairOrderId: j.repairOrderId,
        name: j.name,
        sortOrder: j.sortOrder,
        notes: j.notes ?? "",
        approvalStatus: j.approvalStatus,
        approvedAt: toIso(j.approvedAt),
        declinedAt: toIso(j.declinedAt),
        customerNote: j.customerNote ?? "",
        createdAt: toIso(j.createdAt),
      })),
    ),
  );

  zip.file(
    "fee-lines.csv",
    csv(
      feeLines.map((f) => ({
        id: f.id,
        repairOrderId: f.repairOrderId,
        jobId: f.jobId ?? "",
        description: f.description,
        amount: f.amount,
        sortOrder: f.sortOrder,
        createdAt: toIso(f.createdAt),
      })),
    ),
  );

  zip.file(
    "customer-contacts.csv",
    csv(
      customerContacts.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        orgId: c.orgId,
        kind: c.kind,
        value: c.value,
        label: c.label ?? "",
        isPrimary: c.isPrimary,
        sortOrder: c.sortOrder,
        createdAt: toIso(c.createdAt),
        updatedAt: toIso(c.updatedAt),
      })),
    ),
  );

  zip.file(
    "categories.csv",
    csv(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        orgId: c.orgId,
        createdAt: toIso(c.createdAt),
        updatedAt: toIso(c.updatedAt),
      })),
    ),
  );

  zip.file(
    "service-logs.csv",
    csv(
      serviceLogs.map((s) => ({
        id: s.id,
        vehicleId: s.vehicleId,
        intervalId: s.intervalId,
        intervalKey: s.interval.key,
        intervalLabel: s.interval.label,
        performedAt: toIso(s.performedAt),
        atMileage: s.atMileage ?? "",
        source: s.source,
        note: s.note ?? "",
        createdAt: toIso(s.createdAt),
      })),
    ),
  );

  zip.file(
    "reminder-log.csv",
    csv(
      reminderLogs.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        kind: r.kind,
        targetKey: r.targetKey,
        channel: r.channel,
        to: r.to,
        status: r.status,
        detail: r.detail ?? "",
        createdAt: toIso(r.createdAt),
      })),
    ),
  );

  zip.file(
    "activity-log.csv",
    csv(
      activityLogs.map((a) => ({
        id: a.id,
        orgId: a.orgId,
        userId: a.userId ?? "",
        username: a.username,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId ?? "",
        summary: a.summary,
        createdAt: toIso(a.createdAt),
      })),
    ),
  );

  zip.file(
    "expense-receipts.csv",
    csv(
      expenseReceipts.map((r) => ({
        id: r.id,
        expenseId: r.expenseId,
        orgId: r.orgId,
        createdAt: toIso(r.createdAt),
        file: addAttachment(zip, r.dataUrl, "expense-receipts", r.id),
      })),
    ),
  );

  zip.file(
    "note-images.csv",
    csv(
      noteImages.map((i) => ({
        id: i.id,
        noteId: i.noteId,
        orgId: i.orgId,
        caption: i.caption ?? "",
        sortOrder: i.sortOrder,
        createdAt: toIso(i.createdAt),
        file: addAttachment(zip, i.dataUrl, "note-images", i.id),
      })),
    ),
  );

  zip.file(
    "repair-order-photos.csv",
    csv(
      repairOrderPhotos.map((p) => ({
        id: p.id,
        repairOrderId: p.repairOrderId,
        orgId: p.orgId,
        caption: p.caption ?? "",
        sortOrder: p.sortOrder,
        createdAt: toIso(p.createdAt),
        file: addAttachment(zip, p.dataUrl, "repair-order-photos", p.id),
      })),
    ),
  );

  zip.file(
    "settings.csv",
    csv(
      settings.map((s) => ({
        key: s.key,
        value: s.value,
      })),
    ),
  );

  const readme = [
    `${APP_NAME} — data export`,
    `Exported: ${new Date().toISOString()}`,
    "",
    "Each CSV is a direct dump of one table. Use IDs to cross-reference:",
    "  customers.id → vehicles.customerId, repair-orders.customerId, appointments.customerId",
    "  customers.id → customer-contacts.customerId",
    "  vehicles.id → repair-orders.vehicleId, appointments.vehicleId",
    "  repair-orders.id → labor-lines.repairOrderId, part-lines.repairOrderId, payments.repairOrderId, appointments.repairOrderId, jobs.repairOrderId, fee-lines.repairOrderId, repair-order-photos.repairOrderId",
    "  goals.id → goal-check-ins.goalId, goal-entries.goalId, goal-milestones.goalId, routines.goalId",
    "  users.id → goal-milestones.doneByUserId",
    "  routines.id → routine-items.routineId",
    "  routine-items.id → routine-check-offs.itemId",
    "  income.id → sales.incomeId",
    "  inventory-parts.id → part-lines.partId, stock-moves.partId, canned-job-parts.partId",
    "  expenses.id → expense-receipts.expenseId",
    "  notes.id → note-images.noteId",
    "  technicians.id → labor-lines.technicianId",
    "  labor-lines.id + technicians.id → labor-line-tech.laborLineId + labor-line-tech.technicianId",
    "  canned-jobs.id → canned-job-labor.cannedJobId, canned-job-parts.cannedJobId",
    "",
    "Attachments are in attachments/ and are referenced by each row's file column.",
    "Open any CSV in Excel, Google Sheets, Numbers, or any spreadsheet app.",
  ].join("\n");
  zip.file("README.txt", readme);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${slugFor(APP_NAME)}-export-${new Date()
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
