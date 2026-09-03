import Link from "next/link";
import { Card, CardHeader, EmptyState, LinkButton } from "@/components/ui";
import {
  goalMetricLabel,
  goalValueLabel,
  loadActiveGoals,
} from "@/lib/goals";

export async function GoalsBlock({
  orgId,
  timezone,
  hasInvoices,
  accountType,
  role,
  editing,
  title,
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
  accountType: string | null;
  role: string;
  editing: boolean;
  title?: string;
}) {
  if (role === "STAFF") return null;
  const activeGoals = await loadActiveGoals(orgId, timezone, hasInvoices, 3);
  if (activeGoals.length === 0 && !editing) return null;
  return (
    <Card className="mb-6">
      <CardHeader title={title ?? "Goals"}>
        <LinkButton href="/goals" variant="ghost" size="sm">
          View all →
        </LinkButton>
      </CardHeader>
      {activeGoals.length === 0 ? (
        <EmptyState title="No active goals yet." />
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {activeGoals.map(({ goal, progress }) => (
            <Link
              key={goal.id}
              href={`/goals/${goal.id}`}
              className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {goal.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {goalMetricLabel(goal.metric, accountType, hasInvoices)} ·{" "}
                    {goal.metric === "LOGGED_LATEST" &&
                    progress.baseline !== null
                      ? `${goalValueLabel(goal.metric, progress.baseline, goal.unit)} → ${goalValueLabel(goal.metric, progress.target, goal.unit)}, now ${goalValueLabel(goal.metric, progress.actual, goal.unit)}`
                      : `${goalValueLabel(goal.metric, progress.actual, goal.unit)} of ${goalValueLabel(goal.metric, progress.target, goal.unit)}`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {Math.round(progress.pct)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${
                    progress.status === "behind"
                      ? new Date() >= progress.windowEnd
                        ? "bg-red-500"
                        : "bg-amber-500"
                      : progress.status === "on_pace"
                        ? "bg-blue-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
