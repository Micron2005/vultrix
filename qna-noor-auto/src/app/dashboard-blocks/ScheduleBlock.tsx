import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import {
  dateInputInTimeZone,
  formatInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";
import type { CurrentUser } from "@/lib/session";
import { fullName, vehicleLabel } from "@/lib/utils";

function ymd(date: Date, timezone: string): string {
  return localCalendarDay(date, timezone);
}

export async function ScheduleBlock({
  orgId,
  timezone,
  accountType,
  hasVehicles,
  window = "today",
  title,
}: {
  orgId: string;
  timezone: string;
  accountType: CurrentUser["accountType"];
  hasVehicles: boolean;
  window?: string;
  title?: string;
}) {
  const personal = accountType === "PERSONAL";
  const today = localCalendarDay(new Date(), timezone);
  const dayStart = dateInputInTimeZone(today, timezone, new Date(Number.NaN));
  const dayEnd = dateInputInTimeZone(
    shiftCalendarDay(today, 1),
    timezone,
    new Date(Number.NaN),
  );
  const weekEnd = dateInputInTimeZone(
    shiftCalendarDay(today, 7),
    timezone,
    new Date(Number.NaN),
  );
  const rangeEnd = window === "week" ? weekEnd : dayEnd;
  const [events, appointments] = await Promise.all([
    personal
      ? db.calendarEvent.findMany({
          where: { orgId, startsAt: { gte: dayStart, lt: rangeEnd } },
          orderBy: { startsAt: "asc" },
          take: 8,
        })
      : Promise.resolve([]),
    personal
      ? Promise.resolve([])
      : db.appointment.findMany({
          where: { orgId, startsAt: { gte: dayStart, lt: rangeEnd } },
          orderBy: { startsAt: "asc" },
          include: { customer: true, vehicle: true },
        }),
  ]);
  const todayEvents = events.filter(
    (event) => event.startsAt >= dayStart && event.startsAt < dayEnd,
  );
  const shownEvents = window === "week" ? events : todayEvents;
  const heading = window === "week" ? "Next 7 days" : "Today's schedule";

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          title ??
          `${heading} (${personal ? shownEvents.length : appointments.length})`
        }
      >
        <LinkButton href="/appointments" variant="ghost" size="sm">
          {personal ? "Calendar →" : "Full week →"}
        </LinkButton>
        <LinkButton href={personal ? "/appointments" : "/appointments/new"} size="sm">
          + New
        </LinkButton>
      </CardHeader>
      {personal ? (
        shownEvents.length > 0 ? (
        <ul className="divide-y divide-zinc-200">
          {shownEvents.map((event) => (
            <li key={event.id}>
              <Link
                href={`/appointments?view=day&date=${ymd(event.startsAt, timezone)}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="text-sm font-semibold text-zinc-900 w-20 shrink-0">
                  {event.allDay
                    ? "All day"
                    : new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(event.startsAt)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {event.title}
                  </div>
                  {event.notes && (
                    <div className="text-xs text-zinc-500 truncate">
                      {event.notes}
                    </div>
                  )}
                </div>
                {event.isReminder && (
                  <span className="text-[10px] uppercase font-semibold rounded bg-amber-100 px-2 py-1 text-amber-800">
                    Reminder
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        ) : window !== "week" && events.some((event) => event.startsAt >= dayEnd) ? (
        <>
          <div className="px-4 pt-4 text-sm font-medium text-zinc-700">
            Nothing scheduled for today. Coming up this week:
          </div>
          <ul className="divide-y divide-zinc-200">
            {events.filter((event) => event.startsAt >= dayEnd).map((event) => (
              <li key={event.id}>
                <Link
                  href={`/appointments?view=day&date=${ymd(event.startsAt, timezone)}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50"
                >
                  <div className="text-xs font-semibold text-zinc-500 w-20 shrink-0">
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }).format(event.startsAt)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {event.title}
                    </div>
                  </div>
                  {event.isReminder && (
                    <span className="text-[10px] uppercase font-semibold rounded bg-amber-100 px-2 py-1 text-amber-800">
                      Reminder
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
        ) : (
        <div className="p-6 text-sm text-zinc-500 text-center">
          Nothing scheduled for today or the rest of this week.
        </div>
        )
      ) : appointments.length === 0 ? (
        <div className="p-6 text-sm text-zinc-500 text-center">
          Nothing scheduled for {window === "week" ? "the next 7 days" : "today"}.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <Link
                href={`/appointments/${appointment.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="w-20 shrink-0 text-sm font-semibold text-zinc-900">
                  {formatInTimeZone(appointment.startsAt, timezone, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900">
                    {appointment.reason}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {fullName(appointment.customer)}
                    {hasVehicles &&
                      appointment.vehicle &&
                      ` · ${vehicleLabel(appointment.vehicle)}`}
                  </div>
                </div>
                <span
                  className={
                    "rounded px-2 py-1 text-[10px] font-semibold uppercase " +
                    appointmentStatusClass(appointment.status)
                  }
                >
                  {prettyAppointmentStatus(appointment.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function appointmentStatusClass(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "bg-zinc-200 text-zinc-800";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800";
    case "ARRIVED":
      return "bg-amber-100 text-amber-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "NO_SHOW":
      return "bg-red-200 text-red-900";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function prettyAppointmentStatus(status: string): string {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
