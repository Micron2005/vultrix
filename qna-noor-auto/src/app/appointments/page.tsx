import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fullName, vehicleLabel } from "@/lib/utils";
import { prettyStatus } from "./AppointmentForm";
import { statusBadgeClass } from "./status";
import { PersonalCalendar } from "./PersonalCalendar";
import { canDelete } from "@/lib/permissions";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  isDateInput,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import {
  addDays,
  endOfWeek,
  startOfMonth,
  startOfWeek as dfStartOfWeek,
} from "date-fns";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; date?: string }>;
}) {
  const user = await requireUser();
  if (user.accountType === "PERSONAL") {
    return (
      <PersonalCalendarPage
        searchParams={searchParams}
        canDeleteEvents={canDelete(user.role)}
      />
    );
  }
  return <ShopSchedulePage searchParams={searchParams} />;
}

async function PersonalCalendarPage({
  searchParams,
  canDeleteEvents,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
  canDeleteEvents: boolean;
}) {
  const orgId = await requireOrgId();
  const params = await searchParams;
  const view =
    params.view === "day" ||
    params.view === "week" ||
    params.view === "year"
      ? params.view
      : "month";
  const parsedDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const rangeStart =
    view === "day"
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
      : view === "week"
        ? dfStartOfWeek(date, { weekStartsOn: 1 })
        : view === "year"
          ? new Date(date.getFullYear(), 0, 1)
          : dfStartOfWeek(startOfMonth(date), { weekStartsOn: 1 });
  const rangeEnd =
    view === "day"
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      : view === "week"
        ? endOfWeek(date, { weekStartsOn: 1 })
        : view === "year"
          ? new Date(date.getFullYear() + 1, 0, 1)
          : addDays(
              dfStartOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
              42,
            );
  const events = await db.calendarEvent.findMany({
    where: { orgId, startsAt: { gte: rangeStart, lt: rangeEnd } },
    orderBy: { startsAt: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Plan your day, week, month, and year"
      />
      <PersonalCalendar
        canDelete={canDeleteEvents}
        view={view}
        date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`}
        events={events.map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt?.toISOString() ?? null,
          allDay: event.allDay,
          isReminder: event.isReminder,
          notes: event.notes,
        }))}
      />
    </>
  );
}

async function ShopSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const orgId = await requireOrgId();
  const timezone = await orgTimeZone(orgId);
  const { week } = await searchParams;

  // Determine week start (Monday) in the organization's timezone either from
  // ?week=YYYY-MM-DD or from the organization's current local day.
  const todayKey = localCalendarDay(new Date(), timezone);
  const anchorKey = week && isDateInput(week) ? week : todayKey;
  const weekStartKey = startOfWeekKey(anchorKey);
  const weekEndKey = shiftCalendarDay(weekStartKey, 7);
  const weekStart = dateInputInTimeZone(
    weekStartKey,
    timezone,
    new Date(Number.NaN),
  );
  const weekEnd = dateInputInTimeZone(
    weekEndKey,
    timezone,
    new Date(Number.NaN),
  );
  const prevWeekKey = shiftCalendarDay(weekStartKey, -7);
  const nextWeekKey = shiftCalendarDay(weekStartKey, 7);

  const appointments = await db.appointment.findMany({
    where: {
      orgId,
      startsAt: { gte: weekStart, lt: weekEnd },
    },
    orderBy: { startsAt: "asc" },
    include: {
      customer: true,
      vehicle: true,
      repairOrder: { select: { id: true, roNumber: true } },
    },
  });
  const requestedAppointments = await db.appointment.findMany({
    where: {
      orgId,
      startsAt: { gte: new Date() },
      status: "REQUESTED",
    },
    orderBy: { startsAt: "asc" },
    select: { id: true },
  });

  // Group by day (YYYY-MM-DD local)
  const days: { date: Date; key: string; items: typeof appointments }[] = [];
  for (let i = 0; i < 7; i++) {
    const key = shiftCalendarDay(weekStartKey, i);
    days.push({ date: calendarDate(key, timezone), key, items: [] });
  }
  for (const a of appointments) {
    const k = localCalendarDay(a.startsAt, timezone);
    const bucket = days.find((x) => x.key === k);
    if (bucket) bucket.items.push(a);
  }

  const rangeLabel = formatWeekRange(weekStartKey, timezone);

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Upcoming appointments, week view"
        actions={
          <>
            <LinkButton
              href={`/appointments?week=${todayKey}`}
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
            href={`/appointments?week=${prevWeekKey}`}
            variant="secondary"
            size="sm"
          >
            ← Prev
          </LinkButton>
          <LinkButton
            href={`/appointments?week=${nextWeekKey}`}
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

      {requestedAppointments.length > 0 && (
        <Link
          href={`/appointments/${requestedAppointments[0].id}`}
          className="mb-4 block rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-800 hover:bg-purple-100"
        >
          {requestedAppointments.length} appointment request
          {requestedAppointments.length === 1 ? "" : "s"} waiting for confirmation
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((d) => {
          const isToday = d.key === todayKey;
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
                {dayLabel(d.date, timezone)}
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
                        {timeLabel(a.startsAt, timezone)}
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

function startOfWeekKey(value: string): string {
  const out = new Date(`${value}T12:00:00.000Z`);
  // Monday as the first day of the week
  const dow = out.getUTCDay(); // 0 Sun - 6 Sat
  const diff = (dow + 6) % 7;
  out.setUTCDate(out.getUTCDate() - diff);
  return out.toISOString().slice(0, 10);
}

function calendarDate(value: string, timezone: string): Date {
  return dateInputInTimeZone(value, timezone, new Date(Number.NaN));
}

function dayLabel(d: Date, timezone: string): string {
  return formatInTimeZone(d, timezone, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(d: Date | string, timezone: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return formatInTimeZone(date, timezone, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekRange(startKey: string, timezone: string): string {
  const endKey = shiftCalendarDay(startKey, 6);
  const start = calendarDate(startKey, timezone);
  const end = calendarDate(endKey, timezone);
  const sameMonth =
    formatInTimeZone(start, timezone, { month: "numeric" }) ===
    formatInTimeZone(end, timezone, { month: "numeric" });
  const fmt = (d: Date, withMonth: boolean) =>
    formatInTimeZone(d, timezone, {
      month: withMonth ? "short" : undefined,
      day: "numeric",
    });
  if (sameMonth) {
    return `${fmt(start, true)} – ${fmt(end, false)}`;
  }
  return `${fmt(start, true)} – ${fmt(end, true)}`;
}
