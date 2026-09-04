"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCanViewFinancials } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { isDateInput, localCalendarDay, shiftCalendarDay } from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";
import { parseDecimal } from "@/lib/utils";
import {
  deadlinePassed,
  effectiveDueTime,
  isoWeekKey,
  ROUTINE_KINDS,
  dueOn,
} from "@/lib/routines";

async function requireRoutinesViewer() {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  return {
    user,
    orgId: user.orgId,
    timezone: await orgTimeZone(user.orgId),
  };
}

async function requireRoutinesManager() {
  const context = await requireRoutinesViewer();
  assertCanViewFinancials(context.user.role);
  return context;
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function redirectRoutineError(path: string, error: unknown): never {
  const message =
    error instanceof Error ? error.message : "Could not save routine.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function optionalNumber(fd: FormData, key: string): number | null {
  const value = text(fd, key);
  if (!value) return null;
  const parsed = parseDecimal(value);
  if (parsed == null) throw new Error(`${key} must be a valid number.`);
  return parsed;
}

function optionalInt(fd: FormData, key: string, minimum: number): number | null {
  const value = text(fd, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= minimum ? rounded : null;
}

function parseRoutineItem(line: string) {
  const match = line.match(/(?:\s*[x×](\d+))?(?:\s+rest\s+(\d+)\s*s?)?$/i);
  const label = line.slice(0, match?.index ?? line.length).trim() || line;
  const sets = match?.[1] ? Number(match[1]) : null;
  const restSeconds = match?.[2] ? Number(match[2]) : null;
  return {
    label,
    sets: sets != null && sets >= 1 ? sets : null,
    restSeconds: restSeconds != null && restSeconds >= 5 ? restSeconds : null,
  };
}

function timeValue(value: string): string | null {
  if (!value) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Due time is invalid.");
  }
  return value;
}

function routineInput(fd: FormData) {
  const title = text(fd, "title");
  const kind = text(fd, "kind");
  const weekdays = Array.from(new Set(fd.getAll("weekdays").map(String)))
    .filter((value) => /^[0-6]$/.test(value))
    .sort()
    .join(",");
  const day = text(fd, "day") || null;
  const dueTime = timeValue(text(fd, "dueTime"));
  const endDay = text(fd, "endDay") || null;
  const showStreak = text(fd, "showStreak") === "on";
  const goalId = text(fd, "goalId") || null;
  const assigneeUserId = text(fd, "assigneeUserId") || null;
  const items = text(fd, "items")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseRoutineItem);
  if (!title) throw new Error("Routine name is required.");
  if (!ROUTINE_KINDS.includes(kind as (typeof ROUTINE_KINDS)[number])) {
    throw new Error("Routine type is invalid.");
  }
  if (kind === "WEEKDAYS" && !weekdays) {
    throw new Error("Choose at least one weekday.");
  }
  if (
    (kind === "ONE_OFF" || kind === "REMINDER") &&
    (!day || !isDateInput(day))
  ) {
    throw new Error("A valid date is required.");
  }
  if (endDay && !isDateInput(endDay)) throw new Error("End date is invalid.");
  return {
    title,
    kind,
    weekdays: kind === "WEEKDAYS" ? weekdays : null,
    day: kind === "ONE_OFF" || kind === "REMINDER" ? day : null,
    dueTime,
    endDay: kind === "DAILY" || kind === "WEEKDAYS" || kind === "WEEKLY" ? endDay : null,
    showStreak,
    goalId,
    assigneeUserId,
    items:
      kind === "REMINDER" || items.length === 0
        ? [{ label: title, sets: null, restSeconds: null }]
        : items,
  };
}

async function goalForOrg(orgId: string, goalId: string | null) {
  if (!goalId) return null;
  const goal = await db.goal.findFirst({
    where: { id: goalId, orgId, archived: false },
    select: { id: true },
  });
  if (!goal) throw new Error("Goal not found.");
  return goal;
}

