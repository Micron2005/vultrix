"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifyOrgIntake } from "@/lib/intakeTokens";
import { getNextRoNumber, getSetting } from "@/lib/shop";
import { parseMileage } from "@/lib/utils";
import {
  MAX_INTAKE_PHOTOS,
  MAX_INTAKE_DATAURL_BYTES,
} from "./[orgId]/intake-photo-constants";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function orNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

/** Build a next-step URL that always carries the org id + signed token. */
function step(
  orgId: string,
  k: string,
  params: Record<string, string>,
): string {
  const usp = new URLSearchParams({ k, ...params });
  return `/i/${orgId}?${usp.toString()}`;
}

export async function createIntakeCustomer(fd: FormData) {
  const orgId = str(fd, "orgId");
  const k = str(fd, "k");
  if (!verifyOrgIntake(orgId, k)) redirect(`/i/${orgId}`);

  const firstName = str(fd, "firstName");
  const lastName = str(fd, "lastName");
  const phone = str(fd, "phone");
  const email = str(fd, "email");
  const street = str(fd, "street");
  const city = str(fd, "city");
  const state = str(fd, "state");
  const zip = str(fd, "zip");

  if (
    !firstName ||
    !lastName ||
    !phone ||
    !email ||
    !street ||
    !city ||
    !state ||
    !zip
  ) {
    redirect(step(orgId, k, { mode: "new", error: "required" }));
  }

  const created = await db.customer.create({
    data: {
      orgId,
      type: "INDIVIDUAL",
      firstName,
      lastName,
      phone,
      email,
      street,
      city,
      state,
      zip,
    },
    select: { id: true },
  });

  revalidatePath("/customers");
  redirect(step(orgId, k, { customerId: created.id }));
}

export async function createIntakeVehicle(fd: FormData) {
  const orgId = str(fd, "orgId");
  const k = str(fd, "k");
  const customerId = str(fd, "customerId");
  if (!verifyOrgIntake(orgId, k)) redirect(`/i/${orgId}`);

  // Make sure the customer belongs to this org.
  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId },
    select: { id: true },
  });
  if (!customer) redirect(step(orgId, k, {}));

  // Existing vehicle picked from the list?
  const existingVehicleId = str(fd, "vehicleId");
  if (existingVehicleId) {
    const owned = await db.vehicle.findFirst({
      where: { id: existingVehicleId, orgId, customerId },
      select: { id: true },
    });
    if (!owned) redirect(step(orgId, k, { customerId }));
    redirect(step(orgId, k, { customerId, vehicleId: existingVehicleId }));
  }

  const make = str(fd, "make");
  const model = str(fd, "model");
  if (!make || !model) {
    redirect(step(orgId, k, { customerId, error: "vehicle" }));
  }

  const yearStr = str(fd, "year");
  const yearNum = yearStr ? parseInt(yearStr, 10) : NaN;
  const vin = orNull(fd, "vin");
  const plate = orNull(fd, "licensePlate");
  const lstate = orNull(fd, "licenseState");

  const created = await db.vehicle.create({
    data: {
      orgId,
      customerId,
      vin: vin ? vin.toUpperCase() : null,
      year: Number.isFinite(yearNum) ? yearNum : null,
      make,
      model,
      trim: orNull(fd, "trim"),
      engine: orNull(fd, "engine"),
      color: orNull(fd, "color"),
      licensePlate: plate ? plate.toUpperCase() : null,
      licenseState: lstate ? lstate.toUpperCase() : null,
      mileage: parseMileage(str(fd, "mileage")),
    },
    select: { id: true },
  });

  revalidatePath("/vehicles");
  redirect(step(orgId, k, { customerId, vehicleId: created.id }));
}

export async function createIntakeRO(fd: FormData) {
  const orgId = str(fd, "orgId");
  const k = str(fd, "k");
  const customerId = str(fd, "customerId");
  const vehicleId = str(fd, "vehicleId");
  if (!verifyOrgIntake(orgId, k)) redirect(`/i/${orgId}`);

  // Validate the full ownership chain before creating anything.
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, orgId, customerId },
    select: { id: true },
  });
  if (!vehicle) redirect(step(orgId, k, { customerId }));

  const complaint = str(fd, "complaint");
  if (!complaint) {
    redirect(step(orgId, k, { customerId, vehicleId, error: "required" }));
  }

  const mileageIn = parseMileage(str(fd, "mileage"));
  const roNumber = await getNextRoNumber(orgId);
  const defaultTax = parseFloat(await getSetting(orgId, "defaultTaxRate")) || 0;

  const ro = await db.repairOrder.create({
    data: {
      roNumber,
      orgId,
      customerId,
      vehicleId,
      complaint,
      mileageIn,
      taxRate: defaultTax,
      status: "ESTIMATE",
    },
    select: { id: true },
  });

  // Best-effort: attach any photos the customer added. A bad photo payload must
  // never block ticket creation, so this is wrapped and silently tolerant.
  try {
    const raw = str(fd, "photos");
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rows = parsed
          .filter(
            (u): u is string =>
              typeof u === "string" &&
              u.startsWith("data:image/") &&
              u.length <= MAX_INTAKE_DATAURL_BYTES,
          )
          .slice(0, MAX_INTAKE_PHOTOS)
          .map((dataUrl, i) => ({
            repairOrderId: ro.id,
            orgId,
            dataUrl,
            sortOrder: i,
          }));
        if (rows.length > 0) {
          await db.repairOrderPhoto.createMany({ data: rows });
        }
      }
    }
  } catch {
    /* ignore malformed photo payloads */
  }

  if (mileageIn !== null) {
    await db.vehicle.update({
      where: { id: vehicleId, orgId },
      data: { mileage: mileageIn },
    });
  }

  revalidatePath("/repair-orders");
  revalidatePath("/");
  redirect(step(orgId, k, { done: String(roNumber) }));
}
