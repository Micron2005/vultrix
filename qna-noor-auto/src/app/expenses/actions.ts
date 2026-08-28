"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { createExpenseForOrg } from "@/lib/expenses";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";

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

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const expense = await createExpenseForOrg(orgId, {
    amount,
    category,
    paidAt,
    vendor,
    reference,
    method,
    note,
  });
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

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const existing = await db.expense.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  await db.expense.updateMany({
    where: { id, orgId },
    data: { amount, category, paidAt, vendor, reference, method, note },
  });
  if (existing) {
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
