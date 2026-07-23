import { z } from "zod";
import { db } from "@/lib/db";
import {
  createCalendarEventForOrg,
  deleteCalendarEventForOrg,
} from "@/lib/calendar";
import { createExpenseForOrg } from "@/lib/expenses";
import { createIncomeForOrg } from "@/lib/income";
import { createInventoryPart, adjustInventoryStock } from "@/lib/inventory";
import { createNoteForOrg } from "@/lib/notes";
import { enabledFeatureSet } from "@/lib/features";
import { computeTotals } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";

export type AssistantResult<T> = {
  data: T;
  confirmation: string;
};

const orgIdSchema = z.string().trim().min(1, "Organization is required.");
const dateInputSchema = z.union([z.date(), z.string().trim().min(1)]);

function parseDate(value: Date | string, label: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${label}.`);
  return date;
}

function requireOrgId(orgId: string): string {
  return orgIdSchema.parse(orgId);
}

const inventoryPartSchema = z.object({
  name: z.string().trim().min(1),
  partNumber: z.string().trim().optional(),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  location: z.string().trim().optional(),
  source: z.string().trim().optional(),
  costPrice: z.number().finite().nonnegative().optional(),
  unitPrice: z.number().finite().nonnegative().optional(),
  openingQuantity: z.number().finite().nonnegative().default(0),
  reorderLevel: z.number().finite().nonnegative().default(0),
});

export type CreateInventoryPartArgs = z.input<typeof inventoryPartSchema>;

export async function createAssistantInventoryPart(
  orgId: string,
  args: CreateInventoryPartArgs,
): Promise<AssistantResult<{ id: string; name: string; quantity: number }>> {
  const id = requireOrgId(orgId);
  const input = inventoryPartSchema.parse(args);
  const part = await createInventoryPart(
    id,
    {
      name: input.name,
      partNumber: input.partNumber,
      description: input.description,
      category: input.category,
      unit: input.unit,
      location: input.location,
      source: input.source,
      costPrice: input.costPrice,
      unitPrice: input.unitPrice,
      reorderLevel: input.reorderLevel,
    },
    input.openingQuantity,
  );
  return {
    data: { id: part.id, name: part.name, quantity: part.qtyOnHand },
    confirmation: `Created ${part.name} with ${part.qtyOnHand} in stock.`,
  };
}

const adjustInventorySchema = z
  .object({
    partId: z.string().trim().min(1).optional(),
    partName: z.string().trim().min(1).optional(),
    delta: z.number().finite().refine((value) => value !== 0),
    reason: z.enum(["RECEIVE", "ADJUST"]).default("ADJUST"),
    note: z.string().trim().optional(),
  })
  .refine((value) => value.partId || value.partName, {
    message: "A part id or name is required.",
  });

export type AdjustInventoryArgs = z.input<typeof adjustInventorySchema>;

export async function adjustAssistantInventory(
  orgId: string,
  args: AdjustInventoryArgs,
): Promise<
  AssistantResult<{ id: string; name: string; delta: number; quantity: number }>
> {
  const id = requireOrgId(orgId);
  const input = adjustInventorySchema.parse(args);
  let part = input.partId
    ? await db.part.findFirst({
        where: { id: input.partId, orgId: id },
      })
    : null;

  if (!part && input.partName) {
    const candidates = await db.part.findMany({
      where: { orgId: id },
      orderBy: { createdAt: "asc" },
    });
    const name = input.partName.toLowerCase();
    part = candidates.find((candidate) => candidate.name.toLowerCase() === name) ?? null;
  }

  if (!part) {
    if (!input.partName || input.delta < 0) {
      throw new Error("Inventory part not found.");
    }
    part = await createInventoryPart(id, { name: input.partName });
  }

  const updated = await adjustInventoryStock(
    id,
    part.id,
    input.delta,
    input.reason,
    input.note,
  );
  const direction = input.delta > 0 ? "Added" : "Removed";
  return {
    data: {
      id: updated.id,
      name: updated.name,
      delta: input.delta,
      quantity: updated.qtyOnHand,
    },
    confirmation: `${direction} ${Math.abs(input.delta)} ${updated.name} — now ${updated.qtyOnHand} in stock.`,
  };
}

const incomeSchema = z.object({
  amount: z.number().finite().positive(),
  receivedAt: dateInputSchema.optional(),
  source: z.string().trim().min(1),
  frequency: z.enum(["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY"]).default("ONE_TIME"),
  note: z.string().trim().optional(),
});

export type AddIncomeArgs = z.input<typeof incomeSchema>;

export async function addAssistantIncome(
  orgId: string,
  args: AddIncomeArgs,
): Promise<AssistantResult<{ id: string; amount: number; source: string }>> {
  const id = requireOrgId(orgId);
  const input = incomeSchema.parse(args);
  const org = await db.organization.findUnique({
    where: { id },
    select: { accountType: true, features: true },
  });
  if (!org) throw new Error("Organization not found.");
  const features = enabledFeatureSet(org);
  if (!features.has("financials") || features.has("invoices")) {
    throw new Error("Income logging is not available for this account.");
  }
  const income = await createIncomeForOrg(id, {
    amount: input.amount,
    receivedAt: input.receivedAt ? parseDate(input.receivedAt, "received date") : new Date(),
    source: input.source,
    frequency: input.frequency,
    note: input.note,
  });
  return {
    data: { id: income.id, amount: income.amount, source: income.source },
    confirmation: `Logged $${income.amount.toFixed(2)} income from ${income.source}.`,
  };
}

const expenseSchema = z.object({
  amount: z.number().finite().positive(),
  paidAt: dateInputSchema.optional(),
  category: z.string().trim().min(1).default("MISC"),
  vendor: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  method: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type AddExpenseArgs = z.input<typeof expenseSchema>;

export async function addAssistantExpense(
  orgId: string,
  args: AddExpenseArgs,
): Promise<AssistantResult<{ id: string; amount: number; category: string }>> {
  const id = requireOrgId(orgId);
  const input = expenseSchema.parse(args);
  const expense = await createExpenseForOrg(id, {
    amount: input.amount,
    paidAt: input.paidAt ? parseDate(input.paidAt, "paid date") : new Date(),
    category: input.category.toUpperCase(),
    vendor: input.vendor,
    reference: input.reference,
    method: input.method,
    note: input.note,
  });
  return {
    data: { id: expense.id, amount: expense.amount, category: expense.category },
    confirmation: `Logged $${expense.amount.toFixed(2)} expense${expense.vendor ? ` for ${expense.vendor}` : ""}.`,
  };
}

const noteSchema = z.object({
  title: z.string().trim().min(1),
  details: z.string().trim().optional(),
  tags: z.string().trim().optional(),
});

export type AddNoteArgs = z.input<typeof noteSchema>;

export async function addAssistantNote(
  orgId: string,
  args: AddNoteArgs,
): Promise<AssistantResult<{ id: string; title: string }>> {
  const id = requireOrgId(orgId);
  const input = noteSchema.parse(args);
  const note = await createNoteForOrg(id, {
    title: input.title,
    fix: input.details,
    tags: input.tags,
  });
  return {
    data: { id: note.id, title: note.title },
    confirmation: `Added note “${note.title}”.`,
  };
}

const readNoteSchema = z.object({
  title: z.string().trim().min(1),
});

export type ReadNoteArgs = z.input<typeof readNoteSchema>;

export async function readAssistantNote(
  orgId: string,
  args: ReadNoteArgs,
): Promise<AssistantResult<{ id: string; title: string; body: string }>> {
  const id = requireOrgId(orgId);
  const input = readNoteSchema.parse(args);
  const title = input.title.toLowerCase();
  const notes = await db.repairNote.findMany({
    where: { orgId: id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      fix: true,
      symptom: true,
      diagnosis: true,
      partsNotes: true,
      tags: true,
    },
  });
  const exact = notes.filter((note) => note.title.toLowerCase() === title);
  const matches = exact.length > 0
    ? exact
    : notes.filter((note) => note.title.toLowerCase().includes(title));
  const note = matches[0];
  if (!note) {
    return {
      data: { id: "", title: input.title, body: "" },
      confirmation: `I couldn't find a note titled '${input.title}'.`,
    };
  }
  const body = note.fix?.trim() || [
    note.symptom && `Symptom: ${note.symptom.trim()}`,
    note.diagnosis && `Diagnosis: ${note.diagnosis.trim()}`,
    note.partsNotes && `Parts: ${note.partsNotes.trim()}`,
    note.tags && `Tags: ${note.tags.trim()}`,
  ].filter(Boolean).join(". ");
  const content = body || "This note has no contents.";
  return {
    data: { id: note.id, title: note.title, body: content },
    confirmation: `Note '${note.title}': ${content}`,
  };
}

