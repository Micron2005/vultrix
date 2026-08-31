"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { enabledFeatureSet } from "@/lib/features";
import { logActivity } from "@/lib/activity";
import { assertCanViewFinancials } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { dateInputInTimeZone, isValidTimeZone } from "@/lib/timezone";
import { parseDecimal } from "@/lib/utils";
import { createSale, deleteSale, updateSale } from "@/lib/sales";

export async function requireSalesOrgId(): Promise<{
  orgId: string;
  timezone: string;
  hasInventory: boolean;
}> {
  const user = await requireUser();
  assertCanViewFinancials(user.role);
  if (!user.orgId) redirect("/admin");
  const features = enabledFeatureSet(user);
  if (!features.has("financials") || features.has("invoices")) {
    redirect("/");
  }
  const organization = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { timezone: true },
  });
  const timezone =
    organization && isValidTimeZone(organization.timezone)
      ? organization.timezone
      : "America/New_York";
  return {
    orgId: user.orgId,
    timezone,
    hasInventory: features.has("inventory"),
  };
}

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function requiredDecimal(fd: FormData, key: string, label: string): number {
  const value = parseDecimal(text(fd, key));
  if (value == null) throw new Error(`${label} must be a valid number.`);
  return value;
}

function soldAtFromForm(fd: FormData, timezone: string): Date {
  const value = text(fd, "soldAt");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Sale date is required.");
  }
  const date = dateInputInTimeZone(value, timezone, new Date(Number.NaN));
  if (Number.isNaN(date.getTime())) throw new Error("Sale date is invalid.");
  return date;
}

function commonInput(
  fd: FormData,
  timezone: string,
  hasInventory: boolean,
) {
  const partIdValue = text(fd, "partId");
  const partId = partIdValue && partIdValue !== "__untracked__" ? partIdValue : null;
  if (partId && !hasInventory) {
    throw new Error("Inventory is not enabled for this account.");
  }
  const itemName = text(fd, "itemName");
  const quantity = requiredDecimal(fd, "quantity", "Quantity");
  const unitPrice = requiredDecimal(fd, "unitPrice", "Price");
  const unitCostValue = text(fd, "unitCost");
  const unitCost = unitCostValue ? parseDecimal(unitCostValue) : null;
  if (unitCostValue && unitCost == null) {
    throw new Error("Cost must be a valid number.");
  }
  if (quantity <= 0) throw new Error("Quantity must be greater than zero.");
  return {
    soldAt: soldAtFromForm(fd, timezone),
    partId,
    itemName,
    quantity,
    unitPrice,
    unitCost,
    channel: text(fd, "channel") || null,
    note: text(fd, "note") || null,
  };
}

export async function createSaleAction(fd: FormData) {
  const { orgId, timezone, hasInventory } = await requireSalesOrgId();
  const user = await requireUser();
  const input = commonInput(fd, timezone, hasInventory);
  const sale = await createSale(orgId, input);
  await logActivity({
    orgId,
    user,
    action: "sale.create",
    entity: "Sale",
    entityId: sale.id,
    summary: `Sale recorded for ${input.quantity} ${sale.itemName}`,
  });
  revalidatePath("/sales");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  if (sale.partId) revalidatePath(`/inventory/${sale.partId}`);
  redirect("/sales");
}

export async function updateSaleAction(id: string, fd: FormData) {
  const { orgId, timezone, hasInventory } = await requireSalesOrgId();
  const user = await requireUser();
  const input = commonInput(fd, timezone, hasInventory);
  const sale = await updateSale(orgId, id, input);
  await logActivity({
    orgId,
    user,
    action: "sale.update",
    entity: "Sale",
    entityId: sale.id,
    summary: `Sale updated for ${input.quantity} ${sale.itemName}`,
  });
  revalidatePath("/sales");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  if (sale.partId) revalidatePath(`/inventory/${sale.partId}`);
  redirect("/sales");
}

export async function deleteSaleAction(fd: FormData) {
  const { orgId } = await requireSalesOrgId();
  const user = await requireUser();
  const id = text(fd, "id");
  if (!id) throw new Error("Sale not found.");
  const sale = await deleteSale(orgId, id);
  await logActivity({
    orgId,
    user,
    action: "sale.delete",
    entity: "Sale",
    entityId: sale.id,
    summary: `Sale deleted for ${sale.itemName}`,
  });
  revalidatePath("/sales");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  if (sale.partId) revalidatePath(`/inventory/${sale.partId}`);
  redirect("/sales");
}
