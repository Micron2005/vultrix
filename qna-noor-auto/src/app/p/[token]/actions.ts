"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  dateTimeInputInTimeZone,
  isDateInput,
  localCalendarDay,
  formatInTimeZone,
} from "@/lib/timezone";
import { getAllSettings } from "@/lib/shop";
import { sendEmail, escapeHtml } from "@/lib/email";
import { fullName, vehicleLabel } from "@/lib/utils";
import { siteOrigin } from "@/lib/reminders";

const RequestAppointmentSchema = z.object({
  token: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  date: z.string().refine(isDateInput, "Enter a valid date."),
  time: z.enum(["09:00", "12:00", "15:00"]),
  reason: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function requestAppointment(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const invalid = () => redirect(`/p/${encodeURIComponent(token)}?requesterror=1`);
  const parsed = RequestAppointmentSchema.safeParse({
    token,
    vehicleId: String(fd.get("vehicleId") ?? "").trim() || null,
    date: String(fd.get("date") ?? ""),
    time: String(fd.get("time") ?? ""),
    reason: String(fd.get("reason") ?? ""),
    notes: String(fd.get("notes") ?? "").trim() || null,
  });
  if (!parsed.success) return invalid();
  const data = parsed.data;

  const customer = await db.customer.findUnique({
    where: { portalToken: data.token },
    include: {
      vehicles: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          trim: true,
          licensePlate: true,
          unitNumber: true,
        },
      },
    },
  });
  if (!customer) notFound();

  const timezone = await orgTimeZone(customer.orgId);
  if (data.date < localCalendarDay(new Date(), timezone)) return invalid();
  const startsAt = dateTimeInputInTimeZone(
    data.date,
    data.time,
    timezone,
  );
  if (Number.isNaN(startsAt.getTime())) return invalid();

  const vehicle = data.vehicleId
    ? customer.vehicles.find((item) => item.id === data.vehicleId)
    : null;
  if (data.vehicleId && !vehicle) return invalid();

  const appointment = await db.appointment.create({
    data: {
      orgId: customer.orgId,
      customerId: customer.id,
      vehicleId: vehicle?.id ?? null,
      startsAt,
      durationMinutes: 60,
      reason: data.reason,
      notes: data.notes || null,
      status: "REQUESTED",
    },
  });

  const shop = await getAllSettings(customer.orgId);
  if (shop.shopEmail) {
    const when = formatInTimeZone(startsAt, timezone, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const vehicleText = vehicle ? vehicleLabel(vehicle) : "Not specified";
    const appUrl = `${siteOrigin() ?? "https://vultrix.net"}/appointments/${appointment.id}`;
    await sendEmail({
      to: shop.shopEmail,
      subject: `Appointment request from ${fullName(customer)}`,
      html: `
        <p>A customer submitted an appointment request.</p>
        <p><strong>Name:</strong> ${escapeHtml(fullName(customer))}<br>
        <strong>Phone:</strong> ${escapeHtml(customer.phone ?? "Not provided")}<br>
        <strong>Email:</strong> ${escapeHtml(customer.email ?? "Not provided")}<br>
        <strong>Vehicle:</strong> ${escapeHtml(vehicleText)}<br>
        <strong>Requested:</strong> ${escapeHtml(when)}<br>
        <strong>Reason:</strong> ${escapeHtml(data.reason)}<br>
        <strong>Notes:</strong> ${escapeHtml(data.notes || "None")}</p>
        <p><a href="${escapeHtml(appUrl)}">Open appointment in Vultrix</a></p>
      `,
      replyTo: customer.email ?? undefined,
    });
  }

  revalidatePath("/appointments");
  redirect(`/p/${encodeURIComponent(data.token)}?requested=1`);
}