const calendarEventSchema = z.object({
  title: z.string().trim().min(1),
  startsAt: dateInputSchema,
  endsAt: dateInputSchema.optional(),
  allDay: z.boolean().default(false),
  isReminder: z.boolean().default(false),
  notes: z.string().trim().optional(),
});

export type AddCalendarEventArgs = z.input<typeof calendarEventSchema>;

export async function addAssistantCalendarEvent(
  orgId: string,
  args: AddCalendarEventArgs,
): Promise<AssistantResult<{ id: string; title: string; startsAt: Date }>> {
  const id = requireOrgId(orgId);
  const input = calendarEventSchema.parse(args);
  const event = await createCalendarEventForOrg(id, {
    title: input.title,
    startsAt: parseDate(input.startsAt, "start date"),
    endsAt: input.endsAt ? parseDate(input.endsAt, "end date") : null,
    allDay: input.allDay,
    isReminder: input.isReminder,
    notes: input.notes,
  });
  return {
    data: { id: event.id, title: event.title, startsAt: event.startsAt },
    confirmation: `Added ${event.allDay ? "all-day " : ""}event “${event.title}”.`,
  };
}

const removeCalendarEventSchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().trim().min(1).optional(),
});

export type RemoveCalendarEventArgs = z.input<typeof removeCalendarEventSchema>;

