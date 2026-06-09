"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

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
  const amount = parseMoney(fd.get("amount"));
  const category = parseCategory(fd.get("category"));
  const paidAt = parseDate(fd.get("paidAt"));
  const vendor = cleanStr(fd.get("vendor"));
  const reference = cleanStr(fd.get("reference"));
  const method = cleanStr(fd.get("method"));
  const note = cleanStr(fd.get("note"));

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  await db.expense.create({
    data: { orgId, amount, category, paidAt, vendor, reference, method, note },
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function updateExpense(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const amount = parseMoney(fd.get("amount"));
  const category = parseCategory(fd.get("category"));
  const paidAt = parseDate(fd.get("paidAt"));
  const vendor = cleanStr(fd.get("vendor"));
  const reference = cleanStr(fd.get("reference"));
  const method = cleanStr(fd.get("method"));
  const note = cleanStr(fd.get("note"));

  if (amount <= 0) throw new Error("Amount must be greater than zero");

  await db.expense.updateMany({
    where: { id, orgId },
    data: { amount, category, paidAt, vendor, reference, method, note },
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function deleteExpense(id: string) {
  const orgId = await requireOrgId();
  await db.expense.deleteMany({ where: { id, orgId } });
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}
