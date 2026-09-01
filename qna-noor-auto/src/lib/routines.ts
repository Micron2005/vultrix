import { db } from "@/lib/db";
import {
  formatInTimeZone,
  isDateInput,
  localCalendarDay,
  shiftCalendarDay,
} from "@/lib/timezone";

export const ROUTINE_KINDS = ["DAILY", "WEEKDAYS", "WEEKLY", "ONE_OFF"] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export const ROUTINE_WEEKDAYS: Array<[string, string]> = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

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
  title: string;
  kind: string;
  weekdays: string | null;
  day: string | null;
  dueTime: string | null;
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
  note: string | null;
  value: number | null;
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
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day">,
  day: string,
): boolean {
  if (!isDateInput(day)) return false;
  if (routine.kind === "DAILY" || routine.kind === "WEEKLY") return true;
  if (routine.kind === "ONE_OFF") return routine.day === day;
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
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day" | "dueTime">,
  item: Pick<RoutineItemRecord, "dueTime">,
  day: string,
  today: string,
  now: Date,
  timezone: string,
  checkOffs: Pick<RoutineCheckOffRecord, "day" | "late">[],
): "done" | "late" | "missed" | "not_due" {
  if (!dueOn(routine, day)) return "not_due";
  const relevant =
    routine.kind === "WEEKLY"
      ? checkOffs.some((checkOff) => isoWeekKey(checkOff.day) === isoWeekKey(day))
      : checkOffs.some((checkOff) => checkOff.day === day);
  if (relevant) return "done";
  const dueTime = effectiveDueTime(routine, item);
  const passed = deadlinePassed(dueTime, day, today, now, timezone);
  return passed ? (dueTime ? "late" : "missed") : "not_due";
}

export async function loadTodayRoutines(
  orgId: string,
  timezone: string,
  goalId?: string,
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
    where: { orgId, archived: false, ...(goalId ? { goalId } : {}) },
    orderBy: [{ createdAt: "asc" }],
    include: {
      items: { orderBy: { position: "asc" } },
      checkOffs: { where: { day: { gte: shiftCalendarDay(today, -7) } } },
    },
  });
  return routines
    .filter((routine) => dueOn(routine, today))
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
            : checkOffs.find((entry) => entry.day === today) ?? null;
        return {
          ...item,
          status: statusFor(
            routine,
            item,
            today,
            today,
            now,
            timezone,
            checkOffs,
          ),
          checkOff,
        };
      }),
    }))
    .filter(({ items }) => items.some((item) => item.status !== "done"));
}

export function routineLabel(
  routine: Pick<RoutineRecord, "kind" | "weekdays" | "day">,
): string {
  if (routine.kind === "DAILY") return "Every day";
  if (routine.kind === "WEEKLY") return "Weekly";
  if (routine.kind === "ONE_OFF") {
    return routine.day
      ? formatInTimeZone(new Date(`${routine.day}T12:00:00Z`), "UTC", {
          dateStyle: "medium",
        })
      : "One time";
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