export async function removeAssistantCalendarEvent(
  orgId: string,
  args: RemoveCalendarEventArgs,
): Promise<AssistantResult<{ id: string; title: string; startsAt: Date }>> {
  const id = requireOrgId(orgId);
  const input = removeCalendarEventSchema.parse(args);
  const from = new Date();
  const events = await db.calendarEvent.findMany({
    where: {
      orgId: id,
      startsAt: { gte: from },
    },
    orderBy: { startsAt: "asc" },
  });
  const title = input.title.toLowerCase();
  const exactMatches = events.filter((event) => event.title.toLowerCase() === title);
  const titleMatches = exactMatches.length > 0
    ? exactMatches
    : events.filter((event) => event.title.toLowerCase().includes(title));
  let matches = titleMatches;
  if (input.date) {
    const date = parseDate(input.date, "event date");
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    matches = titleMatches.filter(
      (event) => event.startsAt >= new Date(date.getFullYear(), date.getMonth(), date.getDate()) &&
        event.startsAt < new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()),
    );
  }
  const event = matches[0];
  if (!event) {
    return {
      data: { id: "", title: input.title, startsAt: from },
      confirmation: input.date
        ? `I couldn't find an upcoming event titled '${input.title}' on ${input.date}.`
        : `I couldn't find an upcoming event titled '${input.title}'.`,
    };
  }
  await deleteCalendarEventForOrg(id, event.id);
  return {
    data: { id: event.id, title: event.title, startsAt: event.startsAt },
    confirmation: `Removed “${event.title}” on ${event.startsAt.toLocaleDateString()}.`,
  };
}

const periodSchema = z.object({
  from: dateInputSchema.optional(),
  to: dateInputSchema.optional(),
});

export type PeriodArgs = z.input<typeof periodSchema>;

type FinancialSummary = {
  from: Date;
  to: Date;
  moneyIn: number;
  moneyOut: number;
  net: number;
  source: "income" | "payments";
};

function resolvePeriod(input: PeriodArgs): { from: Date; to: Date } {
  const now = new Date();
  const from = input.from
    ? parseDate(input.from, "period start")
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = input.to ? parseDate(input.to, "period end") : now;
  if (to < from) throw new Error("Period end must be after period start.");
  return { from, to };
}

export async function getAssistantFinancialSummary(
  orgId: string,
  args: PeriodArgs = {},
): Promise<AssistantResult<FinancialSummary>> {
  const id = requireOrgId(orgId);
  const { from, to } = resolvePeriod(periodSchema.parse(args));
  const org = await db.organization.findUnique({
    where: { id },
    select: { accountType: true, features: true },
  });
  if (!org) throw new Error("Organization not found.");
  const hasInvoices = enabledFeatureSet(org).has("invoices");
  const [expenses, moneyIn] = await Promise.all([
    db.expense.findMany({
      where: { orgId: id, paidAt: { gte: from, lte: to } },
      select: { amount: true },
    }),
    hasInvoices
      ? db.payment.findMany({
          where: { orgId: id, paidAt: { gte: from, lte: to } },
          select: { amount: true },
        })
      : db.income.findMany({
          where: { orgId: id, receivedAt: { gte: from, lte: to } },
          select: { amount: true },
        }),
  ]);
  const moneyInTotal = moneyIn.reduce((sum, row) => sum + row.amount, 0);
  const moneyOut = expenses.reduce((sum, row) => sum + row.amount, 0);
  return {
    data: {
      from,
      to,
      moneyIn: moneyInTotal,
      moneyOut,
      net: moneyInTotal - moneyOut,
      source: hasInvoices ? "payments" : "income",
    },
    confirmation: `Money in is $${moneyInTotal.toFixed(2)}, money out is $${moneyOut.toFixed(2)}, and net is $${(moneyInTotal - moneyOut).toFixed(2)}.`,
  };
}

type InventorySummary = {
  totalParts: number;
  parts: Array<{ id: string; name: string; quantity: number; reorderLevel: number }>;
  lowStock: Array<{ id: string; name: string; quantity: number; reorderLevel: number }>;
};

