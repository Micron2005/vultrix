import Link from "next/link";
import { Card, CardHeader, EmptyState, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { assertCanViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { routineLabel, ROUTINE_WEEKDAYS } from "@/lib/routines";
import { createRoutine, archiveRoutine, restoreRoutine } from "./actions";


export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  assertCanViewFinancials(user.role);
  if (!user.orgId) return null;
  const query = await searchParams;
  const [routines, goals] = await Promise.all([
    db.routine.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ archived: "asc" }, { updatedAt: "desc" }],
      include: { items: { orderBy: { position: "asc" } }, goal: { select: { id: true, title: true } } },
    }),
    db.goal.findMany({
      where: { orgId: user.orgId, archived: false },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  const active = routines.filter((routine) => !routine.archived);
  const archived = routines.filter((routine) => routine.archived);
  return (
    <>
      <PageHeader
        title="Routines"
        description={
          <Link href="/goals" className="text-zinc-600 underline dark:text-zinc-400">
            ← Back to goals
          </Link>
        }
        actions={<LinkButton href="#new-routine">New routine</LinkButton>}
      />
      {active.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((routine) => (
            <Card key={routine.id} className="p-5 dark:border-zinc-700 dark:bg-zinc-900">
              <CardHeader title={<Link href={`/goals/routines/${routine.id}`} className="hover:underline">{routine.title}</Link>}>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{routineLabel(routine)}</span>
              </CardHeader>
              <div className="pt-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {routine.goal ? <>Part of <Link href={`/goals/${routine.goal.id}`} className="underline">{routine.goal.title}</Link> · </> : ""}
                  {routine.dueTime ? `Due ${routine.dueTime}` : "No default deadline"}
                </p>
                {routine.items.length ? (
                  <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-700">
                    {routine.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <span>{item.label}</span>
                        <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.target != null ? `${item.target} ${item.unit ?? ""}` : ""}
                          {item.dueTime ? ` · ${item.dueTime}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No items yet. Add some from the routine page.</p>
                )}
                <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700">
                  <Link href={`/goals/routines/${routine.id}`} className="font-medium text-zinc-700 underline dark:text-zinc-300">Manage items</Link>
                  <form action={archiveRoutine}>
                    <input type="hidden" name="id" value={routine.id} />
                    <button className="text-zinc-500 underline dark:text-zinc-400">Archive</button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No routines yet" description="Create a routine to turn the things that matter into a simple checklist." />
      )}

      {archived.length > 0 && (
        <details className="mt-6 rounded-lg border border-zinc-200 bg-white px-4 dark:border-zinc-700 dark:bg-zinc-900">
          <summary className="cursor-pointer py-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Archived routines ({archived.length})</summary>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {archived.map((routine) => (
              <div key={routine.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/goals/routines/${routine.id}`} className="text-sm font-medium text-zinc-800 underline dark:text-zinc-200">{routine.title}</Link>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{routineLabel(routine)}</p>
                </div>
                <form action={restoreRoutine}>
                  <input type="hidden" name="id" value={routine.id} />
                  <button className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300">Restore</button>
                </form>
              </div>
            ))}
          </div>
        </details>
      )}

      <Card className="mt-6 p-5 dark:border-zinc-700 dark:bg-zinc-900" >
        <div id="new-routine" className="scroll-mt-6">
          <CardHeader title="Create a routine" />
          <form action={createRoutine} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Name
                <Input name="title" required placeholder="Morning reset" className="mt-1" />
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Schedule
                <Select name="kind" defaultValue="DAILY" className="mt-1">
                  <option value="DAILY">Every day</option>
                  <option value="WEEKDAYS">Selected weekdays</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="ONE_OFF">One time</option>
                </Select>
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Default due time (optional)
                <Input name="dueTime" type="time" className="mt-1" />
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">One-off date (only for one-time routines)
                <Input name="day" type="date" className="mt-1" />
              </label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Part of goal (optional)
                <Select name="goalId" defaultValue={query.goal ?? ""} className="mt-1">
                  <option value="">No linked goal</option>
                  {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                </Select>
              </label>
            </div>
            <fieldset>
              <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Weekdays (for selected weekdays)</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {ROUTINE_WEEKDAYS.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" name="weekdays" value={value} defaultChecked={value !== "0" && value !== "6"} />{label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">Create routine</button>
          </form>
        </div>
      </Card>
    </>
  );
}