async function userForOrg(orgId: string, userId: string | null) {
  if (!userId) return null;
  const user = await db.user.findFirst({
    where: { id: userId, orgId, isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("Assignee not found.");
  return user;
}

function assertCanActOnRoutine(
  user: Awaited<ReturnType<typeof requireUser>>,
  assigneeUserId: string | null,
) {
  if (user.role === "STAFF" && assigneeUserId && assigneeUserId !== user.id) {
    throw new Error("You don't have permission to do that");
  }
}

function revalidateRoutine(id?: string, goalId?: string | null) {
  revalidatePath("/goals/routines");
  revalidatePath("/goals/routines/[id]");
  if (id) revalidatePath(`/goals/routines/${id}`);
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function createRoutine(fd: FormData) {
  const { user, orgId, timezone } = await requireRoutinesManager();
  let input: ReturnType<typeof routineInput>;
  try {
    input = routineInput(fd);
    const today = localCalendarDay(new Date(), timezone);
    if (input.endDay && input.endDay < today) {
      throw new Error("End date must be today or later.");
    }
    await goalForOrg(orgId, input.goalId);
    await userForOrg(orgId, input.assigneeUserId);
  } catch (error) {
    redirectRoutineError("/goals", error);
  }
  const routine = await db.routine.create({
    data: {
      orgId,
      title: input.title,
      kind: input.kind,
      weekdays: input.weekdays,
      day: input.day,
      dueTime: input.dueTime,
      endDay: input.endDay,
      showStreak: input.showStreak,
      goalId: input.goalId,
      assigneeUserId: input.assigneeUserId,
      items: {
        create: input.items.map((item, position) => ({
          orgId,
          label: item.label,
          sets: item.sets,
          restSeconds: item.restSeconds,
          position,
        })),
      },
    },
  });
  await logActivity({
    orgId,
    user,
    action: "routine.create",
    entity: "Routine",
    entityId: routine.id,
    summary: `Routine created: ${routine.title}`,
  });
  revalidateRoutine(routine.id, input.goalId);
  redirect(`/goals/routines/${routine.id}`);
}

export async function updateRoutine(id: string, fd: FormData) {
  const { user, orgId, timezone } = await requireRoutinesManager();
  let input: ReturnType<typeof routineInput>;
  try {
    input = routineInput(fd);
    const today = localCalendarDay(new Date(), timezone);
    if (input.endDay && input.endDay < today) {
      throw new Error("End date must be today or later.");
    }
    await goalForOrg(orgId, input.goalId);
    await userForOrg(orgId, input.assigneeUserId);
  } catch (error) {
    redirectRoutineError(`/goals/routines/${id}`, error);
  }
  const result = await db.routine.updateMany({
    where: { id, orgId },
    data: {
      title: input.title,
      kind: input.kind,
      weekdays: input.weekdays,
      day: input.day,
      dueTime: input.dueTime,
      endDay: input.endDay,
      showStreak: input.showStreak,
      goalId: input.goalId,
      assigneeUserId: input.assigneeUserId,
    },
  });
  if (!result.count) throw new Error("Routine not found.");
  await logActivity({
    orgId,
    user,
    action: "routine.update",
    entity: "Routine",
    entityId: id,
    summary: `Routine updated: ${input.title}`,
  });
  revalidateRoutine(id, input.goalId);
  redirect(`/goals/routines/${id}`);
}

export async function archiveRoutine(fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const id = text(fd, "id");
  const routine = await db.routine.findFirst({
    where: { id, orgId },
    select: { id: true, goalId: true },
  });
  if (!routine) throw new Error("Routine not found.");
  const result = await db.routine.updateMany({
    where: { id, orgId },
    data: { archived: true },
  });
  if (!result.count) throw new Error("Routine not found.");
  await logActivity({
    orgId,
    user,
    action: "routine.archive",
    entity: "Routine",
    entityId: id,
    summary: "Routine archived",
  });
  revalidateRoutine(id, routine.goalId);
}

export async function restoreRoutine(fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const id = text(fd, "id");
  const routine = await db.routine.findFirst({
    where: { id, orgId },
    select: { id: true, goalId: true },
  });
  if (!routine) throw new Error("Routine not found.");
  const result = await db.routine.updateMany({
    where: { id, orgId },
    data: { archived: false },
  });
  if (!result.count) throw new Error("Routine not found.");
  await logActivity({
    orgId,
    user,
    action: "routine.restore",
    entity: "Routine",
    entityId: id,
    summary: "Routine restored",
  });
  revalidateRoutine(id, routine.goalId);
}

export async function deleteRoutine(fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const id = text(fd, "id");
  const routine = await db.routine.findFirst({
    where: { id, orgId },
    select: { id: true, title: true, goalId: true },
  });
  if (!routine) throw new Error("Routine not found.");
  await db.routine.delete({ where: { id: routine.id } });
  await logActivity({
    orgId,
    user,
    action: "routine.delete",
    entity: "Routine",
    entityId: id,
    summary: `Routine deleted: ${routine.title}`,
  });
  revalidateRoutine(id, routine.goalId);
  redirect("/goals/routines");
}

async function routineForItem(orgId: string, itemId: string) {
  const item = await db.routineItem.findFirst({
    where: { id: itemId, orgId },
    include: { routine: true },
  });
  if (!item) throw new Error("Routine item not found.");
  return item;
}

async function updateSingleDayCompletion(
  routineId: string,
  orgId: string,
  routineDay: string | null,
) {
  if (!routineDay) return;
  const routine = await db.routine.findFirst({
    where: { id: routineId, orgId },
    select: { kind: true, day: true },
  });
  if (
    !routine ||
    (routine.kind !== "ONE_OFF" && routine.kind !== "REMINDER") ||
    !routine.day
  ) {
    return;
  }
  const [items, checkOffs] = await Promise.all([
    db.routineItem.findMany({
      where: { routineId, orgId },
      select: { id: true },
    }),
    db.routineCheckOff.findMany({
      where: { routineId, orgId, day: routine.day },
      select: { itemId: true, skipped: true },
    }),
  ]);
  const complete =
    items.length > 0 &&
    items.every((item) =>
      checkOffs.some(
        (checkOff) => checkOff.itemId === item.id,
      ),
    );
  await db.routine.update({
    where: { id: routineId },
    data: complete
      ? { completedDay: routine.day, archived: true }
      : { completedDay: null, archived: false },
  });
}

function itemInput(fd: FormData) {
  const label = text(fd, "label");
  if (!label) throw new Error("Item name is required.");
  return {
    label,
    target: optionalNumber(fd, "target"),
    unit: text(fd, "unit") || null,
    sets: optionalInt(fd, "sets", 1),
    restSeconds: optionalInt(fd, "restSeconds", 5),
    dueTime: timeValue(text(fd, "dueTime")),
  };
}

export async function addRoutineItem(routineId: string, fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const routine = await db.routine.findFirst({ where: { id: routineId, orgId } });
  if (!routine) throw new Error("Routine not found.");
  const input = itemInput(fd);
  const last = await db.routineItem.aggregate({
    where: { routineId, orgId },
    _max: { position: true },
  });
  const item = await db.routineItem.create({
    data: {
      routineId,
      orgId,
      position: (last._max.position ?? -1) + 1,
      ...input,
    },
  });
  await logActivity({
    orgId,
    user,
    action: "routine.item_create",
    entity: "RoutineItem",
    entityId: item.id,
    summary: `Routine item added: ${item.label}`,
  });
  revalidateRoutine(routineId, routine.goalId);
}

export async function updateRoutineItem(itemId: string, fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const item = await routineForItem(orgId, itemId);
  const input = itemInput(fd);
  await db.routineItem.update({ where: { id: itemId }, data: input });
  await logActivity({
    orgId,
    user,
    action: "routine.item_update",
    entity: "RoutineItem",
    entityId: itemId,
    summary: `Routine item updated: ${input.label}`,
  });
  revalidateRoutine(item.routineId, item.routine.goalId);
}

export async function deleteRoutineItem(fd: FormData) {
  const { user, orgId } = await requireRoutinesManager();
  const itemId = text(fd, "id");
  const item = await routineForItem(orgId, itemId);
  await db.routineItem.delete({ where: { id: itemId } });
  await logActivity({
    orgId,
    user,
    action: "routine.item_delete",
    entity: "RoutineItem",
    entityId: itemId,
    summary: `Routine item deleted: ${item.label}`,
  });
  revalidateRoutine(item.routineId, item.routine.goalId);
}

export async function moveRoutineItem(itemId: string, direction: "up" | "down") {
  const { orgId } = await requireRoutinesManager();
  const item = await routineForItem(orgId, itemId);
  const items = await db.routineItem.findMany({
    where: { routineId: item.routineId, orgId },
    orderBy: { position: "asc" },
  });
  const index = items.findIndex((candidate) => candidate.id === itemId);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
  await db.$transaction([
    db.routineItem.update({
      where: { id: items[index].id },
      data: { position: items[nextIndex].position },
    }),
    db.routineItem.update({
      where: { id: items[nextIndex].id },
      data: { position: items[index].position },
    }),
  ]);
  revalidateRoutine(item.routineId, item.routine.goalId);
}

export async function toggleRoutineCheckOff(
  itemId: string,
  day: string,
  note?: string | FormData,
  value?: number | string | null,
) {
  const { user, orgId, timezone } = await requireRoutinesViewer();
  if (!isDateInput(day)) throw new Error("Check-off date is invalid.");
  const item = await routineForItem(orgId, itemId);
  const routine = item.routine;
  assertCanActOnRoutine(user, routine.assigneeUserId);
  if (!dueOn(routine, day)) throw new Error("That item is not due on this day.");
  let submittedNote = typeof note === "string" ? note : "";
  let submittedValue: number | string | null | undefined = value;
  if (note instanceof FormData) {
    submittedNote = String(note.get("note") ?? "");
    submittedValue = note.get("value") as string | null;
  }
  const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay() || 7;
  const weekStart = shiftCalendarDay(day, 1 - weekday);
  const weekEnd = shiftCalendarDay(weekStart, 6);
  const existing = await db.routineCheckOff.findMany({
    where: {
      itemId,
      orgId,
      ...(routine.kind === "WEEKLY"
        ? { day: { gte: weekStart, lte: weekEnd } }
        : { day }),
    },
    orderBy: { day: "desc" },
  });
  const current =
    routine.kind === "WEEKLY"
      ? existing.find((entry) => isoWeekKey(entry.day) === isoWeekKey(day))
      : existing[0];
  if (current) {
    await db.routineCheckOff.delete({ where: { id: current.id } });
    await logActivity({
      orgId,
      user,
      action: "routine.check_off_delete",
      entity: "RoutineCheckOff",
      entityId: current.id,
      summary: `Routine item unchecked: ${item.label}`,
    });
  } else {
    const today = localCalendarDay(new Date(), timezone);
    const dueTime = effectiveDueTime(routine, item);
    const late =
      Boolean(dueTime) &&
      deadlinePassed(dueTime, day, today, new Date(), timezone);
    const parsedValue =
      submittedValue == null || String(submittedValue).trim() === ""
        ? null
        : parseDecimal(String(submittedValue));
    if (
      submittedValue != null &&
      String(submittedValue).trim() &&
      parsedValue == null
    ) {
      throw new Error("Value must be a valid number.");
    }
    const checkOff = await db.routineCheckOff.create({
      data: {
        itemId,
        routineId: routine.id,
        orgId,
        day,
        late,
        userId: user.id,
        note: submittedNote.trim() || null,
        value: parsedValue,
      },
    });
    await logActivity({
      orgId,
      user,
      action: "routine.check_off",
      entity: "RoutineCheckOff",
      entityId: checkOff.id,
      summary: `Routine item checked off: ${item.label}`,
    });
  }
  await updateSingleDayCompletion(routine.id, orgId, routine.day);
  revalidateRoutine(routine.id, routine.goalId);
}

export async function skipRoutineDay(itemId: string, day: string) {
  const { user, orgId, timezone } = await requireRoutinesViewer();
  if (!isDateInput(day)) throw new Error("Check-off date is invalid.");
  const item = await routineForItem(orgId, itemId);
  const routine = item.routine;
  assertCanActOnRoutine(user, routine.assigneeUserId);
  if (routine.kind === "ONE_OFF" || !dueOn(routine, day)) {
    throw new Error("That item cannot be skipped on this day.");
  }
  const existing = await db.routineCheckOff.findUnique({
    where: { itemId_day: { itemId, day } },
  });
  if (existing?.skipped) {
    await db.routineCheckOff.delete({ where: { id: existing.id } });
  } else {
    const today = localCalendarDay(new Date(), timezone);
    await db.routineCheckOff.upsert({
      where: { itemId_day: { itemId, day } },
      update: { skipped: true, userId: user.id },
      create: {
        itemId,
        routineId: routine.id,
        orgId,
        day,
        late: day < today,
        skipped: true,
        userId: user.id,
      },
    });
  }
  await logActivity({
    orgId,
    user,
    action: "routine.skip",
    entity: "RoutineCheckOff",
    entityId: existing?.id ?? itemId,
    summary: `Routine item skipped: ${item.label}`,
  });
  await updateSingleDayCompletion(routine.id, orgId, routine.day);
  revalidateRoutine(routine.id, routine.goalId);
}

export async function snoozeRoutine(fd: FormData) {
  const { user, orgId } = await requireRoutinesViewer();
  const id = text(fd, "id");
  const routine = await db.routine.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      kind: true,
      day: true,
      goalId: true,
      assigneeUserId: true,
    },
  });
  if (!routine) throw new Error("Routine not found.");
  assertCanActOnRoutine(user, routine.assigneeUserId);
  if (
    (routine.kind !== "ONE_OFF" && routine.kind !== "REMINDER") ||
    !routine.day
  ) {
    throw new Error("Only one-time routines can be snoozed.");
  }
  const day = shiftCalendarDay(routine.day, 1);
  await db.routine.update({
    where: { id: routine.id },
    data: { day, completedDay: null, archived: false },
  });
  await logActivity({
    orgId,
    user,
    action: "routine.snooze",
    entity: "Routine",
    entityId: routine.id,
    summary: `Routine snoozed until ${day}`,
  });
  revalidateRoutine(routine.id, routine.goalId);
}

export async function setCheckOffNote(fd: FormData) {
  const { user, orgId } = await requireRoutinesViewer();
  const id = text(fd, "id");
  const checkOff = await db.routineCheckOff.findFirst({
    where: { id, orgId },
    include: { routine: true },
  });
  if (!checkOff) throw new Error("Check-off not found.");
  assertCanActOnRoutine(user, checkOff.routine.assigneeUserId);
  await db.routineCheckOff.update({
    where: { id },
    data: { note: text(fd, "note") || null },
  });
  revalidateRoutine(checkOff.routineId, checkOff.routine.goalId);
}
