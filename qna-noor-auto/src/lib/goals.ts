import { db } from "@/lib/db";
import { repairOrderNouns } from "@/lib/features";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import { loadExpenseTotal, loadMoneyInTotal } from "@/lib/financialMetrics";

export const GOAL_METRICS = [
  "MONEY_IN",
  "SPENDING",
  "PROFIT",
  "NET_SAVED",
  "JOBS",
  "UNITS_SOLD",
  "HABIT",
  "LOGGED_TOTAL",
  "LOGGED_LATEST",
  "EVENTS",
  "NOTES_WRITTEN",
  "MANUAL",
] as const;

export type GoalMetric = (typeof GOAL_METRICS)[number];
export type GoalPeriod = "WEEK" | "MONTH" | "YEAR" | "BY_DATE";
export type GoalStatus = "ahead" | "on_pace" | "behind" | "met";
export type GoalDirection = "AT_LEAST" | "AT_MOST";

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
  direction: string;
  unit: string | null;
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
  daysRemaining: number;
  baseline: number | null;
  todayChecked: boolean;
  currentStreak: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
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

type GoalWindow = {
  start: Date;
  end: Date;
  label: string;
  valid: boolean;
};

function periodWindow(
  period: GoalPeriod,
  now: Date,
  timezone: string,
): GoalWindow {
  const today = localCalendarDay(now, timezone);
  if (period === "WEEK") {
    const startValue = shiftCalendarDay(today, -dayOfWeek(today));
    return {
      start: parseCalendarDay(startValue, timezone),
      end: endOfCalendarDay(shiftCalendarDay(startValue, 6), timezone),
      label: "this week",
      valid: true,
    };
  }
  if (period === "YEAR") {
    const year = today.slice(0, 4);
    return {
      start: parseCalendarDay(`${year}-01-01`, timezone),
      end: endOfCalendarDay(`${year}-12-31`, timezone),
      label: "this year",
      valid: true,
    };
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = `${shiftCalendarDay(monthStart, 31).slice(0, 7)}-01`;
  return {
    start: parseCalendarDay(monthStart, timezone),
    end: endOfCalendarDay(shiftCalendarDay(nextMonthStart, -1), timezone),
    label: "this month",
    valid: true,
  };
}

function goalWindow(
  goal: GoalRecord,
  now: Date,
  timezone: string,
): GoalWindow {
  if (goal.period !== "BY_DATE") {
    return periodWindow(goal.period as GoalPeriod, now, timezone);
  }
  const start = goal.startDate;
  const due = goal.dueDate ?? goal.startDate;
  const startDay = localCalendarDay(start, timezone);
  const dueDay = localCalendarDay(due, timezone);
  return {
    start,
    end: endOfCalendarDay(dueDay, timezone),
    label: `by ${formatInTimeZone(due, timezone, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}`,
    valid: dueDay > startDay,
  };
}

export function goalIsAtMost(goal: Pick<GoalRecord, "metric" | "direction">): boolean {
  return goal.metric === "SPENDING" || goal.direction === "AT_MOST";
}

function progressPercent(actual: number, target: number, atMost: boolean): number {
  if (target <= 0) {
    return atMost ? (actual <= 0 ? 100 : 0) : actual >= 0 ? 100 : 0;
  }
  return clamp(actual / target, 0, 1) * 100;
}

function statusFor(
  actual: number,
  target: number,
  expectedPct: number,
  now: Date,
  start: Date,
  end: Date,
  atMost: boolean,
): GoalStatus {
  const ended = now.getTime() >= end.getTime();
  const started = now.getTime() >= start.getTime();
  const elapsedPct =
    end.getTime() > start.getTime()
      ? clamp((now.getTime() - start.getTime()) / (end.getTime() - start.getTime()))
      : 1;
  const actualPct = target > 0 ? actual / target : 0;
  const materiallyElapsed = elapsedPct >= 0.1;
  if (target <= 0) {
      if (ended) return atMost ? (actual <= 0 ? "met" : "behind") : "met";
      if (!started) return "on_pace";
    return atMost && actual > 0 ? "behind" : "on_pace";
  }
  if (atMost) {
    if (ended) return actual <= target ? "met" : "behind";
    if (!started) return "on_pace";
    if (actual > target) return "behind";
    if (materiallyElapsed && actualPct < expectedPct - 0.1) return "ahead";
    if (materiallyElapsed && actualPct > expectedPct + 0.1) return "behind";
    return "on_pace";
  }
  if (actual >= target) return "met";
  if (!started) return "on_pace";
  if (materiallyElapsed && actualPct > expectedPct + 0.1) return "ahead";
  if (materiallyElapsed && actualPct < expectedPct - 0.1) return "behind";
  return "on_pace";
}

async function metricActual(
  orgId: string,
  goal: GoalRecord,
  range: { from: Date; to: Date },
  hasInvoices: boolean,
  days: { start: string; end: string; today: string },
): Promise<{
  actual: number;
  baseline: number | null;
  todayChecked: boolean;
  currentStreak: number;
}> {
  const empty = {
    actual: 0,
    baseline: null,
    todayChecked: false,
    currentStreak: 0,
  };
  switch (goal.metric) {
    case "MONEY_IN":
      return { ...empty, actual: await loadMoneyInTotal(orgId, range, hasInvoices) };
    case "SPENDING":
      return { ...empty, actual: await loadExpenseTotal(orgId, range, goal.category) };
    case "PROFIT": {
      const [moneyIn, spending] = await Promise.all([
        loadMoneyInTotal(orgId, range, hasInvoices),
        loadExpenseTotal(orgId, range),
      ]);
      return { ...empty, actual: moneyIn - spending };
    }
    case "NET_SAVED": {
      const [moneyIn, spending] = await Promise.all([
        loadMoneyInTotal(orgId, range, hasInvoices),
        loadExpenseTotal(orgId, range),
      ]);
      return { ...empty, actual: moneyIn - spending };
    }
    case "JOBS":
      return {
        ...empty,
        actual: await db.repairOrder.count({
          where: {
            orgId,
            completedAt: { gte: range.from, lte: range.to },
            deletedAt: null,
          },
        }),
      };
    case "UNITS_SOLD": {
      const sales = await db.sale.findMany({
        where: { orgId, soldAt: { gte: range.from, lte: range.to } },
        select: { quantity: true },
      });
      return {
        ...empty,
        actual: sales.reduce((sum, sale) => sum + sale.quantity, 0),
      };
    }
    case "HABIT": {
      const [checkIns, allCheckIns] = await Promise.all([
        db.goalCheckIn.findMany({
          where: {
            orgId,
            goalId: goal.id,
            day: { gte: days.start, lte: days.end },
          },
          select: { day: true },
        }),
        db.goalCheckIn.findMany({
          where: {
            orgId,
            goalId: goal.id,
            day: { gte: days.start, lte: days.today },
          },
          select: { day: true },
          orderBy: { day: "desc" },
        }),
      ]);
      const checkedDays = new Set(allCheckIns.map(({ day }) => day));
      const todayChecked = checkedDays.has(days.today);
      let currentStreak = 0;
      let streakDay = todayChecked
        ? days.today
        : shiftCalendarDay(days.today, -1);
      while (checkedDays.has(streakDay)) {
        currentStreak += 1;
        streakDay = shiftCalendarDay(streakDay, -1);
      }
      return {
        ...empty,
        actual: checkIns.length,
        todayChecked,
        currentStreak,
      };
    }
    case "LOGGED_TOTAL": {
      const entries = await db.goalEntry.findMany({
        where: {
          orgId,
          goalId: goal.id,
          day: { gte: days.start, lte: days.end },
        },
        select: { value: true },
      });
      return {
        ...empty,
        actual: entries.reduce((sum, entry) => sum + entry.value, 0),
      };
    }
    case "LOGGED_LATEST": {
      const [baselineEntry, earliestInWindow, latestEntry] = await Promise.all([
        db.goalEntry.findFirst({
          where: { orgId, goalId: goal.id, day: { lte: days.start } },
          orderBy: [{ day: "asc" }, { createdAt: "asc" }],
          select: { value: true },
        }),
        db.goalEntry.findFirst({
          where: {
            orgId,
            goalId: goal.id,
            day: { gte: days.start, lte: days.end },
          },
          orderBy: [{ day: "asc" }, { createdAt: "asc" }],
          select: { value: true },
        }),
        db.goalEntry.findFirst({
          where: { orgId, goalId: goal.id, day: { lte: days.end } },
          orderBy: [{ day: "desc" }, { createdAt: "desc" }],
          select: { value: true },
        }),
      ]);
      return {
        ...empty,
        actual: latestEntry?.value ?? 0,
        baseline: baselineEntry?.value ?? earliestInWindow?.value ?? null,
      };
    }
    case "EVENTS": {
      const actual = hasInvoices
        ? await db.appointment.count({
            where: {
              orgId,
              startsAt: { gte: range.from, lte: range.to },
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
            },
          })
        : await db.calendarEvent.count({
            where: {
              orgId,
              startsAt: { gte: range.from, lte: range.to },
              isReminder: false,
            },
          });
      return { ...empty, actual };
    }
    case "NOTES_WRITTEN":
      return {
        ...empty,
        actual: await db.repairNote.count({
          where: { orgId, createdAt: { gte: range.from, lte: range.to } },
        }),
      };
    case "MANUAL":
      return { ...empty, actual: goal.manualProgress ?? 0 };
    default:
      return empty;
  }
}

export async function computeGoalProgress(
  orgId: string,
  goal: GoalRecord,
  now: Date,
  timezone: string,
  hasInvoices: boolean,
): Promise<GoalProgress> {
  const window = goalWindow(goal, now, timezone);
  const validWindow = window.valid;
  const queryTo = new Date(Math.min(now.getTime(), window.end.getTime()));
  const queryFrom = window.start;
  const startDay = localCalendarDay(window.start, timezone);
  const queryEndDay = localCalendarDay(queryTo, timezone);
  const result =
    !validWindow ||
    (goal.period === "BY_DATE" && now.getTime() < window.start.getTime())
      ? {
          actual: 0,
          baseline: null,
          todayChecked: false,
          currentStreak: 0,
        }
      : await metricActual(
          orgId,
          goal,
          { from: queryFrom, to: queryTo },
          hasInvoices,
          {
            start: startDay,
            end: queryEndDay,
            today: localCalendarDay(now, timezone),
          },
        );
  const actual = result.actual;
  const pacingEnd = window.end;
  const duration = pacingEnd.getTime() - window.start.getTime();
  const expectedPct =
    duration <= 0
      ? now.getTime() >= pacingEnd.getTime()
        ? 1
        : 0
      : clamp((now.getTime() - window.start.getTime()) / duration);
  const atMost = goalIsAtMost(goal);
  const target = goal.target;
  const remaining = atMost
    ? Math.max(0, actual - target)
    : Math.max(0, target - actual);
  const daysLeft =
    now.getTime() < pacingEnd.getTime()
      ? Math.max(1, (pacingEnd.getTime() - Math.max(now.getTime(), window.start.getTime())) / DAY_MS)
      : 0;
  const perDayNeeded =
    daysLeft > 0 && (atMost ? actual > target : actual < target)
      ? remaining / daysLeft
      : 0;
  let pct = progressPercent(actual, target, atMost);
  if (goal.metric === "LOGGED_LATEST" && result.baseline !== null) {
    const denominator = atMost
      ? result.baseline - target
      : target - result.baseline;
    pct =
      denominator === 0
        ? (atMost ? actual <= target : actual >= target)
          ? 100
          : 0
        : clamp(
            atMost
              ? (result.baseline - actual) / denominator
              : (actual - result.baseline) / denominator,
          ) * 100;
  }
  return {
    actual: roundMoney(actual),
    target: roundMoney(target),
    pct,
    expectedPct: expectedPct * 100,
    status: statusFor(
      actual,
      target,
      expectedPct,
      now,
      window.start,
      pacingEnd,
      atMost,
    ),
    remaining: roundMoney(remaining),
    perDayNeeded: roundMoney(perDayNeeded),
    windowStart: window.start,
    windowEnd: window.end,
    periodLabel: window.label,
    daysRemaining: daysLeft,
    baseline: result.baseline,
    todayChecked: result.todayChecked,
    currentStreak: result.currentStreak,
  };
}

export async function loadActiveGoals(
  orgId: string,
  timezone: string,
  hasInvoices: boolean,
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
      progress: await computeGoalProgress(
        orgId,
        goal as GoalRecord,
        now,
        timezone,
        hasInvoices,
      ),
    })),
  );
  return scored;
}

export function goalMetricLabel(
  metric: string,
  accountType?: string | null,
): string {
  const repairNouns = repairOrderNouns(accountType);
  const labels: Record<string, string> = {
    MONEY_IN: "Money in",
    SPENDING: "Spending",
    PROFIT: "Profit",
    NET_SAVED: "Money saved",
    JOBS:
      (accountType ?? "AUTO_SHOP") === "AUTO_SHOP"
        ? "Jobs completed"
        : `${repairNouns.plural} completed`,
    UNITS_SOLD: "Units sold",
    HABIT: "Something I do — I'll check it off",
    LOGGED_TOTAL: "A number I add up (miles, hours, pages)",
    LOGGED_LATEST: "A number I track (weight, savings balance)",
    EVENTS:
      (accountType ?? "AUTO_SHOP") === "AUTO_SHOP"
        ? "Appointments booked"
        : "Calendar events",
    NOTES_WRITTEN: "Notes written",
    MANUAL: "I'll update this myself",
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

export function goalValueLabel(
  metric: string,
  value: number,
  unit?: string | null,
): string {
  if (goalUsesMoney(metric)) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return unit ? `${formatted} ${unit}` : formatted;
}
