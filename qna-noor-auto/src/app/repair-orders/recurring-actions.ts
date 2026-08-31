"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { enabledFeatureSet } from "@/lib/features";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanViewFinancials } from "@/lib/permissions";
import {
  issueRecurringOccurrence,
  skipRecurringOccurrence,
} from "@/lib/recurringInvoices";
import { RECURRING_INTERVALS, type RecurringInterval } from "@/lib/recurring";

function text(fd: FormData, key: string): string | null {
  const value = String(fd.get(key) ?? "").trim();
  return value || null;
}

function dateOnly(value: string | null, fallback = new Date()): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function numberValue(value: FormDataEntryValue | undefined, fallback = 0): number {
  const number = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : fallback;
}

function interval(fd: FormData): RecurringInterval {
  const value = String(fd.get("interval") ?? "").toUpperCase();
  return RECURRING_INTERVALS.includes(value as RecurringInterval)
    ? (value as RecurringInterval)
    : "MONTHLY";
}

function parseLines(fd: FormData) {
  const kinds = fd.getAll("lineKind").map(String);
  const descriptions = fd.getAll("lineDescription").map(String);
  const quantities = fd.getAll("lineQuantity");
  const prices = fd.getAll("lineUnitPrice");
  const partNumbers = fd.getAll("linePartNumber").map(String);
  return kinds.flatMap((kind, index) => {
    const description = descriptions[index]?.trim() ?? "";
    if (!description) return [];
    if (kind !== "LABOR" && kind !== "PART" && kind !== "FEE") return [];
    return [{
      kind,
      description,
      quantity: numberValue(quantities[index], 1),
      unitPrice: numberValue(prices[index]),
      partNumber: kind === "PART" ? partNumbers[index]?.trim() || null : null,
      sortOrder: index,
    }];
  });
}

async function access() {
  const orgId = await requireOrgId();
  const user = await requireUser();
  assertCanViewFinancials(user.role);
  if (!enabledFeatureSet(user).has("invoices")) redirect("/repair-orders");
  return { orgId, user };
}

async function validateReferences(
  orgId: string,
  customerId: string,
  vehicleId: string | null,
) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (vehicleId) {
    const vehicle = await db.vehicle.findFirst({
      where: { id: vehicleId, customerId, orgId },
      select: { id: true },
    });
    if (!vehicle) throw new Error("Vehicle not found");
  }
}

function parsedData(fd: FormData) {
  const customerId = text(fd, "customerId");
  if (!customerId) throw new Error("Customer is required");
  const startDate = dateOnly(text(fd, "startDate"));
  const endValue = text(fd, "endDate");
  const endDate = endValue ? dateOnly(endValue) : null;
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("End date must be on or after the start date");
  }
  const taxRate = numberValue(fd.get("taxRate") ?? undefined);
  const discount = numberValue(fd.get("discount") ?? undefined);
  if (taxRate < 0 || discount < 0) throw new Error("Tax and discount cannot be negative");
  return {
    customerId,
    vehicleId: text(fd, "vehicleId"),
    interval: interval(fd),
    startDate,
    endDate,
    nextRunAt: startDate,
    autoPost: text(fd, "autoPost") !== "false",
    taxRate,
    discount,
    label: text(fd, "label"),
    notes: text(fd, "notes"),
    lines: parseLines(fd),
  };
}

export async function createRecurringInvoice(fd: FormData) {
  const { orgId, user } = await access();
  const data = parsedData(fd);
  await validateReferences(orgId, data.customerId, data.vehicleId);
  const series = await db.recurringInvoice.create({
    data: {
      orgId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      interval: data.interval,
      startDate: data.startDate,
      endDate: data.endDate,
      nextRunAt: data.nextRunAt,
      autoPost: data.autoPost,
      taxRate: data.taxRate,
      discount: data.discount,
      label: data.label,
      notes: data.notes,
      lines: { create: data.lines },
    },
  });
  await logActivity({
    orgId,
    user,
    action: "recurring_invoice.create",
    entity: "RecurringInvoice",
    entityId: series.id,
    summary: `Recurring invoice series created${data.label ? `: ${data.label}` : ""}`,
  });
  revalidatePath("/repair-orders");
  revalidatePath("/repair-orders/recurring");
  redirect("/repair-orders/recurring");
}

