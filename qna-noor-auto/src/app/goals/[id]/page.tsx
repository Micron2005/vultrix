import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChartSwitcher } from "@/components/charts/ChartSwitcher";
import {
  Card,
  CardHeader,
  Input,
  LinkButton,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { db } from "@/lib/db";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  computeGoalProgress,
  goalMetricLabel,
  goalUsesMoney,
  goalValueLabel,
  type GoalRecord,
} from "@/lib/goals";
import {
  goalRemainingSummary,
  statusClass,
  statusLabel,
} from "@/lib/goalStatus";
import { loadGoalBreakdown, loadGoalSeries } from "@/lib/goalSeries";
import { localCalendarDay } from "@/lib/timezone";
import {
  archiveGoal,
  deleteGoalEntry,
  logGoalEntry,
  toggleHabitCheckIn,
} from "../actions";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertCanViewFinancials(user.role);
  if (!user.orgId) redirect("/");
  const { id } = await params;
  const goal = await db.goal.findFirst({
    where: { id, orgId: user.orgId },
  });
  if (!goal) notFound();

  const timezone = await orgTimeZone(user.orgId);
  const features = enabledFeatureSet(user);
  const hasInvoices = features.has("invoices");
  const now = new Date();
  const record = goal as GoalRecord;
  const [progress, series] = await Promise.all([
    computeGoalProgress(user.orgId, record, now, timezone, hasInvoices),
    loadGoalSeries(user.orgId, record, now, timezone, hasInvoices),
  ]);
  const slices = await loadGoalBreakdown(
    user.orgId,
    record,
    now,
    timezone,
    hasInvoices,
    series,
  );
  const today = localCalendarDay(now, timezone);
  const [entries, entryCount, checkIns] = await Promise.all([
    record.metric === "LOGGED_TOTAL" || record.metric === "LOGGED_LATEST"
      ? db.goalEntry.findMany({
          where: { orgId: user.orgId, goalId: record.id },
          orderBy: [{ day: "desc" }, { createdAt: "desc" }],
          take: 60,
        })
      : [],
    record.metric === "LOGGED_TOTAL" || record.metric === "LOGGED_LATEST"
      ? db.goalEntry.count({ where: { orgId: user.orgId, goalId: record.id } })
      : 0,
    record.metric === "HABIT"
      ? db.goalCheckIn.findMany({
          where: { orgId: user.orgId, goalId: record.id },
          orderBy: { day: "desc" },
          take: 60,
          select: { id: true, day: true, note: true },
        })
      : [],
  ]);
  const emptyLatest =
    record.metric === "LOGGED_LATEST" &&
    progress.baseline === null &&
    progress.actual === 0;
  const currentText = emptyLatest
    ? "No numbers logged yet"
    : record.metric === "LOGGED_LATEST" && progress.baseline !== null
      ? `${goalValueLabel(record.metric, progress.baseline, record.unit)} → ${goalValueLabel(record.metric, progress.target, record.unit)}, now ${goalValueLabel(record.metric, progress.actual, record.unit)}`
      : goalValueLabel(record.metric, progress.actual, record.unit);
  const remaining = goalRemainingSummary(record, progress);

  return (
    <>
      <PageHeader
        title={record.title}
        description={
          <Link
            href="/goals"
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to goals
          </Link>
        }
        actions={
          <>
            <LinkButton href={`/goals/${record.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <form action={archiveGoal}>
              <input type="hidden" name="id" value={record.id} />
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Archive
              </button>
            </form>
          </>
        }
      />
      <div className="mb-6 flex items-center gap-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(progress.status, record, progress)}`}
        >
          {statusLabel(progress.status)}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {goalMetricLabel(record.metric, user.accountType, hasInvoices)} ·{" "}
          {progress.periodLabel}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Current value" value={currentText} />
        <StatTile
          label="Target"
          value={goalValueLabel(record.metric, progress.target, record.unit)}
        />
        <StatTile label={remaining.label} value={remaining.text} />
        <StatTile
          label="Complete vs expected"
          value={
            emptyLatest
              ? "No data yet"
              : `${Math.round(progress.pct)}% / ${Math.round(progress.expectedPct)}%`
          }
        />
        {record.metric === "HABIT" && (
          <StatTile
            label="Current streak"
            value={`${progress.currentStreak} day${progress.currentStreak === 1 ? "" : "s"}`}
          />
        )}
      </div>

      {record.notes && (
        <Card className="mt-6 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Details
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {record.notes}
          </p>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <CardHeader title="Progress over time" />
        <div className="pt-5">
          <ChartSwitcher
            points={series.points}
            cumulative={series.cumulative}
            pace={series.pace}
            slices={slices}
            valueLabel={{
              money: goalUsesMoney(record.metric),
              unit: record.unit,
            }}
            emptyMessage={
              series.supported
                ? "No progress data for this period yet."
                : "This goal is updated manually."
            }
          />
        </div>
      </Card>

      {(record.metric === "LOGGED_TOTAL" ||
        record.metric === "LOGGED_LATEST") && (
        <Card className="mt-6 p-5">
          <CardHeader title="Number history" />
          <div className="pt-4">
            <form
              action={logGoalEntry}
              className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]"
            >
              <input type="hidden" name="goalId" value={record.id} />
              <Input
                name="value"
                required
                inputMode="decimal"
                placeholder="1,200"
                aria-label="Value"
              />
              <Input name="day" type="date" defaultValue={today} aria-label="Date" />
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
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Showing {entries.length} of {entryCount} entr
              {entryCount === 1 ? "y" : "ies"}.
            </p>
            <div className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-700">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {entry.day} ·{" "}
                    {goalValueLabel(record.metric, entry.value, record.unit)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </span>
                  <form action={deleteGoalEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="goalId" value={record.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {record.metric === "HABIT" && (
        <Card className="mt-6 p-5">
          <CardHeader title="Habit history" />
          <div className="pt-4">
            <form action={toggleHabitCheckIn}>
              <input type="hidden" name="goalId" value={record.id} />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {progress.todayChecked ? "Undo today" : "Done today"}
              </button>
            </form>
            <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-700">
              {checkIns.map((checkIn) => (
                <div key={checkIn.id} className="py-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {checkIn.day}
                  {checkIn.note ? ` · ${checkIn.note}` : ""}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
