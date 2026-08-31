import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import {
  computeGoalProgress,
  goalMetricLabel,
  goalValueLabel,
  loadActiveGoals,
  type GoalProgress,
  type GoalRecord,
} from "@/lib/goals";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { createGoal, archiveGoal, restoreGoal } from "./actions";
import { GoalForm } from "./GoalForm";

export const dynamic = "force-dynamic";

function statusLabel(status: GoalProgress["status"]): string {
  return {
    ahead: "Ahead",
    on_pace: "On pace",
    behind: "Behind",
    met: "Met",
  }[status];
}

function statusClass(
  status: GoalProgress["status"],
  goal: GoalRecord,
  progress: GoalProgress,
): string {
  const ended = new Date() >= progress.windowEnd;
  const red =
    status === "behind" &&
    (ended || (goal.metric === "SPENDING" && progress.actual > progress.target));
  return {
    ahead: "bg-green-100 text-green-800",
    on_pace: "bg-blue-100 text-blue-800",
    behind: red ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800",
    met: "bg-emerald-100 text-emerald-800",
  }[status];
}

function GoalCard({
  goal,
  progress,
  accountType,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
  accountType: string;
}) {
  const spending = goal.metric === "SPENDING";
  const amountText =
    progress.remaining > 0
      ? spending
        ? `${goalValueLabel(goal.metric, progress.remaining)} over budget`
        : `${goalValueLabel(goal.metric, progress.remaining)} more needed`
      : spending
        ? `${goalValueLabel(goal.metric, Math.max(0, goal.target - progress.actual))} under budget`
        : "Target reached";
  const remainingDays = Math.max(1, Math.ceil(progress.daysRemaining));
  const paceText =
    progress.daysRemaining < 14
      ? `about ${goalValueLabel(goal.metric, progress.perDayNeeded)} a day ${
          remainingDays === 1
            ? "in the last day"
            : `in the next ${remainingDays} days`
        }`
      : `about ${goalValueLabel(goal.metric, progress.perDayNeeded * 7)} a week`;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {goalMetricLabel(goal.metric, accountType)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">{goal.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{progress.periodLabel}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(progress.status, goal, progress)}`}
        >
          {statusLabel(progress.status)}
        </span>
      </div>
      <div className="mt-5">
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-medium text-zinc-900">
            {goalValueLabel(goal.metric, progress.actual)} of{" "}
            {goalValueLabel(goal.metric, progress.target)}
          </span>
          <span className="text-zinc-500">{Math.round(progress.pct)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${
              progress.status === "behind"
                ? statusClass(progress.status, goal, progress).includes("red")
                  ? "bg-red-500"
                  : "bg-amber-500"
                : progress.status === "on_pace"
                  ? "bg-blue-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          {amountText}
          {progress.perDayNeeded > 0 &&
            progress.status !== "met" &&
            !spending && (
            <>
              {" "}
              · {paceText}
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Expected by now: {Math.round(progress.expectedPct)}% · actual:{" "}
          {Math.round(progress.pct)}%
        </p>
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <Link
          href={`/goals/${goal.id}/edit`}
          className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
        >
          Edit
        </Link>
        <form action={archiveGoal}>
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            className="font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
          >
            Archive
          </button>
        </form>
      </div>
    </Card>
  );
}

function ArchivedGoal({
  goal,
  progress,
  accountType,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
  accountType: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 py-3 last:border-0">
      <div>
        <p className="font-medium text-zinc-800">{goal.title}</p>
        <p className="text-xs text-zinc-500">
          {goalMetricLabel(goal.metric, accountType)} · {goalValueLabel(goal.metric, progress.actual)} of{" "}
          {goalValueLabel(goal.metric, progress.target)}
        </p>
      </div>
      <form action={restoreGoal}>
        <input type="hidden" name="id" value={goal.id} />
        <button
          type="submit"
          className="text-sm font-medium text-zinc-700 underline underline-offset-2"
        >
          Restore
        </button>
      </form>
    </div>
  );
}

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  assertCanViewFinancials(user.role);
  const features = enabledFeatureSet(user);
  if (!user.orgId || !features.has("financials")) return null;
  const timezone = await orgTimeZone(user.orgId);
  const hasInvoices = features.has("invoices");
  const active = await loadActiveGoals(user.orgId, timezone, hasInvoices);
  const archived = await db.goal.findMany({
    where: { orgId: user.orgId, archived: true },
    orderBy: { updatedAt: "desc" },
  });
  const today = localCalendarDay(new Date(), timezone);

  return (
    <>
      <PageHeader
        title="Goals"
        description="Track progress using the money, sales, and activity already in your account."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {active.length === 0 ? (
            <EmptyState
              title="No active goals yet"
              description="Create a goal to see progress scored from your existing records."
            />
          ) : (
            active.map(({ goal, progress }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress}
                accountType={user.accountType ?? "AUTO_SHOP"}
              />
            ))
          )}
          {archived.length > 0 && (
            <Card className="p-5">
              <CardHeader title="Archived goals" />
              <div className="mt-2">
                {await Promise.all(
                  archived.map(async (goal) => (
                    <ArchivedGoal
                      key={goal.id}
                      goal={goal as GoalRecord}
                      accountType={user.accountType ?? "AUTO_SHOP"}
                      progress={await computeGoalProgress(
                        user.orgId!,
                        goal as GoalRecord,
                        new Date(),
                        timezone,
                        hasInvoices,
                      )}
                    />
                  )),
                )}
              </div>
            </Card>
          )}
        </div>
        <Card className="h-fit p-5">
          <CardHeader title="Create a goal" />
          <div className="mt-4">
            <GoalForm
              action={createGoal}
              accountType={user.accountType ?? "AUTO_SHOP"}
              hasInvoices={hasInvoices}
              initial={{ startDate: today }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
