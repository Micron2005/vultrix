import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  localCalendarDay,
} from "@/lib/timezone";
import { loadExpenseTotal, loadMoneyInTotal } from "@/lib/financialMetrics";

export const GOAL_METRICS = [
  "MONEY_IN",
  "SPENDING",
  "PROFIT",
  "NET_SAVED",
  "JOBS",
  "UNITS_SOLD",
  "MANUAL",
] as const;

export type GoalMetric = (typeof GOAL_METRICS)[number];
export type GoalPeriod = "WEEK" | "MONTH" | "YEAR" | "BY_DATE";
export type GoalStatus = "ahead" | "on_pace" | "behind" | "met";

export type GoalRecord = {
  id: string;
  orgId: string;
  title: string;
  metric: string;
  target: number;
  period: string;
  category: string | null;
  startDate: Date;
  dueDate: Date | null;
  manualProgress: number | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalProgress = {
  actual: number;
  target: number;
  pct: number;
  expectedPct: number;
  status: GoalStatus;
  remaining: number;
  perDayNeeded: number;
  windowStart: Date;
  windowEnd: Date;
  periodLabel: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function shiftCalendarDay(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseCalendarDay(value: string, timezone: string): Date {
  return dateInputInTimeZone(value, timezone, new Date(Number.NaN));
}

function endOfCalendarDay(value: string, timezone: string): Date {
  const next = parseCalendarDay(shiftCalendarDay(value, 1), timezone);
  return new Date(next.getTime() - 1);
}

function dayOfWeek(value: string): number {
  return new Date(`${value}T12:00:00.000Z`).getUTCDay();
}

function periodWindow(
  period: GoalPeriod,
  now: Date,
  timezone: string,
): { start: Date; end: Date; label: string } {
  const today = localCalendarDay(now, timezone);
  if (period === "WEEK") {
    const startValue = shiftCalendarDay(today, -dayOfWeek(today));
    return {
      start: parseCalendarDay(startValue, timezone),
      end: endOfCalendarDay(shiftCalendarDay(startValue, 6), timezone),
      label: "this week",
    };
  }
  if (period === "YEAR") {
    const year = today.slice(0, 4);
    return {
      start: parseCalendarDay(`${year}-01-01`, timezone),
      end: endOfCalendarDay(`${year}-12-31`, timezone),
      label: "this year",
    };
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    start: parseCalendarDay(monthStart, timezone),
    end: endOfCalendarDay(
      shiftCalendarDay(
        shiftCalendarDay(monthStart, 31).slice(0, 7) + "-01",
        -1,
      ),
      timezone,
    ),
    label: "this month",
  };
}

function goalWindow(
  goal: GoalRecord,
  now: Date,
  timezone: string,
): { start: Date; end: Date; label: string } {
  if (goal.period !== "BY_DATE") {
    return periodWindow(goal.period as GoalPeriod, now, timezone);
  }
  const start = goal.startDate;
  const due = goal.dueDate ?? goal.startDate;
  const dueDay = localCalendarDay(due, timezone);
  return {
    start,
    end: endOfCalendarDay(dueDay, timezone),
    label: `by ${formatInTimeZone(due, timezone, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`,
  };
}

function progressPercent(actual: number, target: number, spending: boolean): number {
  if (target <= 0) {
    return spending ? (actual <= 0 ? 100 : 0) : actual >= 0 ? 100 : 0;
  }
  return clamp(actual / target, 0, 1) * 100;
}

function metricIsSpending(metric: string): boolean {
  return metric === "SPENDING";
}

function statusFor(
  actual: number,
  target: number,
  expectedPct: number,
  now: Date,
  start: Date,
  end: Date,
  spending: boolean,
): GoalStatus {
  const ended = now.getTime() >= end.getTime();
  const started = now.getTime() >= start.getTime();
  if (target <= 0) {
    if (ended) return spending ? (actual <= 0 ? "met" : "behind") : "met";
    if (!started) return "on_pace";
    return spending && actual > 0 ? "behind" : "on_pace";
  }
  if (spending) {
    if (ended) return actual <= target ? "met" : "behind";
    if (!started) return "on_pace";
    if (actual > target) return "behind";
    return actual / target <= expectedPct ? "ahead" : "on_pace";
  }
  if (actual >= target) return "met";
  if (!started) return "on_pace";
  return actual / target >= expectedPct ? "ahead" : "behind";
}

async function metricActual(
  orgId: string,
  goal: GoalRecord,
  range: { from: Date; to: Date },
  hasInvoices: boolean,
): Promise<number> {
  switch (goal.metric) {
    case "MONEY_IN":
      return loadMoneyInTotal(orgId, range, hasInvoices);
    case "SPENDING":
      return loadExpenseTotal(orgId, range, goal.category);
    case "PROFIT": {
      const [moneyIn, spending] = await Promise.all([
        loadMoneyInTotal(orgId, range, hasInvoices),
        loadExpenseTotal(orgId, range),
      ]);
      return moneyIn - spending;
    }
    case "NET_SAVED": {
      const [moneyIn, spending] = await Promise.all([
        loadMoneyInTotal(orgId, range, hasInvoices),
        loadExpenseTotal(orgId, range),
      ]);
      return moneyIn - spending;
    }
    case "JOBS":
      return db.repairOrder.count({
        where: {
          orgId,
          completedAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
      });
    case "UNITS_SOLD": {
      const sales = await db.sale.findMany({
        where: { orgId, soldAt: { gte: range.from, lte: range.to } },
        select: { quantity: true },
      });
      return sales.reduce((sum, sale) => sum + sale.quantity, 0);
    }
    case "MANUAL":
      return goal.manualProgress ?? 0;
    default:
      return 0;
  }
}

export async function computeGoalProgress(
  orgId: string,
  goal: GoalRecord,
  now: Date,
  timezone: string,
): Promise<GoalProgress> {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  const hasInvoices = enabledFeatureSet({
    accountType: organization?.accountType,
    features: organization?.features ?? [],
  }).has("invoices");
  const window = goalWindow(goal, now, timezone);
  const validWindow = window.end.getTime() >= window.start.getTime();
  const queryTo = new Date(Math.min(now.getTime(), window.end.getTime()));
  const queryFrom = window.start;
  const actual =
    !validWindow ||
    (goal.period === "BY_DATE" && now.getTime() < window.start.getTime())
      ? 0
      : await metricActual(
          orgId,
          goal,
          { from: queryFrom, to: queryTo },
          hasInvoices,
        );
  const pacingEnd =
    goal.period === "BY_DATE" ? goal.dueDate ?? goal.startDate : window.end;
  const duration = pacingEnd.getTime() - window.start.getTime();
  const expectedPct =
    duration <= 0
      ? now.getTime() >= pacingEnd.getTime()
        ? 1
        : 0
      : clamp((now.getTime() - window.start.getTime()) / duration);
  const spending = metricIsSpending(goal.metric);
  const target = goal.target;
  const remaining = spending
    ? Math.max(0, actual - target)
    : Math.max(0, target - actual);
  const daysLeft =
    now.getTime() < pacingEnd.getTime()
      ? Math.max(1, (pacingEnd.getTime() - Math.max(now.getTime(), window.start.getTime())) / DAY_MS)
      : 0;
  const perDayNeeded =
    daysLeft > 0 && (spending ? actual > target : actual < target)
      ? remaining / daysLeft
      : 0;
  return {
    actual: roundMoney(actual),
    target: roundMoney(target),
    pct: progressPercent(actual, target, spending),
    expectedPct: expectedPct * 100,
    status: statusFor(
      actual,
      target,
      expectedPct,
      now,
      window.start,
      pacingEnd,
      spending,
    ),
    remaining: roundMoney(remaining),
    perDayNeeded: roundMoney(perDayNeeded),
    windowStart: window.start,
    windowEnd: window.end,
    periodLabel: window.label,
  };
}

export async function loadActiveGoals(
  orgId: string,
  timezone: string,
  limit?: number,
): Promise<Array<{ goal: GoalRecord; progress: GoalProgress }>> {
  const goals = await db.goal.findMany({
    where: { orgId, archived: false },
    orderBy: { createdAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });
  const now = new Date();
  const scored = await Promise.all(
    goals.map(async (goal) => ({
      goal: goal as GoalRecord,
      progress: await computeGoalProgress(orgId, goal as GoalRecord, now, timezone),
    })),
  );
  return scored;
}

export function goalMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    MONEY_IN: "Money in",
    SPENDING: "Spending",
    PROFIT: "Profit",
    NET_SAVED: "Net saved",
    JOBS: "Jobs completed",
    UNITS_SOLD: "Units sold",
    MANUAL: "Manual",
  };
  return labels[metric] ?? metric;
}

export function goalPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    WEEK: "This week",
    MONTH: "This month",
    YEAR: "This year",
    BY_DATE: "By a date",
  };
  return labels[period] ?? period;
}

export function goalUsesMoney(metric: string): boolean {
  return ["MONEY_IN", "SPENDING", "PROFIT", "NET_SAVED"].includes(metric);
}

export function goalValueLabel(metric: string, value: number): string {
  if (goalUsesMoney(metric)) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
