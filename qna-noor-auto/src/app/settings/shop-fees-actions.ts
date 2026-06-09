"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

function toNum(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null) return fallback;
  const s = String(v).trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNum(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).toLowerCase();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

export async function createShopFee(fd: FormData) {
  const orgId = await requireOrgId();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) redirect("/settings?error=fee_name_required#shop-fees");
  const description = String(fd.get("description") ?? "").trim() || null;
  const partsPercent = toNum(fd.get("partsPercent"));
  const laborPercent = toNum(fd.get("laborPercent"));
  const maxCap = toNullableNum(fd.get("maxCap"));
  const taxable = toBool(fd.get("taxable"));
  const active = fd.get("active") == null ? true : toBool(fd.get("active"));
  const last = await db.shopFee.findFirst({
    where: { orgId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.shopFee.create({
    data: {
      orgId,
      name,
      description,
      partsPercent,
      laborPercent,
      maxCap,
      taxable,
      active,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/repair-orders");
  redirect("/settings?saved=1#shop-fees");
}

export async function updateShopFee(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) redirect("/settings?error=fee_name_required#shop-fees");
  await db.shopFee.updateMany({
    where: { id, orgId },
    data: {
      name,
      description: String(fd.get("description") ?? "").trim() || null,
      partsPercent: toNum(fd.get("partsPercent")),
      laborPercent: toNum(fd.get("laborPercent")),
      maxCap: toNullableNum(fd.get("maxCap")),
      taxable: toBool(fd.get("taxable")),
      active: toBool(fd.get("active")),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/repair-orders");
  redirect("/settings?saved=1#shop-fees");
}

export async function deleteShopFee(id: string) {
  const orgId = await requireOrgId();
  await db.shopFee.deleteMany({ where: { id, orgId } });
  revalidatePath("/settings");
  revalidatePath("/repair-orders");
  redirect("/settings?deleted=1#shop-fees");
}

/**
 * Per-RO exclusion toggles (invoked from RO detail page).
 * If row exists, removing it = "Re-add fee". Otherwise, creating it = "Remove fee".
 */
export async function excludeShopFeeFromRO(repairOrderId: string, shopFeeId: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ro) redirect("/repair-orders");
  await db.repairOrderShopFeeExclusion.upsert({
    where: { repairOrderId_shopFeeId: { repairOrderId, shopFeeId } },
    create: { repairOrderId, shopFeeId },
    update: {},
  });
  revalidatePath(`/repair-orders/${repairOrderId}`);
  redirect(`/repair-orders/${repairOrderId}`);
}

export async function readdShopFeeToRO(repairOrderId: string, shopFeeId: string) {
  const orgId = await requireOrgId();
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true },
  });
  if (!ro) redirect("/repair-orders");
  await db.repairOrderShopFeeExclusion
    .delete({
      where: { repairOrderId_shopFeeId: { repairOrderId, shopFeeId } },
    })
    .catch(() => {
      // already absent — no-op
    });
  revalidatePath(`/repair-orders/${repairOrderId}`);
  redirect(`/repair-orders/${repairOrderId}`);
}
