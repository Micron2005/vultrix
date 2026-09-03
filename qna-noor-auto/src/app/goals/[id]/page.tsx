import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChartSwitcher } from "@/components/charts/ChartSwitcher";
import {
  Card,
  CardHeader,
  Input,
  LinkButton,
  PageHeader,
  Select,
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
import { ROUTINE_WEEKDAYS } from "@/lib/routines";
import { createRoutine } from "../routines/actions";
import {
  archiveGoal,
  addGoalMilestone,
  deleteGoalMilestone,
  deleteGoal,
  deleteGoalEntry,
  logGoalEntry,
  moveGoalMilestone,
  toggleGoalMilestone,
  updateGoalMilestone,
} from "../actions";
import { DeleteGoalButton } from "../DeleteGoalButton";
import { DeleteMilestoneButton } from "../DeleteMilestoneButton";
import { Today } from "../Today";

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
  const [entries, entryCount] = await Promise.all([
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
  ]);
  const [linkedRoutines, milestones] = await Promise.all([
    db.routine.findMany({
      where: { orgId: user.orgId, goalId: record.id, archived: false },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, kind: true },
    }),
    db.goalMilestone.findMany({
      where: { orgId: user.orgId, goalId: record.id },
      orderBy: { position: "asc" },
      include: { doneBy: { select: { username: true } } },
    }),
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
            <DeleteGoalButton
              action={deleteGoal}
              goalId={record.id}
              title={record.title}
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            />
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
      <Card className="mb-6 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader title="Steps" />
        <div className="px-4 pt-2">
          {milestones.length ? (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {milestones.map((milestone, index) => (
                <div
                  key={milestone.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <form
                      action={toggleGoalMilestone.bind(null, milestone.id)}
                    >
                      <button
                        type="submit"
                        aria-label={milestone.doneDay ? "Undo" : "Check off"}
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs ${
                          milestone.doneDay
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-400 dark:border-zinc-500"
                        }`}
                      >
                        {milestone.doneDay ? "✓" : ""}
                      </button>
                    </form>
                    <div className="min-w-0">
                      <p
                        className={`text-sm ${
                          milestone.doneDay
                            ? "text-zinc-500 line-through dark:text-zinc-400"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {milestone.title}
                      </p>
                      {milestone.dueDay && !milestone.doneDay && (
                        <p
                          className={`text-xs ${
                            milestone.dueDay < today
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          by {milestone.dueDay}
                        </p>
                      )}
                      {milestone.doneDay && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Done {milestone.doneDay}
                          {milestone.doneBy
                            ? ` · ${milestone.doneBy.username}`
                            : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <form
                      action={moveGoalMilestone.bind(null, milestone.id, "up")}
                    >
                      <button
                        type="submit"
                        disabled={index === 0}
                        aria-label="Move step up"
                        className="text-sm text-zinc-500 disabled:opacity-30 dark:text-zinc-400"
                      >
                        ↑
                      </button>
                    </form>
                    <form
                      action={moveGoalMilestone.bind(null, milestone.id, "down")}
                    >
                      <button
                        type="submit"
                        disabled={index === milestones.length - 1}
                        aria-label="Move step down"
                        className="text-sm text-zinc-500 disabled:opacity-30 dark:text-zinc-400"
                      >
                        ↓
                      </button>
                    </form>
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-zinc-600 underline dark:text-zinc-300">
                        Edit
                      </summary>
                      <form
                        action={updateGoalMilestone.bind(null, milestone.id)}
                        className="mt-2 flex flex-wrap items-end gap-2"
                      >
                        <label className="text-xs text-zinc-500">
                          Title
                          <Input
                            name="title"
                            required
                            defaultValue={milestone.title}
                            className="mt-1 w-48"
                          />
                        </label>
                        <label className="text-xs text-zinc-500">
                          Due
                          <Input
                            name="dueDay"
                            type="date"
                            defaultValue={milestone.dueDay ?? ""}
                            className="mt-1"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                        >
                          Save
                        </button>
                      </form>
                    </details>
                    <DeleteMilestoneButton
                      action={deleteGoalMilestone.bind(null, milestone.id)}
                      title={milestone.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
              Break this goal into steps — e.g. &apos;Post the ad&apos;,
              &apos;Call 5 past customers&apos;.
            </p>
          )}
          <form
            action={addGoalMilestone}
            className="mt-2 flex flex-wrap items-end gap-2 border-t border-zinc-200 py-4 dark:border-zinc-700"
          >
            <input type="hidden" name="goalId" value={record.id} />
            <label className="text-xs text-zinc-500">
              New step
              <Input name="title" required placeholder="Post the ad" className="mt-1 w-56" />
            </label>
            <label className="text-xs text-zinc-500">
              Due (optional)
              <Input name="dueDay" type="date" className="mt-1" />
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add step
            </button>
          </form>
        </div>
      </Card>
      <Card className="mb-6 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader title="Routines & checklists" />
        <div className="px-4 pt-4">
          {linkedRoutines.length ? (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {linkedRoutines.map((routine) => (
                <Link
                  key={routine.id}
                  href={`/goals/routines/${routine.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm text-zinc-700 hover:underline dark:text-zinc-300"
                >
                  <span>{routine.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {routine.kind.replace("_", " ")}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No routines linked yet. Add one below — it shows up in Today so you
              can tick it off without opening this goal.
            </p>
          )}
          <form
            action={createRoutine}
            className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700"
          >
            <input type="hidden" name="goalId" value={record.id} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] sm:items-end">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                New routine
                <Input
                  name="title"
                  required
                  placeholder="Monday: legs"
                  className="mt-1"
                />
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Schedule
                <Select name="kind" defaultValue="WEEKDAYS" className="mt-1">
                  <option value="DAILY">Every day</option>
                  <option value="WEEKDAYS">Selected weekdays</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="ONE_OFF">One time</option>
                  <option value="REMINDER">Reminder</option>
                </Select>
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Due by
                <Input name="dueTime" type="time" className="mt-1" />
              </label>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Add routine
              </button>
            </div>
            <fieldset>
              <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Weekdays (for selected weekdays)
              </legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {ROUTINE_WEEKDAYS.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={value}
                      defaultChecked={value !== "0" && value !== "6"}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              One-off date (only for one-time routines)
              <Input name="day" type="date" className="mt-1 max-w-48" />
            </label>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              End date (optional)
              <Input name="endDay" type="date" className="mt-1 max-w-48" />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" name="showStreak" value="on" />
              Show streak
            </label>
          </form>
        </div>
      </Card>
      <Today
        orgId={user.orgId}
        timezone={timezone}
        hasInvoices={hasInvoices}
        goalId={record.id}
        showGoals={false}
        canManage
      />

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

    </>
  );
}
