import Link from "next/link";
import { Card, CardHeader, Input } from "@/components/ui";
import { toggleRoutineCheckOff } from "./routines/actions";
import {
  logGoalEntry,
  setGoalManualProgress,
  toggleHabitCheckIn,
} from "./actions";
import { loadTodayRoutines, routineLabel } from "@/lib/routines";
import {
  goalValueLabel,
  loadActiveGoals,
  type GoalProgress,
  type GoalRecord,
  habitButtonLabel,
} from "@/lib/goals";
import { localCalendarDay } from "@/lib/timezone";

const CHECKABLE_METRICS = [
  "HABIT",
  "LOGGED_TOTAL",
  "LOGGED_LATEST",
  "MANUAL",
];

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

function GoalQuickAction({
  goal,
  progress,
}: {
  goal: GoalRecord;
  progress: GoalProgress;
}) {
  const summary = `${goalValueLabel(goal.metric, progress.actual, goal.unit)} of ${goalValueLabel(goal.metric, progress.target, goal.unit)} · ${progress.periodLabel}`;
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/goals/${goal.id}`}
          className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {goal.title}
        </Link>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {summary}
        </span>
      </div>
      {goal.metric === "HABIT" ? (
        <form action={toggleHabitCheckIn} className="mt-3 flex items-center gap-3">
          <input type="hidden" name="goalId" value={goal.id} />
          <button type="submit" className={buttonClass}>
            {habitButtonLabel(progress)}
          </button>
          {!progress.ended && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Streak: {progress.currentStreak} day
              {progress.currentStreak === 1 ? "" : "s"}
            </span>
          )}
        </form>
      ) : goal.metric === "MANUAL" ? (
        <form
          action={setGoalManualProgress}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="goalId" value={goal.id} />
          <label className="w-32 text-xs text-zinc-500 dark:text-zinc-400">
            Progress
            <Input
              name="value"
              required
              inputMode="decimal"
              defaultValue={goal.manualProgress ?? ""}
              className="mt-1"
            />
          </label>
          <button type="submit" className={buttonClass}>
            Update
          </button>
        </form>
      ) : (
        <form
          action={logGoalEntry}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="goalId" value={goal.id} />
          <label className="w-32 text-xs text-zinc-500 dark:text-zinc-400">
            {goal.unit ? `Today's ${goal.unit}` : "Today's number"}
            <Input
              name="value"
              required
              inputMode="decimal"
              aria-label="Value"
              className="mt-1"
            />
          </label>
          <button type="submit" className={buttonClass}>
            Log
          </button>
        </form>
      )}
    </div>
  );
}

export async function Today({
  orgId,
  timezone,
  hasInvoices,
  goalId,
  showGoals = true,
  title,
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
  goalId?: string;
  showGoals?: boolean;
  title?: string;
}) {
  const [groups, goals] = await Promise.all([
    loadTodayRoutines(orgId, timezone, goalId),
    showGoals
      ? loadActiveGoals(orgId, timezone, hasInvoices)
      : Promise.resolve([]),
  ]);
  const quickGoals = goals.filter(
    ({ goal }) =>
      CHECKABLE_METRICS.includes(goal.metric) &&
      (!goalId || goal.id === goalId),
  );
  if (!groups.length && !quickGoals.length) return null;
  const day = localCalendarDay(new Date(), timezone);
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader title={title ?? "Today"}>
        <Link
          href="/goals/routines"
          className="text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Manage routines →
        </Link>
      </CardHeader>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        {quickGoals.length > 0 && (
          <section className="px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Goals to check off
            </p>
            <div className="space-y-3">
              {quickGoals.map(({ goal, progress }) => (
                <GoalQuickAction key={goal.id} goal={goal} progress={progress} />
              ))}
            </div>
          </section>
        )}
        {groups.map(({ routine, items }) => (
          <section key={routine.id} className="px-4 py-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/goals/routines/${routine.id}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {routine.title}
              </Link>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {routineLabel(routine)}
              </span>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {item.label}
                        {item.target != null && (
                          <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                            {item.target} {item.unit ?? ""}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.dueTime ?? routine.dueTime
                          ? `Due ${item.dueTime ?? routine.dueTime}`
                          : "No deadline"}
                      </p>
                    </div>
                    {item.status !== "done" && (
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                          item.status === "late"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : item.status === "missed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {item.status === "late" ? "Late" : item.status === "missed" ? "Missed" : "Due"}
                      </span>
                    )}
                  </div>
                  <form
                    action={toggleRoutineCheckOff.bind(null, item.id, day)}
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <details className="min-w-[8rem] flex-1">
                      <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Note
                      </summary>
                      <Input
                        name="note"
                        defaultValue={item.checkOff?.note ?? ""}
                        placeholder="Optional note"
                        className="mt-2"
                      />
                    </details>
                    {item.target != null && (
                      <label className="w-28 text-xs text-zinc-500 dark:text-zinc-400">
                        Value
                        <Input
                          name="value"
                          type="number"
                          step="any"
                          defaultValue={item.checkOff?.value ?? ""}
                          placeholder={String(item.target)}
                          className="mt-1"
                        />
                      </label>
                    )}
                    <button type="submit" className={buttonClass}>
                      {item.status === "done" ? "Undo" : "Check off"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
