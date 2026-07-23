import { db } from "@/lib/db";

export type CalendarEventInput = {
  title: string;
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  isReminder?: boolean;
  notes?: string | null;
};

export async function createCalendarEventForOrg(
  orgId: string,
  input: CalendarEventInput,
) {
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new Error("End time must be after start time.");
  }
  return db.calendarEvent.create({
    data: {
      ...input,
      title: input.title.trim(),
      allDay: input.allDay ?? false,
      isReminder: input.isReminder ?? false,
      notes: input.notes?.trim() || null,
      orgId,
    },
  });
}

export async function deleteCalendarEventForOrg(orgId: string, eventId: string) {
  return db.calendarEvent.deleteMany({
    where: { id: eventId, orgId },
  });
}