export async function getAssistantInventoryOverview(
  orgId: string,
): Promise<AssistantResult<InventorySummary>> {
  const id = requireOrgId(orgId);
  const parts = await db.part.findMany({
    where: { orgId: id, archived: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, qtyOnHand: true, reorderLevel: true },
  });
  const lowStock = parts
    .filter((part) => part.qtyOnHand <= part.reorderLevel)
    .map((part) => ({
      id: part.id,
      name: part.name,
      quantity: part.qtyOnHand,
      reorderLevel: part.reorderLevel,
    }));
  return {
    data: {
      totalParts: parts.length,
      parts: parts.map((part) => ({
        id: part.id,
        name: part.name,
        quantity: part.qtyOnHand,
        reorderLevel: part.reorderLevel,
      })),
      lowStock,
    },
    confirmation:
      lowStock.length === 0
        ? `${parts.length} inventory parts are stocked; none are low.`
        : `${lowStock.length} inventory part${lowStock.length === 1 ? " is" : "s are"} low in stock.`,
  };
}

const upcomingSchema = z.object({
  from: dateInputSchema.optional(),
  limit: z.number().int().positive().max(50).default(10),
});

export type UpcomingEventsArgs = z.input<typeof upcomingSchema>;

export async function getAssistantUpcomingEvents(
  orgId: string,
  args: UpcomingEventsArgs = {},
): Promise<
  AssistantResult<
    Array<{
      id: string;
      title: string;
      startsAt: Date;
      endsAt: Date | null;
      allDay: boolean;
      isReminder: boolean;
      notes: string | null;
    }>
  >
> {
  const id = requireOrgId(orgId);
  const input = upcomingSchema.parse(args);
  const from = input.from ? parseDate(input.from, "start date") : new Date();
  const events = await db.calendarEvent.findMany({
    where: { orgId: id, startsAt: { gte: from } },
    orderBy: { startsAt: "asc" },
    take: input.limit,
  });
  return {
    data: events,
    confirmation:
      events.length === 0
        ? "There are no upcoming calendar events."
        : `You have ${events.length} upcoming calendar event${events.length === 1 ? "" : "s"}.`,
  };
}

const reportsSchema = periodSchema;

export type ReportsSummaryArgs = z.input<typeof reportsSchema>;

export async function getAssistantReportsSummary(
  orgId: string,
  args: ReportsSummaryArgs = {},
): Promise<
  AssistantResult<{
    from: Date;
    to: Date;
    revenue: number;
    partsCost: number;
    expenses: number;
    netProfit: number;
    accountsReceivable: number;
    openRepairOrders: number;
    invoicedRepairOrders: number;
  }>
> {
  const id = requireOrgId(orgId);
  const { from, to } = resolvePeriod(reportsSchema.parse(args));
  const [allROs, payments, expenses, openRepairOrders, invoicedRepairOrders] =
    await Promise.all([
      db.repairOrder.findMany({
        where: { orgId: id },
        include: {
          customer: true,
          laborLines: true,
          partLines: { include: { part: true } },
          feeLines: true,
          payments: true,
        },
      }),
      db.payment.findMany({
        where: { orgId: id, paidAt: { gte: from, lte: to } },
        select: { amount: true },
      }),
      db.expense.findMany({
        where: { orgId: id, paidAt: { gte: from, lte: to } },
        select: { amount: true },
      }),
      db.repairOrder.count({
        where: { orgId: id, status: { in: ["ESTIMATE", "IN_PROGRESS", "COMPLETED"] } },
      }),
      db.repairOrder.count({ where: { orgId: id, status: "INVOICED" } }),
    ]);
  const arCandidates = allROs.filter((ro) => ro.status === "INVOICED");
  const arFees = await loadAppliedShopFeesForROs(
    id,
    arCandidates.map((ro) => {
      const totals = computeTotals(ro);
      return {
        id: ro.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );
  const accountsReceivable = arCandidates.reduce((sum, ro) => {
    const total = computeTotals({
      ...ro,
      shopFees: arFees.get(ro.id) ?? [],
    }).total;
    const paid = ro.payments.reduce((paidTotal, payment) => paidTotal + payment.amount, 0);
    return sum + Math.max(0, total - paid);
  }, 0);
  const partsCost = allROs
    .filter((ro) => ro.openedAt >= from && ro.openedAt <= to)
    .flatMap((ro) => ro.partLines)
    .reduce((sum, line) => {
      const cost = line.costPrice ?? line.part?.costPrice ?? null;
      return cost == null ? sum : sum + line.quantity * cost;
    }, 0);
  const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = revenue - partsCost - expenseTotal;
  return {
    data: {
      from,
      to,
      revenue,
      partsCost,
      expenses: expenseTotal,
      netProfit,
      accountsReceivable,
      openRepairOrders,
      invoicedRepairOrders,
    },
    confirmation: `Reports show $${revenue.toFixed(2)} revenue, $${expenseTotal.toFixed(2)} expenses, and $${netProfit.toFixed(2)} net profit.`,
  };
}
