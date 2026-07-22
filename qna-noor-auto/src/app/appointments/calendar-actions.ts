"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

const CalendarEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  allDay: z.string().optional(),
  isReminder: z.string().optional(),
  notes: z.string().optional(),
});

function eventData(fd: FormData) {
  const raw = CalendarEventSchema.parse(Object.fromEntries(fd.entries()));
  const startsAt = raw.allDay
    ? new Date(`${raw.date}T00:00:00`)
    : new Date(`${raw.date}T${raw.startTime || "09:00"}`);
  const endsAt = raw.endTime
    ? new Date(`${raw.date}T${raw.endTime}`)
    : null;
  if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
    throw new Error("Invalid date or time");
  }
  if (endsAt && endsAt <= startsAt) throw new Error("End time must be after start time");
  return {
    title: raw.title,
    startsAt,
    endsAt,
    allDay: raw.allDay === "on",
    isReminder: raw.isReminder === "on",
    notes: raw.notes?.trim() || null,
  };
}

export async function createCalendarEvent(fd: FormData) {
  const orgId = await requireOrgId();
  await db.calendarEvent.create({ data: { ...eventData(fd), orgId } });
  revalidatePath("/appointments");
}

export async function updateCalendarEvent(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  await db.calendarEvent.updateMany({ where: { id, orgId }, data: eventData(fd) });
  revalidatePath("/appointments");
}

export async function deleteCalendarEvent(id: string) {
  const orgId = await requireOrgId();
  await db.calendarEvent.deleteMany({ where: { id, orgId } });
  revalidatePath("/appointments");
}
