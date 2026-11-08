"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { requireFinancialAccess } from "@/lib/permissions";
import { enabledFeatureSet } from "@/lib/features";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  dateInputInTimeZone,
  dateTimeInputInTimeZone,
} from "@/lib/timezone";
import { createCalendarEventForOrg } from "@/lib/calendar";
import { logActivity } from "@/lib/activity";
import { EXPENSE_CATEGORIES } from "@/app/expenses/categories";
import {
  classifyMoneyRow,
  parseAmount,
  parseFlexibleDate,
  parseFlexibleTime,
} from "@/lib/importParse";
import { decodeVin } from "@/lib/vin";
import { ensureCustomerContactsFromScalarFields } from "@/lib/customerContacts";
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
  const orgId = await requireOrgId();
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
              where: { orgId, email: customerData.email },
            })
          : await db.customer.findFirst({
              where: {
                orgId,
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                phone: customerData.phone,
              },
            });
        if (existing) {
          customerId = existing.id;
        } else {
          const created = await db.customer.create({
            data: { orgId, ...customerData },
          });
          customerId = created.id;
          customersCreated++;
        }
        customerCache.set(dedupeKey, customerId);
      }
      await ensureCustomerContactsFromScalarFields(
        customerId,
        orgId,
        customerData.email,
        customerData.phone,
        customerData.altPhone,
      );

      // Vehicle (optional)
      const vin = get("vin")?.toUpperCase();
      const year = get("year");
      const make = get("make");
      const model = get("model");
      const plate = get("licensePlate")?.toUpperCase();
      const unitNumber = get("unitNumber");
      if (vin || year || make || model || plate || unitNumber) {
        // Try to avoid dupe by VIN or plate for this customer
        const existingVehicle = vin
          ? await db.vehicle.findFirst({ where: { orgId, customerId, vin } })
          : plate
          ? await db.vehicle.findFirst({
              where: { orgId, customerId, licensePlate: plate },
            })
          : null;

        if (!existingVehicle) {
          let vehicleData = {
            orgId,
            customerId,
            vin: vin ?? null,
            year: year ? parseInt(year, 10) || null : null,
            make: make ?? null,
            model: model ?? null,
            licensePlate: plate ?? null,
            unitNumber: unitNumber ?? null,
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

function importColumnMap(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

function importCell(
  row: Record<string, string>,
  columns: Record<string, string>,
  key: string,
): string {
  return row[columns[key] ?? ""]?.trim() ?? "";
}

export async function runMoneyImport(
  csvText: string,
  columnMapJson: string,
): Promise<{
  incomeCreated: number;
  expensesCreated: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}> {
  const user = await requireFinancialAccess();
  if (!enabledFeatureSet(user).has("financials")) {
    throw new Error("Financial imports are not available for this account.");
  }
  const orgId = await requireOrgId();
  const timeZone = await orgTimeZone(orgId);
  const columns = importColumnMap(columnMapJson);
  const rows = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  }).data;
  let incomeCreated = 0;
  let expensesCreated = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2;
    const dateKey = parseFlexibleDate(importCell(row, columns, "date"));
    if (!dateKey) {
      skipped++;
      errors.push(`Row ${rowNumber}: invalid or missing date`);
      continue;
    }
    const classified = classifyMoneyRow({
      amount: parseAmount(importCell(row, columns, "amount")),
      debit: parseAmount(importCell(row, columns, "debit")),
      credit: parseAmount(importCell(row, columns, "credit")),
      type: importCell(row, columns, "type"),
    });
    if (!classified) {
      skipped++;
      errors.push(`Row ${rowNumber}: missing or zero amount`);
      continue;
    }

    const date = dateInputInTimeZone(dateKey, timeZone, new Date(Number.NaN));
    const cents = Math.round(classified.amount * 100);
    if (!Number.isFinite(date.getTime()) || cents <= 0) {
      skipped++;
      errors.push(`Row ${rowNumber}: invalid date or amount`);
      continue;
    }
    const amount = cents / 100;
    const description = importCell(row, columns, "description");
    const note = importCell(row, columns, "note") || null;
    const categoryText = importCell(row, columns, "category");
    const category =
      EXPENSE_CATEGORIES.find(
        (candidate) =>
          candidate.toLowerCase() === categoryText.toLowerCase(),
      ) ?? "MISC";
    const source = description || "Imported";
    const vendor = description || null;
    const identity = [
      classified.kind,
      date.getTime(),
      cents,
      (classified.kind === "income" ? source : vendor ?? "")
        .trim()
        .toLowerCase(),
    ].join("|");

    if (seen.has(identity)) {
      duplicates++;
      continue;
    }

    try {
      const existing =
        classified.kind === "income"
          ? await db.income.findFirst({
              where: { orgId, receivedAt: date, amount, source },
              select: { id: true },
            })
          : await db.expense.findFirst({
              where: { orgId, paidAt: date, amount, vendor },
              select: { id: true },
            });
      if (existing) {
        duplicates++;
        seen.add(identity);
        continue;
      }

      if (classified.kind === "income") {
        await db.income.create({
          data: {
            orgId,
            receivedAt: date,
            amount,
            source,
            frequency: "ONE_TIME",
            note,
          },
        });
        incomeCreated++;
      } else {
        await db.expense.create({
          data: {
            orgId,
            paidAt: date,
            amount,
            category,
            vendor,
            method: null,
            note,
          },
        });
        expensesCreated++;
      }
      seen.add(identity);
    } catch (error) {
      skipped++;
      errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await logActivity({
    orgId,
    user: { id: user.id, username: user.username },
    action: "import.money",
    entity: "Import",
    summary: `Imported ${incomeCreated} income and ${expensesCreated} expenses; skipped ${duplicates} duplicates and ${skipped} invalid rows`,
  });
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/reports");
  return { incomeCreated, expensesCreated, duplicates, skipped, errors };
}

export async function runCalendarImport(
  csvText: string,
  columnMapJson: string,
): Promise<{
  eventsCreated: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}> {
  const orgId = await requireOrgId();
  const user = await requireUser();
  if (!enabledFeatureSet(user).has("schedule")) {
    throw new Error("Calendar imports are not available for this account.");
  }
  const timeZone = await orgTimeZone(orgId);
  const columns = importColumnMap(columnMapJson);
  const rows = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  }).data;
  let eventsCreated = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 2;
    const title = importCell(row, columns, "title");
    const dateKey = parseFlexibleDate(importCell(row, columns, "startDate"));
    if (!title || !dateKey) {
      skipped++;
      errors.push(
        `Row ${rowNumber}: ${!title ? "missing title" : "invalid start date"}`,
      );
      continue;
    }

    const rawStartTime = importCell(row, columns, "startTime");
    const startTime = parseFlexibleTime(rawStartTime);
    const allDayValue = importCell(row, columns, "allDay").toLowerCase();
    const allDay = allDayValue
      ? /^(1|true|yes|y|on|all\s*day)$/i.test(allDayValue)
      : !rawStartTime;
    if (!allDay && rawStartTime && !startTime) {
      skipped++;
      errors.push(`Row ${rowNumber}: invalid start time`);
      continue;
    }

    const startsAt = allDay
      ? dateInputInTimeZone(dateKey, timeZone, new Date(Number.NaN))
      : dateTimeInputInTimeZone(
          dateKey,
          startTime ?? "09:00",
          timeZone,
          new Date(Number.NaN),
        );
    if (!Number.isFinite(startsAt.getTime())) {
      skipped++;
      errors.push(`Row ${rowNumber}: invalid start date or time`);
      continue;
    }

    let endsAt: Date | null = null;
    const rawEndTime = importCell(row, columns, "endTime");
    if (!allDay && rawEndTime) {
      const rawEndDate = importCell(row, columns, "endDate");
      const endDateKey = rawEndDate
        ? parseFlexibleDate(rawEndDate)
        : dateKey;
      const endTime = parseFlexibleTime(rawEndTime);
      if (endDateKey && endTime) {
        const candidate = dateTimeInputInTimeZone(
          endDateKey,
          endTime,
          timeZone,
          new Date(Number.NaN),
        );
        if (candidate > startsAt) endsAt = candidate;
      }
    }

    const identity = `${title}|${startsAt.getTime()}`;
    if (seen.has(identity)) {
      duplicates++;
      continue;
    }
    try {
      const existing = await db.calendarEvent.findFirst({
        where: { orgId, title, startsAt },
        select: { id: true },
      });
      if (existing) {
        duplicates++;
        seen.add(identity);
        continue;
      }
      await createCalendarEventForOrg(orgId, {
        title,
        startsAt,
        endsAt,
        allDay,
        notes: importCell(row, columns, "notes") || null,
      });
      eventsCreated++;
      seen.add(identity);
    } catch (error) {
      skipped++;
      errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await logActivity({
    orgId,
    user: { id: user.id, username: user.username },
    action: "calendar.import",
    entity: "CalendarEvent",
    summary: `Imported ${eventsCreated} calendar events; skipped ${duplicates} duplicates and ${skipped} invalid rows`,
  });
  revalidatePath("/appointments");
  return { eventsCreated, duplicates, skipped, errors };
}
