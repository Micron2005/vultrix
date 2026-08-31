"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { createIncomeForOrg } from "@/lib/income";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";
import {
  nthOccurrence,
  RECURRING_INTERVALS,
  type RecurringInterval,
} from "@/lib/recurring";

export async function requireIncomeOrgId(): Promise<string> {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  const features = enabledFeatureSet(user);
  if (!features.has("financials") || features.has("invoices")) {
    throw new Error("Income logging is not available for this account.");
  }
  return user.orgId;
}

function parseMoney(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? ""));
  return isFinite(n) ? n : 0;
}

function cleanStr(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function parseDate(v: FormDataEntryValue | null): Date {
  const s = String(v ?? "").trim();
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseFrequency(v: FormDataEntryValue | null): string {
  const value = String(v ?? "").trim().toUpperCase();
  return ["ONE_TIME", "WEEKLY", "BIWEEKLY", "MONTHLY"].includes(value)
    ? value
    : "ONE_TIME";
}

function parseInterval(v: FormDataEntryValue | null): string {
  const value = String(v ?? "").trim().toUpperCase();
  return value === "ONE_TIME" || RECURRING_INTERVALS.includes(value as RecurringInterval)
    ? value
    : "ONE_TIME";
}

function parseDateOnly(v: FormDataEntryValue | null, fallback: Date): Date {
  const value = String(v ?? "").trim();
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

function frequencyForInterval(interval: string): string {
  return ["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(interval) ? interval : "ONE_TIME";
}

export async function createIncome(fd: FormData) {
  const orgId = await requireIncomeOrgId();
  const user = await requireUser();
  const amount = parseMoney(fd.get("amount"));
  const receivedAt = parseDate(fd.get("receivedAt"));
  const source = cleanStr(fd.get("source"));
  const frequency = parseFrequency(fd.get("frequency"));
  const note = cleanStr(fd.get("note"));
  const interval = parseInterval(fd.get("interval") ?? fd.get("frequency"));
  const startDate = parseDateOnly(fd.get("startDate"), receivedAt);
  const endDateValue = cleanStr(fd.get("endDate"));
  const endDate = endDateValue ? parseDateOnly(endDateValue, startDate) : null;
  const autoPost = String(fd.get("autoPost") ?? "true") !== "false";

  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!source) throw new Error("Source is required");

  if (interval !== "ONE_TIME") {
    const recurring = await db.recurringEntry.create({
      data: {
        orgId,
        kind: "INCOME",
        amount,
        interval,
        startDate,
        endDate,
        nextRunAt: startDate,
        autoPost,
        source,
        note,
      },
    });
    await logActivity({
      orgId,
      user,
      action: "recurring.create",
      entity: "RecurringEntry",
      entityId: recurring.id,
      summary: `Recurring income ${formatMoney(amount)} created`,
    });
    revalidatePath("/expenses");
    redirect("/expenses");
  }

  const income = await createIncomeForOrg(orgId, {
    amount,
    receivedAt,
    source,
    frequency,
    note,
  });
  await logActivity({
    orgId,
    user,
    action: "income.create",
    entity: "Income",
    entityId: income.id,
    summary: `Income ${formatMoney(amount)} recorded from ${source}`,
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function updateIncome(id: string, fd: FormData) {
  const orgId = await requireIncomeOrgId();
  const user = await requireUser();
  const amount = parseMoney(fd.get("amount"));
  const receivedAt = parseDate(fd.get("receivedAt"));
  const source = cleanStr(fd.get("source"));
  const frequency = parseFrequency(fd.get("frequency"));
  const note = cleanStr(fd.get("note"));
  const interval = parseInterval(fd.get("interval") ?? fd.get("frequency"));
  const startDate = parseDateOnly(fd.get("startDate"), receivedAt);
  const endDateValue = cleanStr(fd.get("endDate"));
  const endDate = endDateValue ? parseDateOnly(endDateValue, startDate) : null;
  const autoPost = String(fd.get("autoPost") ?? "true") !== "false";

  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!source) throw new Error("Source is required");

  const existing = await db.income.findFirst({
    where: { id, orgId },
    select: { id: true, recurringId: true, frequency: true },
  });
  if (interval !== "ONE_TIME" && !existing?.recurringId) {
    const created = await db.recurringEntry.create({
      data: {
        orgId,
        kind: "INCOME",
        amount,
        interval,
        startDate,
        endDate,
        nextRunAt: nthOccurrence(startDate, interval as RecurringInterval, 1),
        autoPost,
        source,
        note,
      },
    });
    await db.income.updateMany({
      where: { id, orgId },
      data: { recurringId: created.id },
    });
    await logActivity({
      orgId,
      user,
      action: "recurring.create",
      entity: "RecurringEntry",
      entityId: created.id,
      summary: `Recurring income ${formatMoney(amount)} created`,
    });
  }
  await db.income.updateMany({
    where: { id, orgId },
    data: {
      amount,
      receivedAt,
      source,
      frequency: existing?.recurringId
        ? existing.frequency
        : interval === "ONE_TIME"
          ? frequency
          : frequencyForInterval(interval),
      note,
    },
  });
  if (existing) {
    await logActivity({
      orgId,
      user,
      action: "income.update",
      entity: "Income",
      entityId: existing.id,
      summary: `Income ${formatMoney(amount)} updated from ${source}`,
    });
  }
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function deleteIncome(id: string) {
  const orgId = await requireIncomeOrgId();
  const user = await requireUser();
  const existing = await db.income.findFirst({
    where: { id, orgId },
    select: { id: true, amount: true, source: true },
  });
  await db.income.deleteMany({ where: { id, orgId } });
  if (existing) {
    await logActivity({
      orgId,
      user,
      action: "income.delete",
      entity: "Income",
      entityId: existing.id,
      summary: `Income ${formatMoney(existing.amount)} deleted from ${existing.source}`,
    });
  }
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}
