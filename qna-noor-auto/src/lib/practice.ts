import { db } from "@/lib/db";
import {
  dateInputInTimeZone,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

export type PracticeDay = {
  day: string;
  minutes: number;
};

export type PracticeWeekSummary = {
  totalMinutes: number;
  sessionCount: number;
  currentStreak: number;
  days: PracticeDay[];
};

function dayOfWeek(day: string): number {
  return new Date(`${day}T12:00:00.000Z`).getUTCDay();
}

function dayStart(day: string, timezone: string): Date {
  return dateInputInTimeZone(day, timezone, new Date(Number.NaN));
}

function dayEnd(day: string, timezone: string): Date {
  return new Date(
    dayStart(shiftCalendarDay(day, 1), timezone).getTime() - 1,
  );
}

export async function listPracticeSessions(orgId: string) {
  return db.practiceSession.findMany({
    where: { orgId },
    orderBy: { startedAt: "desc" },
    include: { song: { select: { id: true, title: true } } },
  });
}

export async function loadPracticeWeekSummary(
  orgId: string,
  timezone: string,
  now = new Date(),
): Promise<PracticeWeekSummary> {
  const today = localCalendarDay(now, timezone);
  const weekStart = shiftCalendarDay(today, -dayOfWeek(today));
  const sessions = await db.practiceSession.findMany({
    where: {
      orgId,
      startedAt: {
        gte: dayStart(shiftCalendarDay(today, -400), timezone),
        lte: dayEnd(shiftCalendarDay(today, 6 - dayOfWeek(today)), timezone),
      },
    },
    select: { startedAt: true, durationSec: true },
  });
  const byDay = new Map<string, number>();
  for (const session of sessions) {
    const day = localCalendarDay(session.startedAt, timezone);
    byDay.set(day, (byDay.get(day) ?? 0) + session.durationSec);
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = shiftCalendarDay(weekStart, index);
    return { day, minutes: Math.round((byDay.get(day) ?? 0) / 60) };
  });
  const weekSessions = sessions.filter((session) => {
    const day = localCalendarDay(session.startedAt, timezone);
    return day >= weekStart && day <= shiftCalendarDay(weekStart, 6);
  });
  let currentStreak = 0;
  let cursor =
    byDay.has(today) ? today : byDay.has(shiftCalendarDay(today, -1)) ? shiftCalendarDay(today, -1) : null;
  while (cursor && byDay.has(cursor)) {
    currentStreak += 1;
    cursor = shiftCalendarDay(cursor, -1);
  }
  return {
    totalMinutes: Math.round(
      weekSessions.reduce((sum, session) => sum + session.durationSec, 0) / 60,
    ),
    sessionCount: weekSessions.length,
    currentStreak,
    days,
  };
}
