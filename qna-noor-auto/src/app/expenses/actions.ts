"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { createExpenseForOrg } from "@/lib/expenses";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";
import {
  nthOccurrence,
  RECURRING_INTERVALS,
  type RecurringInterval,
} from "@/lib/recurring";

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

function parseCategory(v: FormDataEntryValue | null): string {
  const s = String(v ?? "").trim().toUpperCase();
  return s || "MISC";
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

type ExpenseReceiptInput = {
  id?: string;
  dataUrl: string;
};

const MAX_EXPENSE_RECEIPTS = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;

function parseReceipts(raw: FormDataEntryValue | null): ExpenseReceiptInput[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, MAX_EXPENSE_RECEIPTS).flatMap((item): ExpenseReceiptInput[] => {
    if (!item || typeof item !== "object") return [];
    const dataUrl =
      "dataUrl" in item && typeof item.dataUrl === "string" ? item.dataUrl : "";
    if (
      !dataUrl.startsWith("data:image/") ||
      dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH
    ) {
      return [];
    }
    const id =
      "id" in item && typeof item.id === "string" ? item.id.trim() : undefined;
    return [{ dataUrl, ...(id ? { id } : {}) }];
  });
}

async function syncExpenseReceipts(
  expenseId: string,
  orgId: string,
  receipts: ExpenseReceiptInput[],
) {
  await db.$transaction(async (tx) => {
    const existing = await tx.expenseReceipt.findMany({
      where: { expenseId, orgId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((receipt) => receipt.id));
    const retainedIds = receipts
      .map((receipt) => receipt.id)
      .filter((id): id is string => Boolean(id && existingIds.has(id)));

    await tx.expenseReceipt.deleteMany({
      where: { expenseId, orgId, id: { notIn: retainedIds } },
    });

    const additions = receipts.filter(
      (receipt) => !receipt.id || !existingIds.has(receipt.id),
    );
    if (additions.length > 0) {
      await tx.expenseReceipt.createMany({
        data: additions.map((receipt) => ({
          expenseId,
          orgId,
          dataUrl: receipt.dataUrl,
        })),
      });
    }
  });
}

export async function createExpense(fd: FormData) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const amount = parseMoney(fd.get("amount"));
  const category = parseCategory(fd.get("category"));
  const paidAt = parseDate(fd.get("paidAt"));
  const vendor = cleanStr(fd.get("vendor"));
  const reference = cleanStr(fd.get("reference"));
  const method = cleanStr(fd.get("method"));
  const note = cleanStr(fd.get("note"));
  const interval = parseInterval(fd.get("interval"));
  const startDate = parseDateOnly(fd.get("startDate"), paidAt);
  const endDateValue = cleanStr(fd.get("endDate"));
  const endDate = endDateValue
    ? parseDateOnly(endDateValue, startDate)
    : null;
  const autoPost = String(fd.get("autoPost") ?? "true") !== "false";

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  if (interval !== "ONE_TIME") {
    const recurring = await db.recurringEntry.create({
      data: {
        orgId,
        kind: "EXPENSE",
        amount,
        interval,
        startDate,
        endDate,
        nextRunAt: startDate,
        autoPost,
        category,
        vendor,
        reference,
        method,
        note,
      },
    });
    await logActivity({
      orgId,
      user,
      action: "recurring.create",
      entity: "RecurringEntry",
      entityId: recurring.id,
      summary: `Recurring expense ${formatMoney(amount)} created`,
    });
    revalidatePath("/expenses");
    redirect("/expenses");
  }

  const expense = await createExpenseForOrg(orgId, {
    amount,
    category,
    paidAt,
    vendor,
    reference,
    method,
    note,
  });
  const receipts = parseReceipts(fd.get("receipts"));
  if (receipts.length > 0) {
    await db.expenseReceipt.createMany({
      data: receipts.map((receipt) => ({
        expenseId: expense.id,
        orgId,
        dataUrl: receipt.dataUrl,
      })),
    });
  }
  await logActivity({
    orgId,
    user,
    action: "expense.create",
    entity: "Expense",
    entityId: expense.id,
    summary: `Expense ${formatMoney(amount)} recorded for ${vendor || category}`,
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function updateExpense(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const amount = parseMoney(fd.get("amount"));
  const category = parseCategory(fd.get("category"));
  const paidAt = parseDate(fd.get("paidAt"));
  const vendor = cleanStr(fd.get("vendor"));
  const reference = cleanStr(fd.get("reference"));
  const method = cleanStr(fd.get("method"));
  const note = cleanStr(fd.get("note"));
  const interval = parseInterval(fd.get("interval"));
  const startDate = parseDateOnly(fd.get("startDate"), paidAt);
  const endDateValue = cleanStr(fd.get("endDate"));
  const endDate = endDateValue ? parseDateOnly(endDateValue, startDate) : null;
  const autoPost = String(fd.get("autoPost") ?? "true") !== "false";
  const receipts = parseReceipts(fd.get("receipts"));

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const existing = await db.expense.findFirst({
    where: { id, orgId },
    select: { id: true, recurringId: true },
  });
  if (interval !== "ONE_TIME" && !existing?.recurringId) {
    const created = await db.recurringEntry.create({
      data: {
        orgId,
        kind: "EXPENSE",
        amount,
        interval,
        startDate,
        endDate,
        nextRunAt: nthOccurrence(startDate, interval as RecurringInterval, 1),
        autoPost,
        category,
        vendor,
        reference,
        method,
        note,
      },
    });
    await db.expense.updateMany({
      where: { id, orgId },
      data: { recurringId: created.id },
    });
    await logActivity({
      orgId,
      user,
      action: "recurring.create",
      entity: "RecurringEntry",
      entityId: created.id,
      summary: `Recurring expense ${formatMoney(amount)} created`,
    });
  }
  await db.expense.updateMany({
    where: { id, orgId },
    data: { amount, category, paidAt, vendor, reference, method, note },
  });
  if (existing) {
    await syncExpenseReceipts(id, orgId, receipts);
    await logActivity({
      orgId,
      user,
      action: "expense.update",
      entity: "Expense",
      entityId: existing.id,
      summary: `Expense ${formatMoney(amount)} updated for ${vendor || category}`,
    });
  }
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function deleteExpense(id: string) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const existing = await db.expense.findFirst({
    where: { id, orgId },
    select: { id: true, amount: true, category: true, vendor: true },
  });
  await db.expense.deleteMany({ where: { id, orgId } });
  if (existing) {
    await logActivity({
      orgId,
      user,
      action: "expense.delete",
      entity: "Expense",
      entityId: existing.id,
      summary: `Expense ${formatMoney(existing.amount)} deleted (${existing.vendor || existing.category})`,
    });
  }
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}
