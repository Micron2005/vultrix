"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";
import { requireOrgId } from "@/lib/session";
import { requireIncomeOrgId } from "./income-actions";
import {
  postConfirmedOccurrence,
  skipConfirmedOccurrence,
  getDueConfirmOccurrences,
  RECURRING_INTERVALS,
  type RecurringInterval,
} from "@/lib/recurring";

function text(fd: FormData, name: string): string | null {
  const value = String(fd.get(name) ?? "").trim();
  return value || null;
}

function money(fd: FormData): number {
  const value = Number.parseFloat(String(fd.get("amount") ?? ""));
  return Number.isFinite(value) ? value : 0;
}

function dateOnly(value: string | null, fallback = new Date()): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function interval(fd: FormData): RecurringInterval {
  const value = String(fd.get("interval") ?? "").trim().toUpperCase();
  return RECURRING_INTERVALS.includes(value as RecurringInterval)
    ? (value as RecurringInterval)
    : "MONTHLY";
}

function recurringData(fd: FormData) {
  const kind = text(fd, "kind") === "INCOME" ? "INCOME" : "EXPENSE";
  const amount = money(fd);
  const startDate = dateOnly(text(fd, "startDate"));
  const endDate = dateOnly(text(fd, "endDate"), startDate);
  const hasEndDate = Boolean(text(fd, "endDate"));
  return {
    kind,
    amount,
    interval: interval(fd),
    startDate,
    endDate: hasEndDate ? endDate : null,
    nextRunAt: startDate,
    autoPost: text(fd, "autoPost") !== "false",
    category: text(fd, "category"),
    vendor: text(fd, "vendor"),
    method: text(fd, "method"),
    reference: text(fd, "reference"),
    source: text(fd, "source"),
    note: text(fd, "note"),
  };
}

async function authorizeKind(orgId: string, kind: string) {
  if (kind === "INCOME") await requireIncomeOrgId();
  return orgId;
}

export async function createRecurring(fd: FormData) {
  const orgId = await requireOrgId();
  const data = recurringData(fd);
  await authorizeKind(orgId, data.kind);
  if (data.amount <= 0) throw new Error("Amount must be greater than zero");
  if (data.kind === "INCOME" && !data.source) throw new Error("Source is required");
  if (data.kind === "EXPENSE" && !data.category) data.category = "MISC";

  const series = await db.recurringEntry.create({ data: { ...data, orgId } });
  await logActivity({
    orgId,
    user: null,
    action: "recurring.create",
    entity: "RecurringEntry",
    entityId: series.id,
    summary: `Repeating ${data.kind.toLowerCase()} ${formatMoney(data.amount)} created`,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function updateRecurring(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const existing = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!existing) redirect("/expenses");
  await authorizeKind(orgId, existing.kind);
  const data = recurringData(fd);
  if (data.amount <= 0) throw new Error("Amount must be greater than zero");
  if (data.kind !== existing.kind) data.kind = existing.kind;
  if (data.kind === "INCOME" && !data.source) throw new Error("Source is required");
  if (data.kind === "EXPENSE" && !data.category) data.category = "MISC";
  await db.recurringEntry.updateMany({ where: { id, orgId }, data });
  await logActivity({
    orgId,
    user: null,
    action: "recurring.update",
    entity: "RecurringEntry",
    entityId: id,
    summary: `Repeating ${data.kind.toLowerCase()} updated`,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function toggleRecurring(fd: FormData) {
  const orgId = await requireOrgId();
  const id = text(fd, "id");
  if (!id) return;
  const existing = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!existing) return;
  await authorizeKind(orgId, existing.kind);
  await db.recurringEntry.updateMany({
    where: { id, orgId },
    data: { active: !existing.active },
  });
  await logActivity({
    orgId,
    user: null,
    action: "recurring.pause",
    entity: "RecurringEntry",
    entityId: id,
    summary: `Repeating ${existing.kind.toLowerCase()} ${existing.active ? "paused" : "resumed"}`,
  });
  revalidatePath("/expenses");
}

export async function deleteRecurring(fd: FormData) {
  const orgId = await requireOrgId();
  const id = text(fd, "id");
  if (!id) return;
  const existing = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!existing) return;
  await authorizeKind(orgId, existing.kind);
  await db.recurringEntry.deleteMany({ where: { id, orgId } });
  await logActivity({
    orgId,
    user: null,
    action: "recurring.delete",
    entity: "RecurringEntry",
    entityId: id,
    summary: `Repeating ${existing.kind.toLowerCase()} deleted; existing entries preserved`,
  });
  revalidatePath("/expenses");
}

function occurrenceFrom(fd: FormData): Date {
  const value = String(fd.get("occurrence") ?? "").trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid occurrence");
  return date;
}

export async function postConfirmed(fd: FormData) {
  const orgId = await requireOrgId();
  const id = text(fd, "recurringId");
  if (!id) return;
  const series = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!series) return;
  await authorizeKind(orgId, series.kind);
  await postConfirmedOccurrence(orgId, id, occurrenceFrom(fd), money(fd));
  revalidatePath("/expenses");
  revalidatePath("/reports");
}

export async function skipConfirmed(fd: FormData) {
  const orgId = await requireOrgId();
  const id = text(fd, "recurringId");
  if (!id) return;
  const series = await db.recurringEntry.findFirst({ where: { id, orgId } });
  if (!series) return;
  await authorizeKind(orgId, series.kind);
  await skipConfirmedOccurrence(orgId, id, occurrenceFrom(fd));
  revalidatePath("/expenses");
}

export async function postAllConfirmed() {
  const orgId = await requireOrgId();
  const due = await getDueConfirmOccurrences(orgId);
  for (const occurrence of due) {
    await postConfirmedOccurrence(
      orgId,
      occurrence.recurringId,
      occurrence.occurrence,
      occurrence.amount,
    );
  }
  revalidatePath("/expenses");
  revalidatePath("/reports");
}
