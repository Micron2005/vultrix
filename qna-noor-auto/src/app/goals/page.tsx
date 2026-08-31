import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { GoalsOverview } from "@/components/charts/GoalsOverview";
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
import {
  goalRemainingSummary,
  statusClass,
  statusLabel,
} from "@/lib/goalStatus";
import { loadGoalDatasets, OVERVIEW_GOAL_LIMIT } from "@/lib/goalsOverview";
import { localCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { archiveGoal, createGoal, restoreGoal, toggleHabitCheckIn } from "./actions";
import { GoalForm } from "./GoalForm";

export const dynamic = "force-dynamic";

function GoalCard({
  goal,
  progress,
  accountType,
  hasInvoices,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
  accountType: string;
  hasInvoices: boolean;
}) {
  const atMost = goalIsAtMost(goal);
  const remaining = goalRemainingSummary(goal, progress);
  const remainingDays = Math.max(1, Math.ceil(progress.daysRemaining));
  const paceText =
    progress.daysRemaining < 14
      ? `about ${goalValueLabel(goal.metric, progress.perDayNeeded, goal.unit)} a day ${
          remainingDays === 1
            ? "in the last day"
            : `in the next ${remainingDays} days`
        }`
      : `about ${goalValueLabel(goal.metric, progress.perDayNeeded * 7, goal.unit)} a week`;
  const emptyLatest =
    goal.metric === "LOGGED_LATEST" &&
    progress.baseline === null &&
    progress.actual === 0;
  const valueText = emptyLatest
    ? "No numbers logged yet"
    : goal.metric === "LOGGED_LATEST" && progress.baseline !== null
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
  const supportText =
    goal.metric === "HABIT"
      ? `${Math.round(progress.actual)} of ${Math.round(progress.target)} days ${progress.periodLabel}`
      : emptyLatest
        ? null
        : remaining.text;
  const showPace =
    progress.perDayNeeded > 0 &&
    progress.status !== "met" &&
    !atMost &&
    goal.metric !== "HABIT";

  return (
    <Card className="flex flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {goalMetricLabel(goal.metric, accountType, hasInvoices)}
        </span>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(progress.status, goal, progress)}`}
        >
          {statusLabel(progress.status)}
        </span>
      </div>
      <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        <Link href={`/goals/${goal.id}`} className="hover:underline">
          {goal.title}
        </Link>
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {progress.periodLabel}
        {(goal.metric === "LOGGED_TOTAL" || goal.metric === "LOGGED_LATEST") &&
          ` · ${atMost ? "Stay under" : "Reach at least"}`}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {valueText}
        </span>
        {!emptyLatest && (
          <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {Math.round(progress.pct)}%
          </span>
        )}
      </div>
      {!emptyLatest && (
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
          />
          <div
            title={`Where you should be by now: ${Math.round(progress.expectedPct)}%`}
            className="absolute top-0 h-full w-0.5 bg-zinc-500 dark:bg-zinc-300"
            style={{
              left: `${Math.min(100, Math.max(0, progress.expectedPct))}%`,
            }}
          />
        </div>
      )}
      {supportText && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {supportText}
          {showPace && <> · {paceText}</>}
        </p>
      )}

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

      <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-700">
        <Link
          href={`/goals/${goal.id}`}
          className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
        >
          View analytics
        </Link>
        {(goal.metric === "LOGGED_TOTAL" || goal.metric === "LOGGED_LATEST") && (
          <Link
            href={`/goals/${goal.id}`}
            className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            Log a number
          </Link>
        )}
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
  hasInvoices,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
  accountType: string;
  hasInvoices: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 py-3 last:border-0 dark:border-zinc-700">
      <div>
        <p className="font-medium text-zinc-800 dark:text-zinc-200">{goal.title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {goalMetricLabel(goal.metric, accountType, hasInvoices)} ·{" "}
          {goalValueLabel(goal.metric, progress.actual, goal.unit)} of{" "}
          {goalValueLabel(goal.metric, progress.target, goal.unit)} ·{" "}
          {goalRemainingSummary(goal, progress).text}
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
  const features = enabledFeatureSet(user);
  const timezone = await orgTimeZone(user.orgId);
  const hasInvoices = features.has("invoices");
  const active = await loadActiveGoals(user.orgId, timezone, hasInvoices);
  const archived = await db.goal.findMany({
    where: { orgId: user.orgId, archived: true },
    orderBy: { updatedAt: "desc" },
  });
  const today = localCalendarDay(new Date(), timezone);
  const charted = active.slice(0, OVERVIEW_GOAL_LIMIT);
  const datasets =
    charted.length > 0
      ? await loadGoalDatasets(
          user.orgId,
          charted,
          new Date(),
          timezone,
          hasInvoices,
        )
      : [];
  const counts = {
    total: active.length,
    onPace: active.filter(
      ({ progress }) =>
        progress.status === "ahead" || progress.status === "on_pace",
    ).length,
    behind: active.filter(({ progress }) => progress.status === "behind").length,
    met: active.filter(({ progress }) => progress.status === "met").length,
  };

  return (
    <>
      <PageHeader
        title="Goals"
        description="Track progress using the money, sales, and activity already in your account."
        actions={
          <LinkButton href="#new-goal" variant="secondary">
            New goal
          </LinkButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active goals" value={String(counts.total)} />
        <StatTile label="Ahead or on pace" value={String(counts.onPace)} />
        <StatTile label="Behind" value={String(counts.behind)} />
        <StatTile label="Met" value={String(counts.met)} />
      </div>

      {datasets.length > 0 && (
        <Card className="mt-6 p-5">
          <CardHeader title="Progress overview" />
          <div className="pt-5">
            <GoalsOverview
              datasets={datasets}
              combinedNote={
                active.length > charted.length
                  ? `Combined view shows each goal as a share of its own target — your ${charted.length} most recent goals of ${active.length}.`
                  : "Combined view shows each goal as a share of its own target."
              }
            />
          </div>
        </Card>
      )}

      <div className="mt-6">
        {active.length === 0 ? (
          <EmptyState
            title="No active goals yet"
            description="Create a goal to see progress scored from your existing records."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map(({ goal, progress }) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress}
                accountType={accountType}
                hasInvoices={hasInvoices}
              />
            ))}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <Card className="mt-6 p-5">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Archived goals ({archived.length})
            </summary>
            <div className="mt-2">
              {await Promise.all(
                archived.map(async (goal) => (
                  <ArchivedGoal
                    key={goal.id}
                    goal={goal as GoalRecord}
                    accountType={accountType}
                    hasInvoices={hasInvoices}
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
          </details>
        </Card>
      )}

      <div id="new-goal" className="scroll-mt-6">
        <Card className="mt-6 p-5">
          <CardHeader title="Create a goal" />
          <div className="mt-4 max-w-2xl">
            <GoalForm
              action={createGoal}
              accountType={accountType}
              features={[...features]}
              hasInvoices={hasInvoices}
              initial={{ startDate: today }}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
