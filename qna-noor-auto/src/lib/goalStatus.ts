import {
  goalIsAtMost,
  type GoalProgress,
  type GoalRecord,
} from "@/lib/goals";

export function statusLabel(status: GoalProgress["status"]): string {
  return {
    ahead: "Ahead",
    on_pace: "On pace",
    behind: "Behind",
    met: "Met",
  }[status];
}

export function statusClass(
  status: GoalProgress["status"],
  goal: GoalRecord,
  progress: GoalProgress,
): string {
  const ended = new Date() >= progress.windowEnd;
  const atMost = goalIsAtMost(goal);
  const red =
    status === "behind" &&
    (ended || (atMost && progress.actual > progress.target));
  return {
    ahead: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    on_pace: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    behind: red
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    met: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  }[status];
}
