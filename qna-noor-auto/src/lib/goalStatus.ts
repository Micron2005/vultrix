import {
  goalIsAtMost,
  goalValueLabel,
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

export type GoalRemainingSummary = {
  label: string;
  text: string;
};

export function goalRemainingSummary(
  goal: GoalRecord,
  progress: GoalProgress,
): GoalRemainingSummary {
  const value = (amount: number) =>
    goalValueLabel(goal.metric, amount, goal.unit);
  if (!goalIsAtMost(goal)) {
    return {
      label: "Remaining",
      text:
        progress.remaining > 0
          ? `${value(progress.remaining)} more needed`
          : "Target reached",
    };
  }
  const over = progress.actual - progress.target;
  const spending = goal.metric === "SPENDING";
  if (over > 0) {
    return spending
      ? { label: "Over budget", text: `${value(over)} over budget` }
      : { label: "Over target", text: `${value(over)} over target` };
  }
  const left = progress.target - progress.actual;
  return spending
    ? { label: "Left to spend", text: `${value(left)} left to spend` }
    : { label: "Under target", text: `${value(left)} under target` };
}
