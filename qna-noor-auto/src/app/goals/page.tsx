import Link from "next/link";
import { Card, CardHeader, EmptyState, Input, PageHeader } from "@/components/ui";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import {
  computeGoalProgress,
  goalIsAtMost,
  goalMetricLabel,
  goalValueLabel,
  loadActiveGoals,
  type GoalProgress,
  type GoalRecord,
} from "@/lib/goals";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  archiveGoal,
  createGoal,
  deleteGoalEntry,
  logGoalEntry,
  restoreGoal,
  toggleHabitCheckIn,
} from "./actions";
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

async function GoalCard({
  goal,
  progress,
  accountType,
  orgId,
  today,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
  accountType: string;
  orgId: string;
  today: string;
}) {
  const atMost = goalIsAtMost(goal);
  const entries =
    goal.metric === "LOGGED_TOTAL" || goal.metric === "LOGGED_LATEST"
      ? await db.goalEntry.findMany({
          where: { orgId, goalId: goal.id },
          orderBy: [{ day: "desc" }, { createdAt: "desc" }],
          take: 5,
        })
      : [];
  const amountText =
    progress.remaining > 0
      ? goal.metric === "SPENDING"
        ? `${goalValueLabel(goal.metric, progress.remaining, goal.unit)} over budget`
        : atMost
          ? `${goalValueLabel(goal.metric, progress.remaining, goal.unit)} over target`
          : `${goalValueLabel(goal.metric, progress.remaining, goal.unit)} more needed`
      : goal.metric === "SPENDING"
        ? `${goalValueLabel(goal.metric, Math.max(0, goal.target - progress.actual), goal.unit)} under budget`
        : "Target reached";
  const remainingDays = Math.max(1, Math.ceil(progress.daysRemaining));
  const paceText =
    progress.daysRemaining < 14
      ? `about ${goalValueLabel(goal.metric, progress.perDayNeeded, goal.unit)} a day ${
          remainingDays === 1
            ? "in the last day"
            : `in the next ${remainingDays} days`
        }`
      : `about ${goalValueLabel(goal.metric, progress.perDayNeeded * 7, goal.unit)} a week`;
  const valueText =
    goal.metric === "LOGGED_LATEST" && progress.baseline !== null
      ? `${goalValueLabel(goal.metric, progress.baseline, goal.unit)} → ${goalValueLabel(goal.metric, progress.target, goal.unit)}, now ${goalValueLabel(goal.metric, progress.actual, goal.unit)}`
      : `${goalValueLabel(goal.metric, progress.actual, goal.unit)} of ${goalValueLabel(goal.metric, progress.target, goal.unit)}`;
  const barClass =
    progress.status === "behind"
      ? statusClass(progress.status, goal, progress).includes("red")
        ? "bg-red-500"
        : "bg-amber-500"
      : progress.status === "on_pace"
        ? "bg-blue-500"
        : "bg-emerald-500";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {goalMetricLabel(goal.metric, accountType)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {goal.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {progress.periodLabel}
          </p>
          {(goal.metric === "LOGGED_TOTAL" ||
            goal.metric === "LOGGED_LATEST") && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {atMost ? "Stay under" : "Reach at least"}
            </p>
          )}
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(progress.status, goal, progress)}`}
        >
          {statusLabel(progress.status)}
        </span>
      </div>
      <div className="mt-5">
        <div className="flex items-end justify-between gap-3 text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {valueText}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {Math.round(progress.pct)}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
          />
        </div>
        {goal.metric === "HABIT" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <form action={toggleHabitCheckIn}>
              <input type="hidden" name="goalId" value={goal.id} />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {progress.todayChecked ? "Undo today" : "Done today"}
              </button>
            </form>
            <span className="text-zinc-600 dark:text-zinc-400">
              Streak: {progress.currentStreak} day
              {progress.currentStreak === 1 ? "" : "s"}
            </span>
          </div>
        )}
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {goal.metric === "HABIT"
            ? `${Math.round(progress.actual)} of ${Math.round(progress.target)} days`
            : amountText}
          {progress.perDayNeeded > 0 &&
            progress.status !== "met" &&
            !atMost &&
            goal.metric !== "HABIT" && (
              <>
                {" "}
                · {paceText}
              </>
            )}
        </p>
        {goal.metric === "HABIT" && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {Math.round(progress.actual)} of {Math.round(progress.target)} days{" "}
            {progress.periodLabel}
          </p>
        )}
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Expected by now: {Math.round(progress.expectedPct)}% · actual:{" "}
          {Math.round(progress.pct)}%
        </p>
        {(goal.metric === "LOGGED_TOTAL" || goal.metric === "LOGGED_LATEST") && (
          <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Log a number
            </p>
            <form action={logGoalEntry} className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
              <input type="hidden" name="goalId" value={goal.id} />
              <Input
                name="value"
                required
                inputMode="decimal"
                placeholder="1,200"
                aria-label="Value"
              />
              <Input
                name="day"
                type="date"
                defaultValue={today}
                aria-label="Date"
              />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Add
              </button>
              <Input
                name="note"
                placeholder="Note (optional)"
                aria-label="Note"
                className="sm:col-span-3"
              />
            </form>
            {entries.length > 0 && (
              <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-700">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2 text-xs"
                  >
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {entry.day} ·{" "}
                      {goalValueLabel(goal.metric, entry.value, goal.unit)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </span>
                    <form action={deleteGoalEntry}>
                      <input type="hidden" name="id" value={entry.id} />
                      <input type="hidden" name="goalId" value={goal.id} />
                      <button
                        type="submit"
                        className="font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <Link
          href={`/goals/${goal.id}/edit`}
          className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          Edit
        </Link>
        <form action={archiveGoal}>
          <input type="hidden" name="id" value={goal.id} />
          <button
            type="submit"
            className="font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 py-3 last:border-0 dark:border-zinc-700">
      <div>
        <p className="font-medium text-zinc-800 dark:text-zinc-200">{goal.title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {goalMetricLabel(goal.metric, accountType)} ·{" "}
          {goalValueLabel(goal.metric, progress.actual, goal.unit)} of{" "}
          {goalValueLabel(goal.metric, progress.target, goal.unit)}
        </p>
      </div>
      <form action={restoreGoal}>
        <input type="hidden" name="id" value={goal.id} />
        <button
          type="submit"
          className="text-sm font-medium text-zinc-700 underline underline-offset-2 dark:text-zinc-300"
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
  if (!user.orgId) return null;
  const accountType = user.accountType ?? "AUTO_SHOP";
  const features =
    accountType === "AUTO_SHOP"
      ? enabledFeatureSet(user)
      : new Set(user.features ?? []);
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
            await Promise.all(
              active.map(({ goal, progress }) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  progress={progress}
                  accountType={accountType}
                  orgId={user.orgId!}
                  today={today}
                />
              )),
            )
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
                      accountType={accountType}
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
              accountType={accountType}
              features={[...features]}
              initial={{ startDate: today }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
