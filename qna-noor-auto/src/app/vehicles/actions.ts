"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseMileage } from "@/lib/utils";
import { decodeVin, type VinDecodeResult } from "@/lib/vin";

const VehicleSchema = z.object({
  customerId: z.string().min(1),
  vin: z.string().optional().nullable(),
  year: z.string().optional().nullable(),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  trim: z.string().optional().nullable(),
  engine: z.string().optional().nullable(),
  transmission: z.string().optional().nullable(),
  drivetrain: z.string().optional().nullable(),
  bodyStyle: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  licensePlate: z.string().optional().nullable(),
  licenseState: z.string().optional().nullable(),
  mileage: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function prepare(fd: FormData) {
  const obj = Object.fromEntries(fd.entries()) as Record<string, string>;
  const cleaned: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(obj)) cleaned[k] = v === "" ? null : v;
  const parsed = VehicleSchema.parse(cleaned);
  return {
    customerId: parsed.customerId,
    vin: parsed.vin?.toUpperCase() ?? null,
    year: parsed.year ? parseInt(parsed.year, 10) || null : null,
    make: parsed.make ?? null,
    model: parsed.model ?? null,
    trim: parsed.trim ?? null,
    engine: parsed.engine ?? null,
    transmission: parsed.transmission ?? null,
    drivetrain: parsed.drivetrain ?? null,
    bodyStyle: parsed.bodyStyle ?? null,
    color: parsed.color ?? null,
    licensePlate: parsed.licensePlate?.toUpperCase() ?? null,
    licenseState: parsed.licenseState?.toUpperCase() ?? null,
    mileage: parseMileage(parsed.mileage),
    notes: parsed.notes ?? null,
  };
}

export async function createVehicle(fd: FormData) {
  const data = prepare(fd);
  const created = await db.vehicle.create({ data });
  revalidatePath(`/customers/${data.customerId}`);
  revalidatePath("/vehicles");
  revalidatePath("/");
  redirect(`/vehicles/${created.id}`);
}

export async function updateVehicle(id: string, fd: FormData) {
  const data = prepare(fd);
  await db.vehicle.update({ where: { id }, data });
  revalidatePath(`/vehicles/${id}`);
  revalidatePath(`/customers/${data.customerId}`);
  redirect(`/vehicles/${id}`);
}

export async function deleteVehicle(id: string) {
  const v = await db.vehicle.findUnique({ where: { id } });
  if (!v) return;
  await db.vehicle.delete({ where: { id } });
  revalidatePath(`/customers/${v.customerId}`);
  revalidatePath("/vehicles");
  redirect(`/customers/${v.customerId}`);
}

export async function decodeVinAction(
  vin: string,
): Promise<VinDecodeResult> {
  return decodeVin(vin);
}
