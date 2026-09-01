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

async function requireRoutinesContext() {
  const user = await requireUser();
  assertCanViewFinancials(user.role);
  if (!user.orgId) redirect("/admin");
  return {
    user,
    orgId: user.orgId,
    timezone: await orgTimeZone(user.orgId),
  };
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function optionalNumber(fd: FormData, key: string): number | null {
  const value = text(fd, key);
  if (!value) return null;
  const parsed = parseDecimal(value);
  if (parsed == null) throw new Error(`${key} must be a valid number.`);
  return parsed;
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
  const goalId = text(fd, "goalId") || null;
  if (!title) throw new Error("Routine name is required.");
  if (!ROUTINE_KINDS.includes(kind as (typeof ROUTINE_KINDS)[number])) {
    throw new Error("Routine type is invalid.");
  }
  if (kind === "WEEKDAYS" && !weekdays) {
    throw new Error("Choose at least one weekday.");
  }
  if (kind === "ONE_OFF" && (!day || !isDateInput(day))) {
    throw new Error("A valid date is required.");
  }
  return {
    title,
    kind,
    weekdays: kind === "WEEKDAYS" ? weekdays : null,
    day: kind === "ONE_OFF" ? day : null,
    dueTime,
    goalId,
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

function revalidateRoutine(id?: string, goalId?: string | null) {
  revalidatePath("/goals/routines");
  if (id) revalidatePath(`/goals/routines/${id}`);
  revalidatePath("/goals");
  if (goalId) revalidatePath(`/goals/${goalId}`);
  revalidatePath("/");
}

export async function createRoutine(fd: FormData) {
  const { user, orgId } = await requireRoutinesContext();
  const input = routineInput(fd);
  await goalForOrg(orgId, input.goalId);
  const routine = await db.routine.create({ data: { orgId, ...input } });
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
  const { user, orgId } = await requireRoutinesContext();
  const input = routineInput(fd);
  await goalForOrg(orgId, input.goalId);
  const result = await db.routine.updateMany({
    where: { id, orgId },
    data: input,
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
  const { user, orgId } = await requireRoutinesContext();
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
  const { user, orgId } = await requireRoutinesContext();
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
  const { user, orgId } = await requireRoutinesContext();
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

function itemInput(fd: FormData) {
  const label = text(fd, "label");
  if (!label) throw new Error("Item name is required.");
  return {
    label,
    target: optionalNumber(fd, "target"),
    unit: text(fd, "unit") || null,
    dueTime: timeValue(text(fd, "dueTime")),
  };
}

export async function addRoutineItem(routineId: string, fd: FormData) {
  const { user, orgId } = await requireRoutinesContext();
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
  const { user, orgId } = await requireRoutinesContext();
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
  const { user, orgId } = await requireRoutinesContext();
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
  const { orgId } = await requireRoutinesContext();
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
  const { user, orgId, timezone } = await requireRoutinesContext();
  if (!isDateInput(day)) throw new Error("Check-off date is invalid.");
  const item = await routineForItem(orgId, itemId);
  const routine = item.routine;
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
  revalidateRoutine(routine.id, routine.goalId);
}

export async function setCheckOffNote(fd: FormData) {
  const { orgId } = await requireRoutinesContext();
  const id = text(fd, "id");
  const checkOff = await db.routineCheckOff.findFirst({
    where: { id, orgId },
    include: { routine: true },
  });
  if (!checkOff) throw new Error("Check-off not found.");
  await db.routineCheckOff.update({
    where: { id },
    data: { note: text(fd, "note") || null },
  });
  revalidateRoutine(checkOff.routineId, checkOff.routine.goalId);
}
