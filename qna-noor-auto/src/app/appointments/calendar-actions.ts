"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanDelete } from "@/lib/permissions";
import { createCalendarEventForOrg } from "@/lib/calendar";
import {
  dateInputInTimeZone,
  dateTimeInputInTimeZone,
} from "@/lib/timezone";
import { orgTimeZone } from "@/lib/orgTimezone";

const CalendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.string().optional(),
  isReminder: z.string().optional(),
  notes: z.string().optional(),
});

function eventData(fd: FormData, timeZone: string) {
  const raw = CalendarEventSchema.parse(Object.fromEntries(fd.entries()));
  const allDay = raw.allDay === "on";
  const startsAt = allDay
    ? dateInputInTimeZone(raw.date, timeZone, new Date(Number.NaN))
    : dateTimeInputInTimeZone(
        raw.date,
        raw.startTime || "09:00",
        timeZone,
      );
  const endsAt =
    !allDay && raw.endTime
      ? dateTimeInputInTimeZone(raw.date, raw.endTime, timeZone)
      : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    throw new Error("Invalid date or time");
  }
  if (endsAt && endsAt <= startsAt) throw new Error("End time must be after start time");
  return {
    title: raw.title,
    startsAt,
    endsAt,
    allDay,
    isReminder: raw.isReminder === "on",
    notes: raw.notes?.trim() || null,
  };
}

export async function createCalendarEvent(fd: FormData) {
  const orgId = await requireOrgId();
  const timeZone = await orgTimeZone(orgId);
  await createCalendarEventForOrg(orgId, eventData(fd, timeZone));
  revalidatePath("/appointments");
}

export async function updateCalendarEvent(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const timeZone = await orgTimeZone(orgId);
  await db.calendarEvent.updateMany({
    where: { id, orgId },
    data: eventData(fd, timeZone),
  });
  revalidatePath("/appointments");
}

export async function deleteCalendarEvent(id: string) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  assertCanDelete(user.role);
  await db.calendarEvent.deleteMany({ where: { id, orgId } });
  revalidatePath("/appointments");
}
