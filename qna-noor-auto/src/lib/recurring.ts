import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { enabledFeatureSet } from "@/lib/features";

export const RECURRING_INTERVALS = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "YEARLY",
] as const;

export type RecurringInterval = (typeof RECURRING_INTERVALS)[number];
export type RecurringKind = "EXPENSE" | "INCOME";

export type DueOccurrence = {
  recurringId: string;
  kind: RecurringKind;
  amount: number;
  occurrence: Date;
  source: string | null;
  category: string | null;
  vendor: string | null;
  method: string | null;
  reference: string | null;
  note: string | null;
  interval: RecurringInterval;
};

type RecurringLike = {
  startDate: Date;
  interval: string;
  nextRunAt: Date;
  endDate: Date | null;
  createdAt: Date;
};

function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dateOnlyValue(date: Date): number {
  return utcMidnight(date).getTime();
}

export function startOfTodayUTC(now = new Date()): Date {
  const day = utcMidnight(now);
  return day;
}

export function endOfTodayUTC(now = new Date()): Date {
  const day = startOfTodayUTC(now);
  return new Date(day.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function nthOccurrence(
  startDate: Date,
  interval: RecurringInterval,
  n: number,
): Date {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("Occurrence number must be a non-negative integer");
  }

  const start = utcMidnight(startDate);
  if (interval === "DAILY") {
    return new Date(start.getTime() + n * 24 * 60 * 60 * 1000);
  }
  if (interval === "WEEKLY") {
    return new Date(start.getTime() + n * 7 * 24 * 60 * 60 * 1000);
  }
  if (interval === "BIWEEKLY") {
    return new Date(start.getTime() + n * 14 * 24 * 60 * 60 * 1000);
  }

  const monthOffset = interval === "MONTHLY" ? n : n * 12;
  const targetMonth = start.getUTCMonth() + monthOffset;
  const targetYear = start.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, month + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      month,
      Math.min(start.getUTCDate(), daysInTargetMonth),
    ),
  );
}

function nextOccurrenceAfter(series: RecurringLike): Date {
  let n = 0;
  let candidate = nthOccurrence(
    series.startDate,
    series.interval as RecurringInterval,
    n,
  );
  while (candidate.getTime() <= series.nextRunAt.getTime()) {
    n += 1;
    candidate = nthOccurrence(
      series.startDate,
      series.interval as RecurringInterval,
      n,
    );
    if (n > 100000) throw new Error("Could not advance recurring series");
  }
  return candidate;
}

export function advance<T extends RecurringLike>(series: T): T & {
  nextRunAt: Date;
  active: boolean;
} {
  const nextRunAt = nextOccurrenceAfter(series);
  return {
    ...series,
    nextRunAt,
    active: !(series.endDate && nextRunAt.getTime() > series.endDate.getTime()),
  };
}

function dueOccurrences(
  series: RecurringLike & {
    id: string;
    kind: RecurringKind;
    amount: number;
    source: string | null;
    category: string | null;
    vendor: string | null;
    method: string | null;
    reference: string | null;
    note: string | null;
  },
  through: Date,
): DueOccurrence[] {
  const due: DueOccurrence[] = [];
  let current = series.nextRunAt;
  let guard = 0;
  while (current.getTime() <= through.getTime()) {
    if (series.endDate && current.getTime() > series.endDate.getTime()) break;
    if (dateOnlyValue(current) >= dateOnlyValue(series.createdAt)) {
      due.push({
        recurringId: series.id,
        kind: series.kind,
        amount: series.amount,
        occurrence: new Date(current),
        source: series.source,
        category: series.category,
        vendor: series.vendor,
        method: series.method,
        reference: series.reference,
        note: series.note,
        interval: series.interval as RecurringInterval,
      });
    }
    const next = nextOccurrenceAfter({ ...series, nextRunAt: current });
    current = next;
    guard += 1;
    if (guard > 100000) throw new Error("Could not find due occurrences");
  }
  return due;
}

function legacyFrequency(interval: RecurringInterval): string {
  return interval === "WEEKLY" ||
    interval === "BIWEEKLY" ||
    interval === "MONTHLY"
    ? interval
    : "ONE_TIME";
}

