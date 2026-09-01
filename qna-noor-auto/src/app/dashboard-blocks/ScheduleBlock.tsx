import Link from "next/link";
import { Card, CardHeader, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

function ymd(date: Date, timezone: string): string {
  return localCalendarDay(date, timezone);
}

export async function ScheduleBlock({
  orgId,
  timezone,
}: {
  orgId: string;
  timezone: string;
}) {
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
  const events = await db.calendarEvent.findMany({
    where: { orgId, startsAt: { gte: dayStart, lt: weekEnd } },
    orderBy: { startsAt: "asc" },
    take: 8,
  });
  const todayEvents = events.filter(
    (event) => event.startsAt >= dayStart && event.startsAt < dayEnd,
  );
  const upcomingEvents = events.filter((event) => event.startsAt >= dayEnd);

  return (
    <Card className="mb-6">
      <CardHeader title={`Today's schedule (${todayEvents.length})`}>
        <LinkButton href="/appointments" variant="ghost" size="sm">
          Calendar →
        </LinkButton>
        <LinkButton href="/appointments" size="sm">
          + New
        </LinkButton>
      </CardHeader>
      {todayEvents.length > 0 ? (
        <ul className="divide-y divide-zinc-200">
          {todayEvents.map((event) => (
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
      ) : upcomingEvents.length > 0 ? (
        <>
          <div className="px-4 pt-4 text-sm font-medium text-zinc-700">
            Nothing scheduled for today. Coming up this week:
          </div>
          <ul className="divide-y divide-zinc-200">
            {upcomingEvents.map((event) => (
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
      )}
    </Card>
  );
}
