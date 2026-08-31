"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requireOrgId, requireUser } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

function parseBudgetAmount(fd: FormData): number {
  const raw = text(fd, "amount");
  if (!raw) return 0;
  const amount = Number(raw.replace(/[$,]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Budget must be a non-negative number.");
  }
  return amount;
}

export async function setBudget(fd: FormData) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const category = text(fd, "category");
  if (!category) throw new Error("Category is required.");
  const amount = parseBudgetAmount(fd);
  const budgets = await db.budget.findMany({ where: { orgId } });
  const existing = budgets.find(
    (budget) => budget.category.toLowerCase() === category.toLowerCase(),
  );

  if (amount === 0) {
    if (!existing) return;
    await db.budget.deleteMany({ where: { id: existing.id, orgId } });
    await logActivity({
      orgId,
      user,
      action: "budget.delete",
      entity: "Budget",
      entityId: existing.id,
      summary: `Budget for ${existing.category} removed`,
    });
  } else if (existing) {
    await db.budget.updateMany({
      where: { id: existing.id, orgId },
      data: { amount },
    });
    await logActivity({
      orgId,
      user,
      action: "budget.set",
      entity: "Budget",
      entityId: existing.id,
      summary: `Budget for ${existing.category} updated to ${formatMoney(amount)}`,
    });
  } else {
    const budget = await db.budget.create({
      data: { orgId, category, amount },
    });
    await logActivity({
      orgId,
      user,
      action: "budget.set",
      entity: "Budget",
      entityId: budget.id,
      summary: `Budget for ${category} created at ${formatMoney(amount)}`,
    });
  }

  revalidatePath("/expenses/budget");
  revalidatePath("/expenses");
}

export async function deleteBudget(fd: FormData) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  const id = text(fd, "id");
  if (!id) return;
  const existing = await db.budget.findFirst({ where: { id, orgId } });
  if (!existing) return;
  await db.budget.deleteMany({ where: { id, orgId } });
  await logActivity({
    orgId,
    user,
    action: "budget.delete",
    entity: "Budget",
    entityId: id,
    summary: `Budget for ${existing.category} removed`,
  });
  revalidatePath("/expenses/budget");
  revalidatePath("/expenses");
}
