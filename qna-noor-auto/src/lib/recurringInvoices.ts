import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { enabledFeatureSet } from "@/lib/features";
import { applyShopFees, computeTotals, type ShopFeeConfig } from "@/lib/totals";
import {
  endOfTodayUTC,
  nthOccurrence,
  RECURRING_INTERVALS,
  type RecurringInterval,
} from "@/lib/recurring";
import { getNextRoNumber } from "@/lib/shop";

export type RecurringInvoiceDueOccurrence = {
  recurringId: string;
  occurrence: Date;
  label: string | null;
  customerName: string;
  interval: string;
  total: number;
};

type InvoiceSeries = {
  id: string;
  orgId: string;
  customerId: string;
  vehicleId: string | null;
  interval: string;
  startDate: Date;
  endDate: Date | null;
  nextRunAt: Date;
  lastPostedAt: Date | null;
  autoPost: boolean;
  active: boolean;
  taxRate: number;
  discount: number;
  label: string | null;
  notes: string | null;
  createdAt: Date;
  lines: Array<{
    kind: string;
    description: string;
    quantity: number;
    unitPrice: number;
    partNumber: string | null;
    sortOrder: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    companyName: string | null;
  };
};

function duplicateTarget(error: unknown): string[] {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return [];
  const target = error.meta?.target;
  return Array.isArray(target) ? target.map(String) : [];
}

function isOccurrenceDuplicate(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    duplicateTarget(error).includes("recurringInvoiceId")
  );
}

function nextOccurrenceAfter(
  series: Pick<InvoiceSeries, "startDate" | "interval">,
  current: Date,
): Date {
  const interval = series.interval as RecurringInterval;
  let occurrenceNumber = 0;
  let candidate = nthOccurrence(series.startDate, interval, occurrenceNumber);
  while (candidate.getTime() <= current.getTime()) {
    occurrenceNumber += 1;
    candidate = nthOccurrence(series.startDate, interval, occurrenceNumber);
    if (occurrenceNumber > 100000) {
      throw new Error("Could not advance recurring invoice series");
    }
  }
  return candidate;
}

function customerName(customer: InvoiceSeries["customer"]): string {
  return (
    customer.companyName ||
    `${customer.firstName} ${customer.lastName}`.trim()
  );
}

function templateTotal(
  series: Pick<InvoiceSeries, "lines" | "taxRate" | "discount">,
  shopFees: ShopFeeConfig[],
): number {
  const input = {
    laborLines: series.lines
      .filter((line) => line.kind === "LABOR")
      .map((line) => ({ hours: line.quantity, rate: line.unitPrice })),
    partLines: series.lines
      .filter((line) => line.kind === "PART")
      .map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })),
    feeLines: series.lines
      .filter((line) => line.kind === "FEE")
      .map((line) => ({ amount: line.unitPrice })),
    taxRate: series.taxRate,
    discount: series.discount,
  };
  const preliminary = computeTotals(input);
  const appliedShopFees = applyShopFees(shopFees, {
    partsSubtotal: preliminary.partsSubtotal,
    laborSubtotal: preliminary.laborSubtotal,
  });
  return Math.round(
    computeTotals({ ...input, shopFees: appliedShopFees }).total * 100,
  ) / 100;
}

function canUseInvoiceFeature(organization: {
  accountType: string;
  features: string[];
} | null): boolean {
  return organization != null && enabledFeatureSet(organization).has("invoices");
}

async function loadInvoiceSeries(
  orgId: string,
  recurringId: string,
): Promise<InvoiceSeries | null> {
  return db.recurringInvoice.findFirst({
    where: { id: recurringId, orgId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: {
        select: { firstName: true, lastName: true, companyName: true },
      },
    },
  });
}

async function advanceSeries(
  series: Pick<
    InvoiceSeries,
    "id" | "orgId" | "nextRunAt" | "endDate"
  >,
  occurrence: Date,
  nextRunAt: Date,
  posted: boolean,
): Promise<boolean> {
  const ended =
    series.endDate != null && nextRunAt.getTime() > series.endDate.getTime();
  const result = await db.recurringInvoice.updateMany({
    where: {
      id: series.id,
      orgId: series.orgId,
      active: true,
      nextRunAt: occurrence,
    },
    data: {
      nextRunAt,
      ...(posted ? { lastPostedAt: occurrence } : {}),
      ...(ended ? { active: false } : {}),
    },
  });
  return result.count === 1;
}

