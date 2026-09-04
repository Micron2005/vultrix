import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader, Input, LinkButton, PageHeader } from "@/components/ui";
import { canViewFinancials } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { orgTimeZone } from "@/lib/orgTimezone";
import { localCalendarDay, shiftCalendarDay } from "@/lib/timezone";
import { routineLabel, statusFor } from "@/lib/routines";
import { deleteRoutine, updateRoutine, addRoutineItem, updateRoutineItem, deleteRoutineItem, moveRoutineItem, archiveRoutine, restoreRoutine } from "../actions";
import { DeleteRoutineButton } from "../../DeleteRoutineButton";
import { RoutineSettingsForm } from "../../RoutineSettingsForm";


export default async function RoutineDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewFinancials(user.role)) redirect("/goals");
  if (!user.orgId) redirect("/admin");
  const { id } = await params;
  const { error } = (await searchParams) ?? {};
  const timezone = await orgTimeZone(user.orgId);
  const routine = await db.routine.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      goal: { select: { id: true, title: true } },
      items: { orderBy: { position: "asc" }, include: { checkOffs: { orderBy: { day: "desc" }, take: 30 } } },
    },
  });
  if (!routine) notFound();
  const goals = await db.goal.findMany({ where: { orgId: user.orgId, archived: false }, orderBy: { title: "asc" }, select: { id: true, title: true } });
  const users = await db.user.findMany({
    where: { orgId: user.orgId, isActive: true, role: { not: "SUPERADMIN" } },
    orderBy: { username: "asc" },
    select: { id: true, username: true },
  });
  const today = localCalendarDay(new Date(), timezone);
  const createdDay = localCalendarDay(routine.createdAt, timezone);
  const days = Array.from({ length: 14 }, (_, index) => shiftCalendarDay(today, index - 13));
  return (
    <>
      <PageHeader
        title={routine.title}
        description={<Link href="/goals" className="text-zinc-600 underline dark:text-zinc-400">← Back to Goals</Link>}
        actions={<LinkButton href="/goals" variant="secondary">Back to Goals</LinkButton>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{routineLabel(routine)}</span>
        {routine.goal && <><span>·</span><Link href={`/goals/${routine.goal.id}`} className="underline">Goal: {routine.goal.title}</Link></>}
        {routine.archived && <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">Archived</span>}
      </div>
      <Card className="p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader title="Routine settings" />
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}
        <RoutineSettingsForm
          action={updateRoutine.bind(null, routine.id)}
          initial={routine}
          goals={goals}
          users={users}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          {routine.archived ? (
            <form action={restoreRoutine}><input type="hidden" name="id" value={id} /><button className="px-3 py-2 text-sm underline">Restore</button></form>
          ) : (
            <form action={archiveRoutine}><input type="hidden" name="id" value={id} /><button className="px-3 py-2 text-sm text-zinc-500 underline">Archive</button></form>
          )}
          <DeleteRoutineButton
            action={deleteRoutine}
            routineId={id}
            title={routine.title}
            className="px-3 py-2 text-sm text-red-600 underline"
          />
        </div>
      </Card>
      <Card className="mt-6 p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader title={`Items (${routine.items.length})`} />
        <div className="mt-4 space-y-4">
          {routine.items.map((item, index) => (
            <div key={item.id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
              <form action={updateRoutineItem.bind(null, item.id)} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_7rem_auto] sm:items-end">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Item<Input name="label" required defaultValue={item.label} className="mt-1" /></label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Target<Input name="target" type="number" step="any" defaultValue={item.target ?? ""} className="mt-1" /></label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Unit<Input name="unit" defaultValue={item.unit ?? ""} className="mt-1" /></label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Sets<Input name="sets" type="number" min="1" placeholder="4" defaultValue={item.sets ?? ""} className="mt-1" /></label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rest (sec)<Input name="restSeconds" type="number" min="5" placeholder="90" defaultValue={item.restSeconds ?? ""} className="mt-1" /></label>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Due time<Input name="dueTime" type="time" defaultValue={item.dueTime ?? ""} className="mt-1" /></label>
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">Save</button>
              </form>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <form action={moveRoutineItem.bind(null, item.id, "up")}><button disabled={index === 0} className="underline disabled:no-underline disabled:opacity-40">Move up</button></form>
                <form action={moveRoutineItem.bind(null, item.id, "down")}><button disabled={index === routine.items.length - 1} className="underline disabled:no-underline disabled:opacity-40">Move down</button></form>
                <form action={deleteRoutineItem}><input type="hidden" name="id" value={item.id} /><button className="text-red-600 underline">Delete</button></form>
              </div>
            </div>
          ))}
          <form action={addRoutineItem.bind(null, routine.id)} className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-600">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Add item</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_7rem_auto] sm:items-end">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Name<Input name="label" required placeholder="Read" className="mt-1" /></label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Target<Input name="target" type="number" step="any" className="mt-1" /></label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Unit<Input name="unit" placeholder="pages" className="mt-1" /></label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Sets<Input name="sets" type="number" min="1" placeholder="4" className="mt-1" /></label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rest (sec)<Input name="restSeconds" type="number" min="5" placeholder="90" className="mt-1" /></label>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Due time<Input name="dueTime" type="time" className="mt-1" /></label>
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Add item</button>
            </div>
          </form>
        </div>
      </Card>
      <Card className="mt-6 overflow-hidden dark:border-zinc-700 dark:bg-zinc-900">
        <CardHeader title="14-day history" />
        <div className="overflow-x-auto p-4">
          <table className="min-w-[42rem] w-full text-left text-xs">
            <thead><tr><th className="pb-2 pr-3 font-medium text-zinc-500">Item</th>{days.map((day) => <th key={day} className="px-1 pb-2 text-center font-medium text-zinc-500">{day.slice(5)}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {routine.items.map((item) => <tr key={item.id}><th className="max-w-32 truncate py-3 pr-3 font-medium text-zinc-700 dark:text-zinc-300">{item.label}</th>{days.map((day) => { const beforeCreation = day < createdDay; const status = beforeCreation ? "not_due" : statusFor(routine, item, day, today, new Date(), timezone, item.checkOffs); return <td key={day} className="px-1 py-3 text-center">{beforeCreation ? null : <span title={status} className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${status === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : status === "skipped" ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" : status === "late" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : status === "missed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"}`}>{status === "done" ? "✓" : status === "skipped" ? "S" : status === "not_due" ? "–" : "!"}</span>}</td>; })}</tr>)}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">✓ done · S skipped · amber late · red missed · – not due</p>
        </div>
      </Card>
    </>
  );
}