export async function updateRecurringInvoice(id: string, fd: FormData) {
  const { orgId, user } = await access();
  const existing = await db.recurringInvoice.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      interval: true,
      startDate: true,
      nextRunAt: true,
    },
  });
  if (!existing) redirect("/repair-orders/recurring");
  const data = parsedData(fd);
  await validateReferences(orgId, data.customerId, data.vehicleId);
  const scheduleChanged =
    existing.interval !== data.interval ||
    existing.startDate.getTime() !== data.startDate.getTime();
  await db.$transaction(async (tx) => {
    await tx.recurringInvoiceLine.deleteMany({ where: { recurringInvoiceId: id } });
    await tx.recurringInvoice.update({
      where: { id },
      data: {
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        interval: data.interval,
        startDate: data.startDate,
        endDate: data.endDate,
        nextRunAt: scheduleChanged ? data.nextRunAt : existing.nextRunAt,
        autoPost: data.autoPost,
        taxRate: data.taxRate,
        discount: data.discount,
        label: data.label,
        notes: data.notes,
        lines: { create: data.lines },
      },
    });
  });
  await logActivity({
    orgId,
    user,
    action: "recurring_invoice.update",
    entity: "RecurringInvoice",
    entityId: id,
    summary: "Recurring invoice series updated; issued invoices preserved",
  });
  revalidatePath("/repair-orders/recurring");
  redirect("/repair-orders/recurring");
}

export async function toggleRecurringInvoice(fd: FormData) {
  const { orgId, user } = await access();
  const id = text(fd, "id");
  if (!id) return;
  const series = await db.recurringInvoice.findFirst({ where: { id, orgId } });
  if (!series) return;
  await db.recurringInvoice.updateMany({
    where: { id, orgId },
    data: { active: !series.active },
  });
  await logActivity({
    orgId,
    user,
    action: "recurring_invoice.toggle",
    entity: "RecurringInvoice",
    entityId: id,
    summary: `Recurring invoice series ${series.active ? "paused" : "resumed"}`,
  });
  revalidatePath("/repair-orders/recurring");
}

export async function deleteRecurringInvoice(fd: FormData) {
  const { orgId, user } = await access();
  const id = text(fd, "id");
  if (!id) return;
  const series = await db.recurringInvoice.findFirst({ where: { id, orgId } });
  if (!series) return;
  await db.recurringInvoice.delete({ where: { id } });
  await logActivity({
    orgId,
    user,
    action: "recurring_invoice.delete",
    entity: "RecurringInvoice",
    entityId: id,
    summary: "Recurring invoice series deleted; issued invoices preserved",
  });
  revalidatePath("/repair-orders/recurring");
  revalidatePath("/repair-orders");
}

function occurrenceFrom(fd: FormData): Date {
  const value = String(fd.get("occurrence") ?? "");
  const occurrence = new Date(value);
  if (Number.isNaN(occurrence.getTime())) throw new Error("Invalid occurrence");
  return occurrence;
}

export async function issueRecurringInvoiceOccurrence(fd: FormData) {
  const { orgId } = await access();
  const id = text(fd, "recurringId");
  if (!id) return;
  const issued = await issueRecurringOccurrence(orgId, id, occurrenceFrom(fd));
  revalidatePath("/repair-orders/recurring");
  revalidatePath("/repair-orders");
  if (!issued) redirect("/repair-orders/recurring?error=stale_occurrence");
}

export async function skipRecurringInvoiceOccurrence(fd: FormData) {
  const { orgId } = await access();
  const id = text(fd, "recurringId");
  if (!id) return;
  const skipped = await skipRecurringOccurrence(orgId, id, occurrenceFrom(fd));
  revalidatePath("/repair-orders/recurring");
  if (!skipped) redirect("/repair-orders/recurring?error=stale_occurrence");
}
