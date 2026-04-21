"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { decodeVin } from "@/lib/vin";
import type { ColumnMap, LogicalField } from "./fields";

/**
 * Flexible CSV importer.
 * Accepts a columnMap from the UI so it works for any shop-management export.
 */

export async function parseCsvHeaders(
  csvText: string,
): Promise<{ headers: string[]; rowCount: number; sample: Record<string, string>[] }> {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const headers = result.meta.fields ?? [];
  return {
    headers,
    rowCount: result.data.length,
    sample: result.data.slice(0, 3),
  };
}

export async function runImport(
  csvText: string,
  columnMapJson: string,
  options: { decodeVins: boolean },
): Promise<{
  customersCreated: number;
  vehiclesCreated: number;
  skipped: number;
  errors: string[];
}> {
  const columnMap = JSON.parse(columnMapJson) as ColumnMap;
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  let customersCreated = 0;
  let vehiclesCreated = 0;
  let skipped = 0;
  const errors: string[] = [];

  const customerCache = new Map<string, string>(); // dedupe key -> customer.id

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];
    try {
      // Resolve customer fields
      const get = (field: LogicalField) => {
        const src = columnMap[field];
        if (!src) return undefined;
        const v = row[src];
        if (typeof v !== "string") return undefined;
        const t = v.trim();
        return t || undefined;
      };

      let firstName = get("firstName");
      let lastName = get("lastName");
      const full = get("fullName");
      if (full && (!firstName || !lastName)) {
        const parts = full.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = firstName ?? parts[0];
          lastName = lastName ?? parts.slice(1).join(" ");
        } else {
          lastName = lastName ?? full;
          firstName = firstName ?? "";
        }
      }

      if (!firstName && !lastName && !get("companyName")) {
        skipped++;
        continue;
      }

      const customerData = {
        firstName: firstName ?? "",
        lastName: lastName ?? get("companyName") ?? "",
        companyName: get("companyName") ?? null,
        email: get("email") ?? null,
        phone: get("phone") ?? null,
        altPhone: get("altPhone") ?? null,
        street: get("street") ?? null,
        city: get("city") ?? null,
        state: get("state") ?? null,
        zip: get("zip") ?? null,
        notes: get("customerNotes") ?? null,
      };

      // Dedupe by (firstName + lastName + phone) or (email) or (fullName)
      const dedupeKey =
        (customerData.email?.toLowerCase() ||
          `${customerData.firstName.toLowerCase()}|${customerData.lastName.toLowerCase()}|${customerData.phone ?? ""}`) ??
        JSON.stringify(customerData);

      let customerId = customerCache.get(dedupeKey);
      if (!customerId) {
        // Try find existing in DB
        const existing = customerData.email
          ? await db.customer.findFirst({
              where: { email: customerData.email },
            })
          : await db.customer.findFirst({
              where: {
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                phone: customerData.phone,
              },
            });
        if (existing) {
          customerId = existing.id;
        } else {
          const created = await db.customer.create({ data: customerData });
          customerId = created.id;
          customersCreated++;
        }
        customerCache.set(dedupeKey, customerId);
      }

      // Vehicle (optional)
      const vin = get("vin")?.toUpperCase();
      const year = get("year");
      const make = get("make");
      const model = get("model");
      const plate = get("licensePlate")?.toUpperCase();
      if (vin || year || make || model || plate) {
        // Try to avoid dupe by VIN or plate for this customer
        const existingVehicle = vin
          ? await db.vehicle.findFirst({ where: { customerId, vin } })
          : plate
          ? await db.vehicle.findFirst({
              where: { customerId, licensePlate: plate },
            })
          : null;

        if (!existingVehicle) {
          let vehicleData = {
            customerId,
            vin: vin ?? null,
            year: year ? parseInt(year, 10) || null : null,
            make: make ?? null,
            model: model ?? null,
            licensePlate: plate ?? null,
            mileage: get("mileage")
              ? parseInt(get("mileage")!.replace(/[^0-9]/g, ""), 10) || null
              : null,
            notes: get("vehicleNotes") ?? null,
          };

          // Optionally fill gaps from NHTSA
          if (options.decodeVins && vin && vin.length >= 11 && (!vehicleData.make || !vehicleData.year)) {
            try {
              const decoded = await decodeVin(vin);
              vehicleData = {
                ...vehicleData,
                year: vehicleData.year ?? decoded.year ?? null,
                make: vehicleData.make ?? decoded.make ?? null,
                model: vehicleData.model ?? decoded.model ?? null,
              };
            } catch {
              // ignore decode errors; keep raw data
            }
          }

          await db.vehicle.create({ data: vehicleData });
          vehiclesCreated++;
        }
      }
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  revalidatePath("/customers");
  revalidatePath("/vehicles");
  revalidatePath("/");

  return { customersCreated, vehiclesCreated, skipped, errors };
}