async function issueOne(
  series: InvoiceSeries,
  occurrence: Date,
): Promise<boolean> {
  if (series.endDate && occurrence.getTime() > series.endDate.getTime()) {
    const nextRunAt = nextOccurrenceAfter(series, occurrence);
    await advanceSeries(series, occurrence, nextRunAt, false);
    return false;
  }

  let invoiceId: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await db.$transaction(async (tx) => {
      const roNumber = await getNextRoNumber(series.orgId);
      const repairOrder = await tx.repairOrder.create({
        data: {
          orgId: series.orgId,
          customerId: series.customerId,
          vehicleId: series.vehicleId,
          recurringInvoiceId: series.id,
          recurringOccurrence: occurrence,
          roNumber,
          status: "INVOICED",
          openedAt: occurrence,
          invoicedAt: occurrence,
          taxRate: series.taxRate,
          discount: series.discount,
          notes: series.notes,
        },
      });
      const laborLines = series.lines
        .filter((line) => line.kind === "LABOR")
        .map((line) => ({
          repairOrderId: repairOrder.id,
          description: line.description,
          hours: line.quantity,
          rate: line.unitPrice,
          sortOrder: line.sortOrder,
        }));
      const partLines = series.lines
        .filter((line) => line.kind === "PART")
        .map((line) => ({
          repairOrderId: repairOrder.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          partNumber: line.partNumber,
          sortOrder: line.sortOrder,
        }));
      const feeLines = series.lines
        .filter((line) => line.kind === "FEE")
        .map((line) => ({
          repairOrderId: repairOrder.id,
          description: line.description,
          amount: line.unitPrice,
          sortOrder: line.sortOrder,
        }));
      if (laborLines.length > 0) await tx.laborLine.createMany({ data: laborLines });
      if (partLines.length > 0) await tx.partLine.createMany({ data: partLines });
      if (feeLines.length > 0) await tx.feeLine.createMany({ data: feeLines });
      const nextRunAt = nextOccurrenceAfter(series, occurrence);
      const advanced = await tx.recurringInvoice.updateMany({
        where: {
          id: series.id,
          orgId: series.orgId,
          active: true,
          nextRunAt: occurrence,
        },
        data: {
          nextRunAt,
          lastPostedAt: occurrence,
          ...(series.endDate && nextRunAt.getTime() > series.endDate.getTime()
            ? { active: false }
            : {}),
        },
      });
      if (advanced.count !== 1) {
        throw new Error("Recurring invoice series changed before posting");
      }
      return repairOrder;
      });
      invoiceId = created.id;
      break;
    } catch (error: unknown) {
      if (isOccurrenceDuplicate(error)) {
        const nextRunAt = nextOccurrenceAfter(series, occurrence);
        await advanceSeries(series, occurrence, nextRunAt, true);
        return false;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        duplicateTarget(error).includes("orgId")
      ) {
        continue;
      }
      throw error;
    }
  }
  if (!invoiceId) throw new Error("Could not allocate an invoice number");

  await logActivity({
    orgId: series.orgId,
    user: null,
    action: "repair_order.recurring_post",
    entity: "RepairOrder",
    entityId: invoiceId,
    summary: `Recurring invoice issued${series.label ? ` from ${series.label}` : ""} for ${customerName(series.customer)}`,
  });
  return true;
}

export async function postDueInvoicesForOrg(
  orgId: string,
  now = new Date(),
): Promise<{ posted: number }> {
  const through = endOfTodayUTC(now);
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  if (!canUseInvoiceFeature(organization)) return { posted: 0 };
  const series = await db.recurringInvoice.findMany({
    where: { orgId, active: true, autoPost: true, nextRunAt: { lte: through } },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: {
        select: { firstName: true, lastName: true, companyName: true },
      },
    },
    orderBy: { nextRunAt: "asc" },
  });
  let posted = 0;
  for (const entry of series) {
    let current = entry.nextRunAt;
    while (current.getTime() <= through.getTime()) {
      const didPost = await issueOne(entry, current);
      if (didPost) posted += 1;
      current = nextOccurrenceAfter(entry, current);
      entry.nextRunAt = current;
      if (entry.endDate && current.getTime() > entry.endDate.getTime()) break;
    }
  }
  return { posted };
}

export async function getDueInvoiceOccurrences(
  orgId: string,
  now = new Date(),
): Promise<RecurringInvoiceDueOccurrence[]> {
  const through = endOfTodayUTC(now);
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  if (!canUseInvoiceFeature(organization)) return [];
  const series = await db.recurringInvoice.findMany({
    where: { orgId, active: true, autoPost: false, nextRunAt: { lte: through } },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      customer: {
        select: { firstName: true, lastName: true, companyName: true },
      },
    },
    orderBy: { nextRunAt: "asc" },
  });
  const shopFees = await db.shopFee.findMany({
    where: { orgId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const shopFeeConfigs: ShopFeeConfig[] = shopFees.map((fee) => ({
    id: fee.id,
    name: fee.name,
    description: fee.description,
    partsPercent: fee.partsPercent,
    laborPercent: fee.laborPercent,
    maxCap: fee.maxCap,
    taxable: fee.taxable,
  }));
  return series.flatMap((entry) => {
    const due: RecurringInvoiceDueOccurrence[] = [];
    let current = entry.nextRunAt;
    while (current.getTime() <= through.getTime()) {
      if (!entry.endDate || current.getTime() <= entry.endDate.getTime()) {
        due.push({
          recurringId: entry.id,
          occurrence: new Date(current),
          label: entry.label,
          customerName: customerName(entry.customer),
          interval: entry.interval,
          total: templateTotal(entry, shopFeeConfigs),
        });
      }
      current = nextOccurrenceAfter(entry, current);
    }
    return due;
  });
}

export async function issueRecurringOccurrence(
  orgId: string,
  recurringId: string,
  occurrence: Date,
): Promise<boolean> {
  const series = await loadInvoiceSeries(orgId, recurringId);
  if (!series || !series.active || series.autoPost) return false;
  if (series.nextRunAt.getTime() !== occurrence.getTime()) return false;
  return issueOne(series, occurrence);
}

export async function skipRecurringOccurrence(
  orgId: string,
  recurringId: string,
  occurrence: Date,
): Promise<boolean> {
  const series = await loadInvoiceSeries(orgId, recurringId);
  if (!series || !series.active || series.autoPost) return false;
  if (series.nextRunAt.getTime() !== occurrence.getTime()) return false;
  const nextRunAt = nextOccurrenceAfter(series, occurrence);
  return advanceSeries(series, occurrence, nextRunAt, false);
}

export function isRecurringInvoiceInterval(
  value: string,
): value is RecurringInterval {
  return RECURRING_INTERVALS.includes(value as RecurringInterval);
}
