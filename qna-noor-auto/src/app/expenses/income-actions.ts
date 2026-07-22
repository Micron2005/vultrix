"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";

async function requireIncomeOrgId(): Promise<string> {
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

export async function createIncome(fd: FormData) {
  const orgId = await requireIncomeOrgId();
  const amount = parseMoney(fd.get("amount"));
  const receivedAt = parseDate(fd.get("receivedAt"));
  const source = cleanStr(fd.get("source"));
  const frequency = parseFrequency(fd.get("frequency"));
  const note = cleanStr(fd.get("note"));

  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!source) throw new Error("Source is required");

  await db.income.create({
    data: { orgId, amount, receivedAt, source, frequency, note },
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function updateIncome(id: string, fd: FormData) {
  const orgId = await requireIncomeOrgId();
  const amount = parseMoney(fd.get("amount"));
  const receivedAt = parseDate(fd.get("receivedAt"));
  const source = cleanStr(fd.get("source"));
  const frequency = parseFrequency(fd.get("frequency"));
  const note = cleanStr(fd.get("note"));

  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!source) throw new Error("Source is required");

  await db.income.updateMany({
    where: { id, orgId },
    data: { amount, receivedAt, source, frequency, note },
  });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}

export async function deleteIncome(id: string) {
  const orgId = await requireIncomeOrgId();
  await db.income.deleteMany({ where: { id, orgId } });
  revalidatePath("/expenses");
  revalidatePath("/reports");
  redirect("/expenses");
}
