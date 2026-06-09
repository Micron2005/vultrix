"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { getSetting } from "@/lib/shop";
import { APPOINTMENT_STATUSES } from "./constants";

const AppointmentSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  vehicleId: z.string().optional().nullable(),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  durationMinutes: z.string().optional().nullable(),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

function toData(fd: FormData) {
  const raw = AppointmentSchema.parse(Object.fromEntries(fd.entries()));
  // Combine date + time (local) into a Date instance. SQLite stores as UTC.
  // We pass the wall-clock into new Date() as a local-time string.
  const dt = new Date(`${raw.date}T${raw.time}`);
  if (Number.isNaN(dt.getTime())) {
    throw new Error("Invalid date/time");
  }
  const duration = raw.durationMinutes
    ? Math.max(5, parseInt(String(raw.durationMinutes), 10) || 60)
    : 60;
  const vehicleId = raw.vehicleId?.trim() || null;
  const status =
    raw.status && APPOINTMENT_STATUSES.includes(raw.status as never)
      ? raw.status
      : "SCHEDULED";
  return {
    customerId: raw.customerId,
    vehicleId,
    startsAt: dt,
    durationMinutes: duration,
    reason: raw.reason.trim(),
    notes: raw.notes?.trim() || null,
    status,
  };
}

export async function createAppointment(fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);
  // Guard: customer (and vehicle, if any) must belong to this org.
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, orgId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (data.vehicleId) {
    const vehicle = await db.vehicle.findFirst({
      where: { id: data.vehicleId, orgId },
      select: { id: true },
    });
    if (!vehicle) throw new Error("Vehicle not found");
  }
  const created = await db.appointment.create({ data: { ...data, orgId } });
  revalidatePath("/appointments");
  revalidatePath("/");
  redirect(`/appointments/${created.id}`);
}

export async function updateAppointment(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const data = toData(fd);
  await db.appointment.updateMany({ where: { id, orgId }, data });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/");
  redirect(`/appointments/${id}`);
}

export async function deleteAppointment(id: string) {
  const orgId = await requireOrgId();
  await db.appointment.deleteMany({ where: { id, orgId } });
  revalidatePath("/appointments");
  revalidatePath("/");
  redirect("/appointments");
}

export async function setAppointmentStatus(id: string, status: string) {
  const orgId = await requireOrgId();
  if (!APPOINTMENT_STATUSES.includes(status as never)) return;
  await db.appointment.updateMany({ where: { id, orgId }, data: { status } });
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/");
}

// Converts the appointment into a new Repair Order in ESTIMATE state.
// Carries customer, vehicle, and reason → complaint.
// Marks the appointment as ARRIVED and links it to the new RO.
export async function startRoFromAppointment(id: string) {
  const orgId = await requireOrgId();
  const appt = await db.appointment.findFirst({
    where: { id, orgId },
    include: { customer: true, vehicle: true },
  });
  if (!appt) throw new Error("Appointment not found");
  if (!appt.vehicleId) {
    // Cannot create an RO without a vehicle — guard this at UI too.
    throw new Error("Appointment has no vehicle — edit it and pick one first.");
  }

  // Next RO number
  const last = await db.repairOrder.findFirst({
    where: { orgId },
    orderBy: { roNumber: "desc" },
    select: { roNumber: true },
  });
  const nextNo = (last?.roNumber ?? 1000) + 1;

  const taxRateStr = await getSetting(orgId, "defaultTaxRate");
  const taxRate = taxRateStr ? parseFloat(taxRateStr) || 0 : 0;

  const ro = await db.repairOrder.create({
    data: {
      orgId,
      roNumber: nextNo,
      customerId: appt.customerId,
      vehicleId: appt.vehicleId,
      status: "ESTIMATE",
      complaint: appt.reason + (appt.notes ? `\n\n${appt.notes}` : ""),
      mileageIn: appt.vehicle?.mileage ?? null,
      taxRate,
    },
  });

  await db.appointment.update({
    where: { id, orgId },
    data: {
      status: "ARRIVED",
      repairOrderId: ro.id,
    },
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(`/repair-orders/${ro.id}`);
}