async function deactivateIfEnded(
  series: { id: string; orgId: string; nextRunAt: Date; endDate: Date | null },
  nextRunAt: Date,
) {
  if (!series.endDate || nextRunAt.getTime() <= series.endDate.getTime()) {
    return;
  }
  await db.recurringEntry.updateMany({
    where: {
      id: series.id,
      orgId: series.orgId,
      active: true,
      nextRunAt: series.nextRunAt,
    },
    data: { active: false, nextRunAt },
  });
}

async function postOne(
  series: {
    id: string;
    orgId: string;
    kind: RecurringKind;
    amount: number;
    interval: string;
    startDate: Date;
    endDate: Date | null;
    nextRunAt: Date;
    createdAt: Date;
    category: string | null;
    vendor: string | null;
    method: string | null;
    reference: string | null;
    source: string | null;
    note: string | null;
  },
  occurrence: Date,
  amount: number,
): Promise<boolean> {
  const nextRunAt = nextOccurrenceAfter(series);
  if (series.endDate && occurrence.getTime() > series.endDate.getTime()) {
    await deactivateIfEnded(series, nextRunAt);
    return false;
  }

  const claim = await db.recurringEntry.updateMany({
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
  if (claim.count !== 1) return false;

  if (series.kind === "EXPENSE") {
    const expense = await db.expense.create({
      data: {
        orgId: series.orgId,
        recurringId: series.id,
        amount,
        paidAt: occurrence,
        category: series.category || "MISC",
        vendor: series.vendor,
        reference: series.reference,
        method: series.method,
        note: series.note,
      },
    });
    await logActivity({
      orgId: series.orgId,
      user: null,
      action: "expense.recurring_post",
      entity: "Expense",
      entityId: expense.id,
      summary: `Recurring expense ${amount.toFixed(2)} posted for ${series.vendor || series.category || "Other"}`,
    });
  } else {
    const income = await db.income.create({
      data: {
        orgId: series.orgId,
        recurringId: series.id,
        amount,
        receivedAt: occurrence,
        source: series.source || "Income",
        frequency: legacyFrequency(series.interval as RecurringInterval),
        note: series.note,
      },
    });
    await logActivity({
      orgId: series.orgId,
      user: null,
      action: "income.recurring_post",
      entity: "Income",
      entityId: income.id,
      summary: `Recurring income ${amount.toFixed(2)} posted from ${series.source || "Income"}`,
    });
  }
  return true;
}

async function skipOne(
  series: {
    id: string;
    orgId: string;
    nextRunAt: Date;
    startDate: Date;
    interval: string;
    endDate: Date | null;
    active: boolean;
    createdAt: Date;
  },
  occurrence: Date,
): Promise<boolean> {
  const nextRunAt = nextOccurrenceAfter(series);
  const claim = await db.recurringEntry.updateMany({
    where: {
      id: series.id,
      orgId: series.orgId,
      active: true,
      nextRunAt: occurrence,
    },
    data: {
      nextRunAt,
      ...(series.endDate && nextRunAt.getTime() > series.endDate.getTime()
        ? { active: false }
        : {}),
    },
  });
  return claim.count === 1;
}

async function claimBackdated(
  series: {
    id: string;
    orgId: string;
    nextRunAt: Date;
    startDate: Date;
    interval: string;
    endDate: Date | null;
    active: boolean;
    createdAt: Date;
  },
  through: Date,
): Promise<Date | null> {
  let current = series.nextRunAt;
  while (
    current.getTime() <= through.getTime() &&
    dateOnlyValue(current) < dateOnlyValue(series.createdAt)
  ) {
    const next = nextOccurrenceAfter({ ...series, nextRunAt: current });
    const claim = await db.recurringEntry.updateMany({
      where: {
        id: series.id,
        orgId: series.orgId,
        active: true,
        nextRunAt: current,
      },
      data: {
        nextRunAt: next,
        ...(series.endDate && next.getTime() > series.endDate.getTime()
          ? { active: false }
          : {}),
      },
    });
    if (claim.count !== 1) return null;
    current = next;
  }
  return current;
}

export async function getDueConfirmOccurrences(
  orgId: string,
  now = new Date(),
): Promise<DueOccurrence[]> {
  const [series, organization] = await Promise.all([
    db.recurringEntry.findMany({
      where: {
        orgId,
        active: true,
        autoPost: false,
        nextRunAt: { lte: endOfTodayUTC(now) },
      },
      orderBy: { nextRunAt: "asc" },
    }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { accountType: true, features: true },
    }),
  ]);
  const organizationFeatures = enabledFeatureSet(organization ?? {});
  const incomeEnabled = Boolean(
    organizationFeatures.has("financials") &&
      !organizationFeatures.has("invoices"),
  );
  return series.flatMap((entry) => {
    if (entry.kind === "INCOME" && !incomeEnabled) return [];
    return dueOccurrences(
      entry as typeof entry & { kind: RecurringKind },
      endOfTodayUTC(now),
    );
  });
}

export async function postConfirmedOccurrence(
  orgId: string,
  recurringId: string,
  occurrence: Date,
  amount: number,
): Promise<boolean> {
  const series = await db.recurringEntry.findFirst({
    where: { id: recurringId, orgId, active: true, autoPost: false },
  });
  if (!series || amount <= 0) return false;
  const current = await claimBackdated(series, endOfTodayUTC());
  if (!current || current.getTime() !== occurrence.getTime()) return false;
  return postOne(
    { ...series, kind: series.kind as RecurringKind, nextRunAt: current },
    occurrence,
    amount,
  );
}

export async function skipConfirmedOccurrence(
  orgId: string,
  recurringId: string,
  occurrence: Date,
): Promise<boolean> {
  const series = await db.recurringEntry.findFirst({
    where: { id: recurringId, orgId, active: true, autoPost: false },
  });
  if (!series) return false;
  const current = await claimBackdated(series, endOfTodayUTC());
  if (!current || current.getTime() !== occurrence.getTime()) return false;
  return skipOne({ ...series, nextRunAt: current }, occurrence);
}

export async function postDueForOrg(
  orgId: string,
  options: { includeConfirm?: boolean } = {},
): Promise<{ posted: number; dueConfirm: DueOccurrence[] }> {
  const through = endOfTodayUTC();
  const [series, organization] = await Promise.all([
    db.recurringEntry.findMany({
      where: { orgId, active: true, nextRunAt: { lte: through } },
      orderBy: { nextRunAt: "asc" },
    }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { accountType: true, features: true },
    }),
  ]);
  const organizationFeatures = enabledFeatureSet(organization ?? {});
  const incomeEnabled = Boolean(
    organizationFeatures.has("financials") &&
      !organizationFeatures.has("invoices"),
  );
  let posted = 0;
  const dueConfirm: DueOccurrence[] = [];

  for (const entry of series) {
    if (entry.kind === "INCOME" && !incomeEnabled) continue;
    if (!entry.autoPost) {
      if (options.includeConfirm) {
        dueConfirm.push(
          ...dueOccurrences(
            entry as typeof entry & { kind: RecurringKind },
            through,
          ),
        );
      }
      continue;
    }

    let current = entry.nextRunAt;
    while (current.getTime() <= through.getTime()) {
      const next = nextOccurrenceAfter({ ...entry, nextRunAt: current });
      if (dateOnlyValue(current) < dateOnlyValue(entry.createdAt)) {
        const claim = await db.recurringEntry.updateMany({
          where: {
            id: entry.id,
            orgId,
            active: true,
            nextRunAt: current,
          },
          data: {
            nextRunAt: next,
            ...(entry.endDate && next.getTime() > entry.endDate.getTime()
              ? { active: false }
              : {}),
          },
        });
        if (claim.count !== 1) break;
        current = next;
        continue;
      }
      const postedHere = await postOne(
        { ...entry, kind: entry.kind as RecurringKind },
        current,
        entry.amount,
      );
      if (!postedHere) break;
      posted += 1;
      current = next;
    }
  }

  return { posted, dueConfirm };
}
