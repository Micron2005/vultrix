import Link from "next/link";
import { Card, CardHeader, Input } from "@/components/ui";
import {
  skipRoutineDay,
  snoozeRoutine,
  toggleRoutineCheckOff,
} from "./routines/actions";
import { logGoalEntry, setGoalManualProgress } from "./actions";
import { loadTodayRoutines, routineLabel } from "@/lib/routines";
import {
  goalValueLabel,
  loadActiveGoals,
  type GoalProgress,
  type GoalRecord,
} from "@/lib/goals";
import { goalPaceText } from "@/lib/goalStatus";
import { localCalendarDay } from "@/lib/timezone";

const CHECKABLE_METRICS = ["LOGGED_TOTAL", "LOGGED_LATEST", "MANUAL"];
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
        <Link href={`/goals/${goal.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
          {goal.title}
        </Link>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{summary}</span>
      </div>
      {goal.metric === "MANUAL" ? (
        <form action={setGoalManualProgress} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="goalId" value={goal.id} />
          <label className="w-32 text-xs text-zinc-500 dark:text-zinc-400">
            Progress
            <Input name="value" required inputMode="decimal" defaultValue={goal.manualProgress ?? ""} className="mt-1" />
          </label>
          <button type="submit" className={buttonClass}>Update</button>
        </form>
      ) : (
        <form action={logGoalEntry} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="goalId" value={goal.id} />
          <label className="w-32 text-xs text-zinc-500 dark:text-zinc-400">
            {goal.unit ? `Today's ${goal.unit}` : "Today's number"}
            <Input name="value" required inputMode="decimal" aria-label="Value" className="mt-1" />
          </label>
          <button type="submit" className={buttonClass}>Log</button>
        </form>
      )}
    </div>
  );
}

function statusClass(status: string): string {
  return status === "late"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    : status === "missed"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : status === "skipped"
        ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
        : status === "done"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function statusLabel(status: string): string {
  return status === "late"
    ? "Late"
    : status === "missed"
      ? "Missed"
      : status === "skipped"
        ? "Skipped"
        : status === "done"
          ? "Done"
          : "Due";
}

type RoutineGroup = Awaited<ReturnType<typeof loadTodayRoutines>>[number];

function RoutineSection({
  routine,
  items,
  today,
  reminder,
  canManage,
}: {
  routine: RoutineGroup["routine"];
  items: RoutineGroup["items"];
  today: string;
  reminder: boolean;
  canManage: boolean;
}) {
  const actionDay =
    (routine.kind === "ONE_OFF" || routine.kind === "REMINDER") && routine.day
      ? routine.day
      : today;
  return (
    <section className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        {canManage ? (
          <Link href={`/goals/routines/${routine.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
            {routine.title}
          </Link>
        ) : (
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{routine.title}</span>
        )}
        {routine.assignee && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            · Assigned to {routine.assignee.username}
          </span>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{routineLabel(routine)}</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {item.label}
                  {item.target != null && (
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">{item.target} {item.unit ?? ""}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {item.dueTime ?? routine.dueTime ? `Due ${item.dueTime ?? routine.dueTime}` : "No deadline"}
                  {item.checkOff?.user && ` · Done by ${item.checkOff.user.username}`}
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <form action={toggleRoutineCheckOff.bind(null, item.id, actionDay)}>
                <button type="submit" className={buttonClass}>
                  {item.status === "done" || item.status === "skipped" ? "Undo" : reminder ? "Got it" : "Check off"}
                </button>
              </form>
              {!reminder && routine.kind !== "ONE_OFF" && (
                <form action={skipRoutineDay.bind(null, item.id, actionDay)}>
                  <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                    {item.status === "skipped" ? "Undo skip" : "Skip today"}
                  </button>
                </form>
              )}
              {(routine.kind === "ONE_OFF" || reminder) && (
                <form action={snoozeRoutine}>
                  <input type="hidden" name="id" value={routine.id} />
                  <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                    Tomorrow
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BehindGoal({ goal, progress }: { goal: GoalRecord; progress: GoalProgress }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <div>
        <Link href={`/goals/${goal.id}`} className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">{goal.title}</Link>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{goalPaceText(goal, progress)}</p>
      </div>
      <Link href={`/goals/${goal.id}`} className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300">View goal</Link>
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
  forUserId,
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
  goalId?: string;
  showGoals?: boolean;
  title?: string;
  forUserId?: string;
}) {
  const [groups, goals] = await Promise.all([
    loadTodayRoutines(orgId, timezone, { goalId, forUserId }),
    showGoals ? loadActiveGoals(orgId, timezone, hasInvoices) : Promise.resolve([]),
  ]);
  const quickGoals = goals.filter(({ goal }) => CHECKABLE_METRICS.includes(goal.metric) && (!goalId || goal.id === goalId));
  const behindGoals = goals.filter(({ goal, progress }) => progress.status === "behind" && !quickGoals.some(({ goal: quickGoal }) => quickGoal.id === goal.id));
  const reminders = groups.filter(({ routine }) => routine.kind === "REMINDER");
  const todo = groups.filter(({ routine }) => routine.kind !== "REMINDER");
  if (!reminders.length && !todo.length && !quickGoals.length && !behindGoals.length) return null;
  const today = localCalendarDay(new Date(), timezone);
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader title={title ?? "Today"} />
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        {reminders.length > 0 && (
          <section>
            <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Reminders</div>
            {reminders.map(({ routine, items }) => <RoutineSection key={routine.id} routine={routine} items={items} today={today} reminder canManage={!forUserId} />)}
          </section>
        )}
        {todo.length > 0 && (
          <section>
            <div className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">To do today</div>
            {todo.map(({ routine, items }) => <RoutineSection key={routine.id} routine={routine} items={items} today={today} reminder={false} canManage={!forUserId} />)}
          </section>
        )}
        {(quickGoals.length > 0 || behindGoals.length > 0) && (
          <section className="px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Numbers to update</p>
            <div className="space-y-3">
              {quickGoals.map(({ goal, progress }) => <GoalQuickAction key={goal.id} goal={goal} progress={progress} />)}
              {behindGoals.map(({ goal, progress }) => <BehindGoal key={goal.id} goal={goal} progress={progress} />)}
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}
