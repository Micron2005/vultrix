import {
  loadGoalBreakdown,
  loadGoalSeries,
  type GoalPoint,
  type GoalSeries,
  type GoalSlice,
} from "@/lib/goalSeries";
import {
  goalIsAtMost,
  goalUsesMoney,
  type GoalProgress,
  type GoalRecord,
} from "@/lib/goals";
import { statusLabel } from "@/lib/goalStatus";

export const OVERVIEW_GOAL_LIMIT = 12;

export type GoalDataset = {
  id: string;
  title: string;
  href: string | null;
  points: GoalPoint[];
  cumulative: GoalPoint[];
  pace: GoalPoint[];
  slices: GoalSlice[];
  descriptor: { money: boolean; unit: string | null };
  emptyMessage: string;
};

type ScoredGoal = { goal: GoalRecord; progress: GoalProgress };

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function dayPercent(
  goal: GoalRecord,
  progress: GoalProgress,
  value: number,
): number {
  if (goal.metric === "LOGGED_LATEST") {
    if (progress.baseline === null) return 0;
    const atMost = goalIsAtMost(goal);
    const denominator = atMost
      ? progress.baseline - goal.target
      : goal.target - progress.baseline;
    if (denominator === 0) {
      return (atMost ? value <= goal.target : value >= goal.target) ? 100 : 0;
    }
    return (
      clampFraction(
        atMost
          ? (progress.baseline - value) / denominator
          : (value - progress.baseline) / denominator,
      ) * 100
    );
  }
  if (goal.target <= 0) return 0;
  return clampFraction(value / goal.target) * 100;
}

function combinedDataset(
  scored: ScoredGoal[],
  seriesByGoal: Map<string, GoalSeries>,
): GoalDataset {
  const sums = new Map<string, { pct: number; pace: number; count: number }>();
  for (const { goal, progress } of scored) {
    const series = seriesByGoal.get(goal.id);
    if (!series || !series.supported || series.cumulative.length === 0) continue;
    const totalDays = series.totalDays || series.cumulative.length;
    series.cumulative.forEach((point, index) => {
      const bucket = sums.get(point.day) ?? { pct: 0, pace: 0, count: 0 };
      bucket.pct += dayPercent(goal, progress, point.value);
      bucket.pace += clampFraction((index + 1) / totalDays) * 100;
      bucket.count += 1;
      sums.set(point.day, bucket);
    });
  }
  const days = [...sums.keys()].sort();
  const cumulative = days.map((day) => {
    const bucket = sums.get(day)!;
    return { day, value: bucket.pct / bucket.count };
  });
  const pace = days.map((day) => {
    const bucket = sums.get(day)!;
    return { day, value: bucket.pace / bucket.count };
  });
  const points = scored.map(({ goal, progress }) => ({
    day: goal.title,
    value: progress.pct,
  }));
  const statusCounts = new Map<string, number>();
  for (const { progress } of scored) {
    const label = statusLabel(progress.status);
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1);
  }
  const slices = [...statusCounts.entries()]
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }));
  return {
    id: "combined",
    title: "All goals combined",
    href: null,
    points,
    cumulative,
    pace,
    slices,
    descriptor: { money: false, unit: "%" },
    emptyMessage: "No progress data across your goals yet.",
  };
}

export async function loadGoalDatasets(
  orgId: string,
  scored: ScoredGoal[],
  now: Date,
  timezone: string,
  hasInvoices: boolean,
): Promise<GoalDataset[]> {
  const seriesByGoal = new Map<string, GoalSeries>();
  const datasets = await Promise.all(
    scored.map(async ({ goal }) => {
      const series = await loadGoalSeries(orgId, goal, now, timezone, hasInvoices);
      seriesByGoal.set(goal.id, series);
      const slices = await loadGoalBreakdown(
        orgId,
        goal,
        now,
        timezone,
        hasInvoices,
        series,
      );
      return {
        id: goal.id,
        title: goal.title,
        href: `/goals/${goal.id}`,
        points: series.points,
        cumulative: series.cumulative,
        pace: series.pace,
        slices,
        descriptor: {
          money: goalUsesMoney(goal.metric),
          unit: goal.unit,
        },
        emptyMessage: series.supported
          ? "No progress data for this period yet."
          : "This goal is updated manually.",
      } satisfies GoalDataset;
    }),
  );
  return [combinedDataset(scored, seriesByGoal), ...datasets];
}
