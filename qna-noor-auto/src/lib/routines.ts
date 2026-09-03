import { db } from "@/lib/db";
import {
  formatInTimeZone,
  isDateInput,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

export const ROUTINE_KINDS = [
  "DAILY",
  "WEEKDAYS",
  "WEEKLY",
  "ONE_OFF",
  "REMINDER",
] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export { ROUTINE_WEEKDAYS } from "@/lib/routineConstants";

export type RoutineItemRecord = {
  id: string;
  routineId: string;
  orgId: string;
  label: string;
  target: number | null;
  unit: string | null;
  dueTime: string | null;
  position: number;
  createdAt: Date;
};

export type RoutineRecord = {
  id: string;
  orgId: string;
  goalId: string | null;
  assigneeUserId: string | null;
  assignee?: { id: string; username: string } | null;
  title: string;
  kind: string;
  weekdays: string | null;
  day: string | null;
  dueTime: string | null;
  endDay: string | null;
  showStreak: boolean;
  completedDay: string | null;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: RoutineItemRecord[];
};

export type RoutineCheckOffRecord = {
  id: string;
  itemId: string;
  routineId: string;
  orgId: string;
  day: string;
  late: boolean;
  skipped: boolean;
  note: string | null;
  value: number | null;
  user?: { username: string } | null;
  createdAt: Date;
};

function weekday(day: string): number {
  return new Date(`${day}T12:00:00.000Z`).getUTCDay();
}

export function isoWeekKey(day: string): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-${Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )}`;
}

export function dueOn(
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day" | "endDay">,
  day: string,
): boolean {
  if (!isDateInput(day)) return false;
  if (routine.endDay && day > routine.endDay) return false;
  if (routine.kind === "DAILY" || routine.kind === "WEEKLY") return true;
  if (routine.kind === "ONE_OFF" || routine.kind === "REMINDER") {
    return routine.day === day;
  }
  const selected = (routine.weekdays ?? "")
    .split(",")
    .map(Number)
    .filter((value) => Number.isInteger(value));
  return selected.includes(weekday(day));
}

export function effectiveDueTime(
  routine: Pick<RoutineRecord, "dueTime">,
  item: Pick<RoutineItemRecord, "dueTime">,
): string | null {
  return item.dueTime ?? routine.dueTime;
}

function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0);
}

export function deadlinePassed(
  dueTime: string | null,
  day: string,
  today: string,
  now: Date,
  timezone: string,
): boolean {
  if (!dueTime) return day < today;
  if (day < today) return true;
  if (day > today) return false;
  const [hour, minute] = dueTime.split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute)
    ? localMinutes(now, timezone) > hour * 60 + minute
    : false;
}

export function statusFor(
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day" | "dueTime" | "endDay">,
  item: Pick<RoutineItemRecord, "dueTime">,
  day: string,
  today: string,
  now: Date,
  timezone: string,
  checkOffs: Pick<RoutineCheckOffRecord, "day" | "late" | "skipped">[],
): "done" | "skipped" | "late" | "missed" | "not_due" {
  if (!dueOn(routine, day)) return "not_due";
  const checkOff = routine.kind === "WEEKLY"
    ? checkOffs.find((entry) => isoWeekKey(entry.day) === isoWeekKey(day))
    : checkOffs.find((entry) => entry.day === day);
  if (checkOff?.skipped) return "skipped";
  if (checkOff) return "done";
  const dueTime = effectiveDueTime(routine, item);
  const passed = deadlinePassed(dueTime, day, today, now, timezone);
  return passed ? (dueTime ? "late" : "missed") : "not_due";
}

export async function loadTodayRoutines(
  orgId: string,
  timezone: string,
  opts: { goalId?: string; forUserId?: string } = {},
): Promise<
  Array<{
    routine: RoutineRecord;
    items: Array<
      RoutineItemRecord & {
        status: ReturnType<typeof statusFor>;
        checkOff: RoutineCheckOffRecord | null;
      }
    >;
  }>
> {
  const now = new Date();
  const today = localCalendarDay(now, timezone);
  const routines = await db.routine.findMany({
    where: {
      orgId,
      archived: false,
      ...(opts.goalId ? { goalId: opts.goalId } : {}),
      ...(opts.forUserId
        ? {
            OR: [{ assigneeUserId: null }, { assigneeUserId: opts.forUserId }],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      items: { orderBy: { position: "asc" } },
      checkOffs: {
        where: { day: { gte: shiftCalendarDay(today, -400) } },
        include: { user: { select: { username: true } } },
      },
      assignee: { select: { id: true, username: true } },
    },
  });
  return routines
    .filter(
      (routine) =>
        dueOn(routine, today) ||
        ((routine.kind === "ONE_OFF" || routine.kind === "REMINDER") &&
          routine.day !== null &&
          routine.day < today &&
          routine.completedDay === null),
    )
    .map((routine) => ({
      routine,
      items: routine.items.map((item) => {
        const checkOffs = routine.checkOffs.filter(
          (checkOff) => checkOff.itemId === item.id,
        );
        const checkOff =
          routine.kind === "WEEKLY"
            ? checkOffs.find(
                (entry) => isoWeekKey(entry.day) === isoWeekKey(today),
              ) ?? null
            : checkOffs.find(
                (entry) =>
                  entry.day ===
                  (routine.day && routine.day < today ? routine.day : today),
              ) ?? null;
        return {
          ...item,
          status: statusFor(
            routine,
            item,
            routine.day && routine.day < today ? routine.day : today,
            today,
            now,
            timezone,
            checkOffs,
          ),
          checkOff,
        };
      }),
    }))
    .filter(({ items }) => items.some((item) => item.status !== "done" && item.status !== "skipped"));
}

export async function loadTeamToday(
  orgId: string,
  timezone: string,
): Promise<
  Array<{
    userId: string;
    username: string;
    role: string;
    done: number;
    total: number;
  }>
> {
  const now = new Date();
  const today = localCalendarDay(now, timezone);
  const [users, routines] = await Promise.all([
    db.user.findMany({
      where: { orgId, isActive: true, role: { not: "SUPERADMIN" } },
      select: { id: true, username: true, role: true },
      orderBy: { username: "asc" },
    }),
    db.routine.findMany({
      where: { orgId, archived: false, assigneeUserId: { not: null } },
      include: {
        items: { orderBy: { position: "asc" } },
        checkOffs: { where: { day: { gte: shiftCalendarDay(today, -7) } } },
      },
    }),
  ]);
  const totals = new Map(
    users.map((user) => [
      user.id,
      { userId: user.id, username: user.username, role: user.role, done: 0, total: 0 },
    ]),
  );
  for (const routine of routines) {
    if (!routine.assigneeUserId || !dueOn(routine, today)) continue;
    const total = totals.get(routine.assigneeUserId);
    if (!total) continue;
    for (const item of routine.items) {
      total.total += 1;
      const status = statusFor(
        routine,
        item,
        today,
        today,
        now,
        timezone,
        routine.checkOffs.filter((checkOff) => checkOff.itemId === item.id),
      );
      if (status === "done" || status === "skipped") total.done += 1;
    }
  }
  return users.map((user) => totals.get(user.id)!);
}

export function routineLabel(
  routine: Pick<
    RoutineRecord,
    "kind" | "weekdays" | "day" | "dueTime" | "endDay"
  >,
): string {
  if (routine.kind === "DAILY") {
    return routine.endDay
      ? `Every day until ${formatInTimeZone(
          new Date(`${routine.endDay}T12:00:00Z`),
          "UTC",
          { month: "short", day: "numeric" },
        )}`
      : "Every day";
  }
  if (routine.kind === "WEEKLY") return "Weekly";
  if (routine.kind === "ONE_OFF" || routine.kind === "REMINDER") {
    const date = routine.day
      ? formatInTimeZone(new Date(`${routine.day}T12:00:00Z`), "UTC", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "unscheduled";
    return routine.kind === "REMINDER"
      ? `Reminder · ${date}${routine.dueTime ? ` ${formatTime(routine.dueTime)}` : ""}`
      : `Once · ${date}`;
  }
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    (routine.weekdays ?? "")
      .split(",")
      .map(Number)
      .filter(Number.isInteger)
      .map((day) => names[day])
      .join(", ") || "Selected weekdays"
  );
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function routineStreak(
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day" | "endDay">,
  items: Array<Pick<RoutineItemRecord, "id">>,
  checkOffs: Array<Pick<RoutineCheckOffRecord, "itemId" | "day" | "skipped">>,
  today: string,
  createdDay: string,
): number {
  if (items.length === 0 || !isDateInput(today) || !isDateInput(createdDay)) {
    return 0;
  }
  const statusForDay = (day: string) =>
    items.map((item) =>
      checkOffs.find(
        (checkOff) =>
          checkOff.itemId === item.id &&
          (routine.kind === "WEEKLY"
            ? isoWeekKey(checkOff.day) === isoWeekKey(day)
            : checkOff.day === day),
      ),
    );
  const completeDay = (day: string) => {
    const statuses = statusForDay(day);
    return {
      complete: statuses.every(Boolean),
      skipped: statuses.some((status) => status?.skipped),
    };
  };
  const todayStatus = completeDay(today);
  let day = todayStatus.complete && !todayStatus.skipped
    ? today
    : shiftCalendarDay(today, -1);
  let streak = 0;
  let iterations = 0;
  while (isDateInput(day) && day >= createdDay && iterations < 1000) {
    iterations += 1;
    if (routine.kind === "WEEKLY") {
      const status = completeDay(day);
      if (!status.complete) break;
      if (!status.skipped) streak += 1;
      day = shiftCalendarDay(day, -7);
      continue;
    }
    if (!dueOn(routine, day)) {
      day = shiftCalendarDay(day, -1);
      continue;
    }
    const status = completeDay(day);
    if (!status.complete) break;
    if (!status.skipped) streak += 1;
    day = shiftCalendarDay(day, -1);
  }
  return streak;
}
