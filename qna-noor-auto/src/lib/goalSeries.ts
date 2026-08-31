import { db } from "@/lib/db";
import {
  goalWindow,
  parseCalendarDay,
  type GoalRecord,
} from "@/lib/goals";
import {
  loadExpenseCategoryTotals,
} from "@/lib/financialMetrics";
import {
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

export type GoalPoint = {
  day: string;
  value: number;
};

export type GoalSeries = {
  supported: boolean;
  points: GoalPoint[];
  cumulative: GoalPoint[];
  pace: GoalPoint[];
};

export type GoalSlice = {
  label: string;
  value: number;
};

type ActiveGoalWindow = {
  start: Date;
  end: Date;
  startDay: string;
  endDay: string;
  days: string[];
};

function activeGoalWindow(
  goal: GoalRecord,
  now: Date,
  timezone: string,
): ActiveGoalWindow | null {
  const window = goalWindow(goal, now, timezone);
  if (
    !window.valid ||
    (goal.period === "BY_DATE" && now.getTime() < window.start.getTime())
  ) {
    return null;
  }
  const end = new Date(Math.min(now.getTime(), window.end.getTime()));
  const startDay = localCalendarDay(window.start, timezone);
  const endDay = localCalendarDay(end, timezone);
  const days: string[] = [];
  for (let day = startDay; day <= endDay; day = shiftCalendarDay(day, 1)) {
    days.push(day);
  }
  return {
    start: window.start,
    end,
    startDay,
    endDay,
    days,
  };
}

function dateRange(range: ActiveGoalWindow) {
  return { from: range.start, to: range.end };
}

function addToBucket(buckets: Map<string, number>, day: string, value: number) {
  buckets.set(day, (buckets.get(day) ?? 0) + value);
}

function pointsFromBuckets(
  days: string[],
  buckets: Map<string, number>,
): GoalPoint[] {
  return days.map((day) => ({ day, value: buckets.get(day) ?? 0 }));
}

function cumulativePoints(points: GoalPoint[]): GoalPoint[] {
  let total = 0;
  return points.map((point) => {
    total += point.value;
    return { day: point.day, value: total };
  });
}

function fullWindowDayCount(goal: GoalRecord, now: Date, timezone: string) {
  const window = goalWindow(goal, now, timezone);
  const start = localCalendarDay(window.start, timezone);
  const end = localCalendarDay(window.end, timezone);
  let count = 0;
  for (let day = start; day <= end; day = shiftCalendarDay(day, 1)) count += 1;
  return count;
}

function normalPace(
  days: string[],
  totalDays: number,
  target: number,
): GoalPoint[] {
  return days.map((day, index) => ({
    day,
    value: target * ((index + 1) / totalDays),
  }));
}

function loggedLatestSeries(
  days: string[],
  entries: Array<{ day: string; value: number; createdAt: Date }>,
  startDay: string,
  endDay: string,
  baseline: number | null,
) {
  const byDay = new Map<string, number>();
  for (const entry of entries) {
    if (entry.day >= startDay && entry.day <= endDay) {
      byDay.set(entry.day, entry.value);
    }
  }
  let latest = baseline ?? 0;
  const points = days.map((day) => {
    const value = byDay.get(day);
    if (value !== undefined) latest = value;
    return { day, value: value ?? 0 };
  });
  const cumulative = [];
  latest = baseline ?? 0;
  for (const point of points) {
    if (byDay.has(point.day)) latest = byDay.get(point.day)!;
    cumulative.push({ day: point.day, value: latest });
  }
  return { points, cumulative };
}

function loggedLatestBaseline(
  entries: Array<{ day: string; value: number; createdAt: Date }>,
  startDay: string,
): number | null {
  let baseline: { day: string; value: number; createdAt: Date } | null = null;
  let earliest: { day: string; value: number; createdAt: Date } | null = null;
  for (const entry of entries) {
    if (entry.day <= startDay) {
      if (
        !baseline ||
        entry.day > baseline.day ||
        (entry.day === baseline.day &&
          entry.createdAt.getTime() > baseline.createdAt.getTime())
      ) {
        baseline = entry;
      }
    }
    if (
      entry.day >= startDay &&
      (!earliest ||
        entry.day < earliest.day ||
        (entry.day === earliest.day &&
          entry.createdAt.getTime() < earliest.createdAt.getTime()))
    ) {
      earliest = entry;
    }
  }
  return baseline?.value ?? earliest?.value ?? null;
}

export async function loadGoalSeries(
  orgId: string,
  goal: GoalRecord,
  now: Date,
  timezone: string,
  hasInvoices: boolean,
): Promise<GoalSeries> {
  if (goal.metric === "MANUAL") {
    return { supported: false, points: [], cumulative: [], pace: [] };
  }
  const range = activeGoalWindow(goal, now, timezone);
  if (!range) return { supported: true, points: [], cumulative: [], pace: [] };
  const days = range.days;
  const buckets = new Map<string, number>();
  let latestData:
    | Array<{ day: string; value: number; createdAt: Date }>
    | undefined;

  switch (goal.metric) {
    case "MONEY_IN":
      if (hasInvoices) {
        const rows = await db.payment.findMany({
          where: {
            orgId,
            paidAt: { gte: range.start, lte: range.end },
            repairOrder: { deletedAt: null },
          },
          select: { paidAt: true, amount: true },
        });
        for (const row of rows) {
          addToBucket(buckets, localCalendarDay(row.paidAt, timezone), row.amount);
        }
      } else {
        const rows = await db.income.findMany({
          where: { orgId, receivedAt: { gte: range.start, lte: range.end } },
          select: { receivedAt: true, amount: true },
        });
        for (const row of rows) {
          addToBucket(
            buckets,
            localCalendarDay(row.receivedAt, timezone),
            row.amount,
          );
        }
      }
      break;
    case "SPENDING": {
      const rows = await db.expense.findMany({
        where: {
          orgId,
          paidAt: { gte: range.start, lte: range.end },
          ...(goal.category ? { category: goal.category } : {}),
        },
        select: { paidAt: true, amount: true },
      });
      for (const row of rows) {
        addToBucket(buckets, localCalendarDay(row.paidAt, timezone), row.amount);
      }
      break;
    }
    case "PROFIT":
    case "NET_SAVED": {
      const [income, expenses] = await Promise.all([
        hasInvoices
          ? db.payment.findMany({
              where: {
                orgId,
                paidAt: { gte: range.start, lte: range.end },
                repairOrder: { deletedAt: null },
              },
              select: { paidAt: true, amount: true },
            })
          : db.income.findMany({
              where: {
                orgId,
                receivedAt: { gte: range.start, lte: range.end },
              },
              select: { receivedAt: true, amount: true },
            }),
        db.expense.findMany({
          where: { orgId, paidAt: { gte: range.start, lte: range.end } },
          select: { paidAt: true, amount: true },
        }),
      ]);
      for (const row of income) {
        const date = "paidAt" in row ? row.paidAt : row.receivedAt;
        addToBucket(buckets, localCalendarDay(date, timezone), row.amount);
      }
      for (const row of expenses) {
        addToBucket(
          buckets,
          localCalendarDay(row.paidAt, timezone),
          -row.amount,
        );
      }
      break;
    }
    case "JOBS": {
      const rows = await db.repairOrder.findMany({
        where: {
          orgId,
          completedAt: { gte: range.start, lte: range.end },
          deletedAt: null,
        },
        select: { completedAt: true },
      });
      for (const row of rows) {
        if (row.completedAt) {
          addToBucket(buckets, localCalendarDay(row.completedAt, timezone), 1);
        }
      }
      break;
    }
    case "UNITS_SOLD": {
      const rows = await db.sale.findMany({
        where: { orgId, soldAt: { gte: range.start, lte: range.end } },
        select: { soldAt: true, quantity: true },
      });
      for (const row of rows) {
        addToBucket(
          buckets,
          localCalendarDay(row.soldAt, timezone),
          row.quantity,
        );
      }
      break;
    }
    case "HABIT": {
      const rows = await db.goalCheckIn.findMany({
        where: {
          orgId,
          goalId: goal.id,
          day: { gte: range.startDay, lte: range.endDay },
        },
        select: { day: true },
      });
      for (const row of rows) addToBucket(buckets, row.day, 1);
      break;
    }
    case "LOGGED_TOTAL":
      {
        const rows = await db.goalEntry.findMany({
          where: {
            orgId,
            goalId: goal.id,
            day: { gte: range.startDay, lte: range.endDay },
          },
          select: { day: true, value: true },
        });
        for (const row of rows) addToBucket(buckets, row.day, row.value);
      }
      break;
    case "LOGGED_LATEST": {
      latestData = await db.goalEntry.findMany({
        where: { orgId, goalId: goal.id, day: { lte: range.endDay } },
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        select: { day: true, value: true, createdAt: true },
      });
      break;
    }
    case "EVENTS":
      if (hasInvoices) {
        const rows = await db.appointment.findMany({
          where: {
            orgId,
            startsAt: { gte: range.start, lte: range.end },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
          },
          select: { startsAt: true },
        });
        for (const row of rows) {
          addToBucket(buckets, localCalendarDay(row.startsAt, timezone), 1);
        }
      } else {
        const rows = await db.calendarEvent.findMany({
          where: {
            orgId,
            startsAt: { gte: range.start, lte: range.end },
            isReminder: false,
          },
          select: { startsAt: true },
        });
        for (const row of rows) {
          addToBucket(buckets, localCalendarDay(row.startsAt, timezone), 1);
        }
      }
      break;
    case "NOTES_WRITTEN": {
      const rows = await db.repairNote.findMany({
        where: {
          orgId,
          createdAt: { gte: range.start, lte: range.end },
        },
        select: { createdAt: true },
      });
      for (const row of rows) {
        addToBucket(buckets, localCalendarDay(row.createdAt, timezone), 1);
      }
      break;
    }
    default:
      return { supported: false, points: [], cumulative: [], pace: [] };
  }

  if (goal.metric === "LOGGED_LATEST" && latestData) {
    const baseline = loggedLatestBaseline(latestData, range.startDay);
    const latest = loggedLatestSeries(
      days,
      latestData,
      range.startDay,
      range.endDay,
      baseline,
    );
    const totalDays = fullWindowDayCount(goal, now, timezone);
    return {
      supported: true,
      points: latest.points,
      cumulative: latest.cumulative,
      pace:
        baseline === null
          ? []
          : days.map((day, index) => ({
              day,
              value:
                baseline +
                (goal.target - baseline) * ((index + 1) / totalDays),
            })),
    };
  }

  const points = pointsFromBuckets(days, buckets);
  return {
    supported: true,
    points,
    cumulative: cumulativePoints(points),
    pace: normalPace(
      days,
      fullWindowDayCount(goal, now, timezone),
      goal.target,
    ),
  };
}

function isoWeekKey(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${thursday.getUTCFullYear()}-${week}`;
}

function weekdayLabel(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parseCalendarDay(day, "UTC"));
}

export async function loadGoalBreakdown(
  orgId: string,
  goal: GoalRecord,
  now: Date,
  timezone: string,
  hasInvoices: boolean,
): Promise<GoalSlice[]> {
  if (goal.metric === "MANUAL") return [];
  const range = activeGoalWindow(goal, now, timezone);
  if (!range) return [];
  if (goal.metric === "SPENDING" && !goal.category) {
    const totals = await loadExpenseCategoryTotals(orgId, dateRange(range));
    return totals.map(({ category, amount }) => ({
      label: category || "Uncategorized",
      value: amount,
    }));
  }
  if (goal.metric === "HABIT") {
    const series = await loadGoalSeries(orgId, goal, now, timezone, hasInvoices);
    const daysChecked = series.points.reduce((sum, point) => sum + point.value, 0);
    return [
      { label: "Done", value: daysChecked },
      { label: "Missed", value: range.days.length - daysChecked },
    ];
  }
  const series = await loadGoalSeries(orgId, goal, now, timezone, hasInvoices);
  if (series.points.length === 0) return [];
  const weeks = new Map<string, GoalSlice>();
  for (const point of series.points) {
    const key = isoWeekKey(point.day);
    const existing = weeks.get(key);
    if (existing) existing.value += point.value;
    else weeks.set(key, { label: `Week ${weeks.size + 1}`, value: point.value });
  }
  if (weeks.size === 1) {
    return series.points.map((point) => ({
      label: weekdayLabel(point.day),
      value: point.value,
    }));
  }
  return [...weeks.values()];
}
