import Link from "next/link";
import { Card, CardHeader, Input } from "@/components/ui";
import { toggleRoutineCheckOff } from "./actions";
import { loadTodayRoutines, routineLabel } from "@/lib/routines";
import { localCalendarDay } from "@/lib/timezone";

export async function TodayChecklist({
  orgId,
  timezone,
  goalId,
}: {
  orgId: string;
  timezone: string;
  goalId?: string;
}) {
  const groups = await loadTodayRoutines(orgId, timezone, goalId);
  if (!groups.length) return null;
  const day = localCalendarDay(new Date(), timezone);
  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader title="Today">
        <Link
          href="/routines"
          className="text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Manage routines →
        </Link>
      </CardHeader>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
        {groups.map(({ routine, items }) => (
          <section key={routine.id} className="px-4 py-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/routines/${routine.id}`}
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
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      Check off
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
