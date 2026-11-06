"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { enabledFeatureSet } from "@/lib/features";
import { isValidShopSlug } from "@/lib/shop";
import { logActivity } from "@/lib/activity";
import { escapeHtml, sendEmail, shopEmailHeader } from "@/lib/email";

async function shopManager() {
  const user = await requireUser();
  if (!user.orgId || !["OWNER", "ADMIN"].includes(user.role)) {
    throw new Error("Only an owner or admin can manage the shop.");
  }
  return { user, orgId: user.orgId };
}

async function ensureInventory(orgId: string) {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true },
  });
  if (!org || !enabledFeatureSet(org).has("inventory")) {
    throw new Error("Inventory is not enabled for this account.");
  }
}

export async function saveShopSettings(formData: FormData) {
  const { user, orgId } = await shopManager();
  const parsed = z.object({
    slug: z.string().trim().min(3).max(40),
    tagline: z.string().trim().max(180).optional(),
    shipFlatRate: z.coerce.number().finite().min(0).max(100000),
    pickupNote: z.string().trim().max(240).optional(),
  }).safeParse({
    slug: formData.get("slug"),
    tagline: formData.get("tagline") ?? "",
    shipFlatRate: formData.get("shipFlatRate"),
    pickupNote: formData.get("pickupNote") ?? "",
  });
  if (!parsed.success || !isValidShopSlug(parsed.data.slug)) {
    redirect("/shop?error=slug");
  }
  const enabled = formData.get("enabled") === "on";
  const shipEnabled = formData.get("shipEnabled") === "on";
  const pickupEnabled = formData.get("pickupEnabled") === "on";
  if (enabled && !shipEnabled && !pickupEnabled) redirect("/shop?error=fulfillment");
  const duplicate = await db.shop.findFirst({
    where: { slug: parsed.data.slug, orgId: { not: orgId } },
    select: { id: true },
  });
  if (duplicate) redirect("/shop?error=slug");
  const previous = await db.shop.findUnique({ where: { orgId }, select: { slug: true } });
  const shop = await db.shop.upsert({
    where: { orgId },
    create: {
      orgId,
      slug: parsed.data.slug,
      enabled,
      tagline: parsed.data.tagline || null,
      shipEnabled,
      shipFlatRate: parsed.data.shipFlatRate,
      pickupEnabled,
      pickupNote: parsed.data.pickupNote || null,
    },
    update: {
      slug: parsed.data.slug,
      enabled,
      tagline: parsed.data.tagline || null,
      shipEnabled,
      shipFlatRate: parsed.data.shipFlatRate,
      pickupEnabled,
      pickupNote: parsed.data.pickupNote || null,
    },
  });
  await logActivity({
    orgId,
    user,
    action: "shop.settings_update",
    entity: "Shop",
    entityId: shop.id,
    summary: `Shop settings updated (${shop.slug})`,
  });
  revalidatePath("/shop");
  revalidatePath("/shop/orders");
  revalidatePath(`/store/${previous?.slug ?? shop.slug}`);
  revalidatePath(`/store/${shop.slug}`);
  redirect("/shop?saved=1");
}

export async function setShopListed(partId: string, listed: boolean) {
  const { user, orgId } = await shopManager();
  await ensureInventory(orgId);
  const result = await db.part.updateMany({
    where: { id: partId, orgId, archived: false },
    data: { shopListed: listed },
  });
  if (!result.count) return;
  await logActivity({
    orgId,
    user,
    action: listed ? "shop.item_list" : "shop.item_unlist",
    entity: "Part",
    entityId: partId,
    summary: listed ? "Inventory item listed in shop" : "Inventory item removed from shop",
  });
  revalidatePath("/shop");
  const shop = await db.shop.findUnique({ where: { orgId }, select: { slug: true } });
  if (shop) revalidatePath(`/store/${shop.slug}`);
}

export async function addShopPhoto(partId: string, dataUrl: string) {
  const { orgId } = await shopManager();
  await ensureInventory(orgId);
  if (
    dataUrl.length > 3_000_000 ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
  ) {
    throw new Error("Upload a JPEG image no larger than 1200 pixels.");
  }
  const part = await db.part.findFirst({
    where: { id: partId, orgId, archived: false },
    select: { id: true },
  });
  if (!part) throw new Error("Item not found.");
  const count = await db.productPhoto.count({ where: { partId, orgId } });
  if (count >= 6) throw new Error("Each item can have up to six photos.");
  await db.productPhoto.create({
    data: { partId, orgId, dataUrl, position: count },
  });
  revalidatePath("/shop");
}

