import Link from "next/link";
import { db } from "@/lib/db";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fullName, vehicleLabel } from "@/lib/utils";
import { prettyStatus } from "./AppointmentForm";
import { statusBadgeClass } from "./status";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  // Determine week start (Monday) either from ?week=YYYY-MM-DD or from today.
  const anchor = week ? new Date(`${week}T00:00:00`) : new Date();
  const weekStart = startOfWeek(anchor);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const appointments = await db.appointment.findMany({
    where: {
      startsAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { startsAt: "asc" },
    include: {
      customer: true,
      vehicle: true,
      repairOrder: { select: { id: true, roNumber: true } },
    },
  });

  // Group by day (YYYY-MM-DD local)
  const days: { date: Date; key: string; items: typeof appointments }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push({ date: d, key: ymd(d), items: [] });
  }
  for (const a of appointments) {
    const k = ymd(a.startsAt);
    const bucket = days.find((x) => x.key === k);
    if (bucket) bucket.items.push(a);
  }

  const today = ymd(new Date());
  const rangeLabel = `${formatWeekRange(weekStart)} ${weekStart.getFullYear()}`;

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Upcoming appointments, week view"
        actions={
          <>
            <LinkButton
              href={`/appointments?week=${ymd(new Date())}`}
              variant="ghost"
              size="sm"
            >
              Today
            </LinkButton>
            <LinkButton
              href="/reminders/appointments?day=tomorrow"
              variant="secondary"
              size="sm"
            >
              Reminders
            </LinkButton>
            <LinkButton href="/appointments/new">+ New appointment</LinkButton>
          </>
        }
      />

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-700">{rangeLabel}</div>
        <div className="flex gap-1">
          <LinkButton
            href={`/appointments?week=${ymd(prevWeek)}`}
            variant="secondary"
            size="sm"
          >
            ← Prev
          </LinkButton>
          <LinkButton
            href={`/appointments?week=${ymd(nextWeek)}`}
            variant="secondary"
            size="sm"
          >
            Next →
          </LinkButton>
        </div>
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          title="Nothing on the schedule this week"
          description="Book your next customer."
          action={
            <LinkButton href="/appointments/new">+ New appointment</LinkButton>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((d) => {
          const isToday = d.key === today;
          return (
            <div
              key={d.key}
              className={
                "rounded-lg border bg-white min-h-32 " +
                (isToday
                  ? "border-zinc-900 shadow-sm"
                  : "border-zinc-200")
              }
            >
              <div
                className={
                  "px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider " +
                  (isToday
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "bg-zinc-50 text-zinc-600 border-zinc-200")
                }
              >
                {dayLabel(d.date)}
              </div>
              <div className="p-2 space-y-1">
                {d.items.length === 0 && (
                  <div className="text-xs text-zinc-400 px-1 py-2">—</div>
                )}
                {d.items.map((a) => (
                  <Link
                    key={a.id}
                    href={`/appointments/${a.id}`}
                    className="block rounded-md border border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-300 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-900">
                        {timeLabel(a.startsAt)}
                      </span>
                      <span
                        className={
                          "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded " +
                          statusBadgeClass(a.status)
                        }
                      >
                        {prettyStatus(a.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-zinc-900 line-clamp-1">
                      {a.reason}
                    </div>
                    <div className="text-xs text-zinc-600 line-clamp-1">
                      {fullName(a.customer)}
                    </div>
                    {a.vehicle && (
                      <div className="text-[11px] text-zinc-500 line-clamp-1">
                        {vehicleLabel(a.vehicle)}
                      </div>
                    )}
                    {a.repairOrder && (
                      <div className="text-[11px] text-indigo-700 mt-0.5">
                        → RO #{a.repairOrder.roNumber}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  // Monday as the first day of the week
  const dow = out.getDay(); // 0 Sun - 6 Sat
  const diff = (dow + 6) % 7;
  out.setDate(out.getDate() - diff);
  return out;
}

function ymd(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function timeLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      month: withMonth ? "short" : undefined,
      day: "numeric",
    }).format(d);
  if (sameMonth) {
    return `${fmt(start, true)} – ${fmt(end, false)}`;
  }
  return `${fmt(start, true)} – ${fmt(end, true)}`;
}