export async function deleteShopPhoto(photoId: string) {
  const { orgId } = await shopManager();
  await ensureInventory(orgId);
  const photo = await db.productPhoto.findFirst({
    where: { id: photoId, orgId },
    select: { id: true, partId: true },
  });
  if (!photo) return;
  await db.productPhoto.delete({ where: { id: photo.id } });
  const remaining = await db.productPhoto.findMany({
    where: { partId: photo.partId, orgId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  await db.$transaction(
    remaining.map((item, position) =>
      db.productPhoto.update({ where: { id: item.id }, data: { position } }),
    ),
  );
  revalidatePath("/shop");
}

export async function moveShopPhoto(photoId: string, direction: -1 | 1) {
  const { orgId } = await shopManager();
  await ensureInventory(orgId);
  const photo = await db.productPhoto.findFirst({
    where: { id: photoId, orgId },
    select: { id: true, partId: true, position: true },
  });
  if (!photo) return;
  const adjacent = await db.productPhoto.findFirst({
    where: { partId: photo.partId, orgId, position: photo.position + direction },
    select: { id: true, position: true },
  });
  if (!adjacent) return;
  await db.$transaction([
    db.productPhoto.update({ where: { id: photo.id }, data: { position: adjacent.position } }),
    db.productPhoto.update({ where: { id: adjacent.id }, data: { position: photo.position } }),
  ]);
  revalidatePath("/shop");
}

export async function markOrderShipped(orderId: string, formData: FormData) {
  const { user, orgId } = await shopManager();
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim().slice(0, 120);
  const order = await db.shopOrder.findFirst({
    where: { id: orderId, orgId, status: "PAID", fulfillment: "SHIP" },
    include: { lines: true, organization: { select: { name: true, billingEmail: true } } },
  });
  if (!order) redirect(`/shop/orders/${orderId}?error=status`);
  const updated = await db.shopOrder.updateMany({
    where: { id: order.id, orgId, status: "PAID" },
    data: { status: "SHIPPED", trackingNumber: trackingNumber || null, fulfilledAt: new Date() },
  });
  if (!updated.count) redirect(`/shop/orders/${orderId}?error=status`);
  const owner = await db.user.findFirst({ where: { orgId, role: "OWNER", isActive: true }, select: { email: true } });
  const email = order.buyerEmail;
  if (email) {
    const lines = order.lines.map((line) => `<li>${escapeHtml(line.itemName)} × ${line.quantity}</li>`).join("");
    await sendEmail({
      to: email,
      subject: `Your ${order.organization.name} order has shipped`,
      html: `${shopEmailHeader({ shopName: order.organization.name, logo: null, accent: null })}<h1>Your order is on its way</h1><ul>${lines}</ul>${trackingNumber ? `<p>Tracking: ${escapeHtml(trackingNumber)}</p>` : ""}`,
      replyTo: order.organization.billingEmail ?? owner?.email ?? undefined,
    });
  }
  await logActivity({
    orgId, user, action: "shop.order_shipped", entity: "ShopOrder", entityId: order.id,
    summary: `Shop order #${order.number} marked shipped`,
  });
  revalidatePath("/shop/orders");
  revalidatePath(`/shop/orders/${order.id}`);
  redirect(`/shop/orders/${order.id}?saved=1`);
}

export async function markOrderPickedUp(orderId: string) {
  const { user, orgId } = await shopManager();
  const order = await db.shopOrder.findFirst({
    where: { id: orderId, orgId, status: "PAID", fulfillment: "PICKUP" },
    select: { id: true, number: true },
  });
  if (!order) redirect(`/shop/orders/${orderId}?error=status`);
  await db.shopOrder.updateMany({
    where: { id: order.id, orgId, status: "PAID" },
    data: { status: "PICKED_UP", fulfilledAt: new Date() },
  });
  await logActivity({
    orgId, user, action: "shop.order_picked_up", entity: "ShopOrder", entityId: order.id,
    summary: `Shop order #${order.number} marked picked up`,
  });
  revalidatePath("/shop/orders");
  revalidatePath(`/shop/orders/${order.id}`);
  redirect(`/shop/orders/${order.id}?saved=1`);
}
