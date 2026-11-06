import { db, dbBase } from "./db";
import type { CSSProperties } from "react";
import { accentVarsFromHex } from "./appearance";
import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { createSaleTx } from "@/lib/sales";
import { notify } from "@/lib/notifications";
import { notifyLowStockIfCrossed } from "@/lib/lowStock";
import { escapeHtml, sendEmail, shopEmailHeader } from "@/lib/email";
import { formatMoney } from "@/lib/utils";

export const RESERVED_SHOP_SLUGS = new Set([
  "admin",
  "api",
  "cart",
  "checkout",
  "login",
  "new",
  "order",
  "orders",
  "privacy",
  "settings",
  "shop",
  "signup",
  "success",
  "terms",
]);

export function isValidShopSlug(slug: string): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) &&
    slug.length >= 3 &&
    slug.length <= 40 &&
    !RESERVED_SHOP_SLUGS.has(slug)
  );
}

export function shopDisplayName(
  shop: { name?: string | null } | null | undefined,
  orgName: string,
): string {
  return shop?.name?.trim() || orgName;
}

export function suggestedShopSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug.length >= 3 && !RESERVED_SHOP_SLUGS.has(slug)
    ? slug
    : "my-shop";
}

export function createShopOrderToken(): string {
  return randomBytes(18).toString("base64url");
}

export function shopOrderStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "New — paid";
    case "SHIPPED":
      return "Shipped";
    case "PICKED_UP":
      return "Picked up";
    case "CANCELED":
      return "Canceled";
    default:
      return "Pending payment";
  }
}

export function shopFulfillmentLabel(fulfillment: string): string {
  return fulfillment === "SHIP" ? "Ship" : "Pickup";
}

export type ProductFeedShop = {
  slug: string;
  name: string | null;
  shipEnabled: boolean;
  shipFlatRate: number;
};

export type ProductFeedItem = {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number | null;
  qtyOnHand: number;
  category: string | null;
  photoIds: string[];
};

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function feedPrice(amount: number): string {
  return `${(Math.round(amount * 100) / 100).toFixed(2)} USD`;
}

export function buildProductFeedXml(
  shop: ProductFeedShop,
  orgName: string,
  items: ProductFeedItem[],
  root: string,
): string {
  const origin = root.replace(/\/$/, "");
  const displayName = shopDisplayName(shop, orgName);
  const shopUrl = `${origin}/store/${encodeURIComponent(shop.slug)}`;
  const products = items
    .filter(
      (item) =>
        item.unitPrice != null &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice > 0 &&
        item.photoIds.length > 0,
    )
    .map((item) => {
      const productUrl = `${shopUrl}/${encodeURIComponent(item.id)}`;
      const photos = item.photoIds.slice(0, 6);
      const description = item.description || item.name;
      return `  <item>
    <g:id>${xmlEscape(item.id)}</g:id>
    <g:title>${xmlEscape(item.name.slice(0, 150))}</g:title>
    <g:description>${xmlEscape(description.slice(0, 5000))}</g:description>
    <g:link>${xmlEscape(productUrl)}</g:link>
    <g:image_link>${xmlEscape(`${origin}/api/shop/photo/${encodeURIComponent(photos[0])}`)}</g:image_link>
${photos
  .slice(1)
  .map(
    (photoId) =>
      `    <g:additional_image_link>${xmlEscape(`${origin}/api/shop/photo/${encodeURIComponent(photoId)}`)}</g:additional_image_link>`,
  )
  .join("\n")}
    <g:price>${feedPrice(item.unitPrice!)}</g:price>
    <g:availability>${item.qtyOnHand > 0 ? "in_stock" : "out_of_stock"}</g:availability>
    <g:condition>new</g:condition>
    <g:brand>${xmlEscape(displayName)}</g:brand>
    <g:identifier_exists>no</g:identifier_exists>
${item.category ? `    <g:product_type>${xmlEscape(item.category)}</g:product_type>\n` : ""}${shop.shipEnabled ? `    <g:shipping><g:country>US</g:country><g:price>${feedPrice(shop.shipFlatRate)}</g:price></g:shipping>\n` : ""}  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${xmlEscape(`${displayName} product feed`)}</title>
  <link>${xmlEscape(shopUrl)}</link>
  <description>${xmlEscape(`Products available from ${displayName}`)}</description>
${products}
</channel>
</rss>`;
}

export type SalesChannelSummary = {
  channel: string;
  count: number;
  itemsSold: number;
  revenue: number;
};

export function aggregateSalesByChannel(
  sales: Array<{
    channel: string | null;
    quantity: number;
    unitPrice: number;
  }>,
): SalesChannelSummary[] {
  const groups = new Map<string, SalesChannelSummary>();
  for (const sale of sales) {
    const channel = sale.channel ?? "Not set";
    const summary = groups.get(channel) ?? {
      channel: channel === "Vultrix Shop" ? "Your Vultrix shop" : channel,
      count: 0,
      itemsSold: 0,
      revenue: 0,
    };
    summary.count += 1;
    summary.itemsSold += sale.quantity;
    summary.revenue += sale.quantity * sale.unitPrice;
    groups.set(channel, summary);
  }
  return [...groups.values()].sort(
    (a, b) => b.revenue - a.revenue || a.channel.localeCompare(b.channel),
  );
}

type ShopShippingDetails = {
  name?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
};

function sessionShippingDetails(session: Stripe.Checkout.Session) {
  const extended = session as Stripe.Checkout.Session & {
    collected_information?: {
      shipping_details?: ShopShippingDetails | null;
    } | null;
    shipping_details?: ShopShippingDetails | null;
    shipping_cost?: { amount_total?: number | null } | null;
  };
  return (
    extended.collected_information?.shipping_details ??
    extended.shipping_details ??
    null
  );
}

function safeShippingAddress(session: Stripe.Checkout.Session) {
  const details = sessionShippingDetails(session);
  const address = details?.address ?? session.customer_details?.address ?? null;
  if (!address) return undefined;
  return {
    name: details?.name ?? session.customer_details?.name ?? null,
    address: {
      line1: address.line1 ?? null,
      line2: address.line2 ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      postal_code: address.postal_code ?? null,
      country: address.country ?? null,
    },
  };
}

function shippingAmountFromSession(session: Stripe.Checkout.Session): number {
  const extended = session as Stripe.Checkout.Session & {
    shipping_cost?: { amount_total?: number | null } | null;
  };
  const cents =
    extended.shipping_cost?.amount_total ??
    session.total_details?.amount_shipping ??
    0;
  return Math.max(0, Math.round(cents) / 100);
}

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://vultrix.net"
  ).replace(/\/$/, "");
}

export async function recordShopOrderPayment(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.metadata?.kind !== "shop"
  ) {
    return;
  }
  const orgId = session.metadata.orgId;
  const orderId = session.metadata.shopOrderId;
  if (!orgId || !orderId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? session.id);
  const total =
    Math.max(0, Math.round(session.amount_total ?? 0)) / 100;
  const shipping = shippingAmountFromSession(session);
  const paidAt = new Date();
  const details = sessionShippingDetails(session);
  const shipAddress = safeShippingAddress(session);
  const stockAlerts: Array<{
    partId: string;
    qtyBefore: number;
    qtyAfter: number;
    partName: string;
  }> = [];

  const paidOrder = await db.$transaction(async (tx) => {
    const order = await tx.shopOrder.findFirst({
      where: { id: orderId, orgId },
      include: { lines: true },
    });
    if (!order) return null;

    const updated = await tx.shopOrder.updateMany({
      where: { id: order.id, orgId, status: "PENDING" },
      data: {
        status: "PAID",
        paymentIntentId,
        buyerName:
          session.customer_details?.name ?? details?.name ?? null,
        buyerEmail: session.customer_details?.email ?? null,
        buyerPhone: session.customer_details?.phone ?? null,
        ...(shipAddress ? { shipAddress } : {}),
        total,
        shipping,
        subtotal: Math.max(0, Math.round((total - shipping) * 100) / 100),
        paidAt,
      },
    });
    if (updated.count === 0) return null;

    for (const line of order.lines) {
      const sale = await createSaleTx(tx, orgId, {
        soldAt: paidAt,
        partId: line.partId,
        shopOrderId: order.id,
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        channel: "Vultrix Shop",
        note: `Shop order #${order.number}`,
      });
      for (const alert of sale.stockAlerts) {
        const part = await tx.part.findUnique({
          where: { id: alert.partId },
          select: { name: true },
        });
        stockAlerts.push({
          ...alert,
          partName: part?.name ?? "Inventory item",
        });
      }
    }
    if (shipping > 0) {
      await tx.income.create({
        data: {
          orgId,
          receivedAt: paidAt,
          amount: shipping,
          source: `Shipping — Shop order #${order.number}`,
          frequency: "ONE_TIME",
          note: `Shop order #${order.number}`,
        },
      });
    }
    return { ...order, total, shipping, paidAt };
  });
  if (!paidOrder) return;

  for (const alert of stockAlerts) {
    try {
      await notifyLowStockIfCrossed(alert.partId, alert.qtyBefore);
    } catch (error) {
      console.error("Shop order low-stock notification failed:", error);
    }
    if (alert.qtyAfter < 0) {
      await notify({
        orgId,
        kind: "shop_order",
        title: `Oversold: ${alert.partName}`,
        body: `Shop order #${paidOrder.number} left inventory below zero.`,
        href: `/inventory/${alert.partId}`,
      });
    }
  }

  const [shop, organization, owner] = await Promise.all([
    db.shop.findUnique({ where: { orgId }, select: { slug: true, name: true } }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true, billingEmail: true },
    }),
    db.user.findFirst({
      where: { orgId, role: "OWNER", isActive: true },
      select: { email: true },
    }),
  ]);
  const organizationName = organization?.name ?? "Shop";
  const shopName = shopDisplayName(shop, organizationName);
  const ownerEmail = organization?.billingEmail ?? owner?.email ?? null;
  const orderUrl = shop
    ? `${appOrigin()}/store/${encodeURIComponent(shop.slug)}/order/${encodeURIComponent(paidOrder.publicToken)}`
    : appOrigin();
  const itemList = paidOrder.lines
    .map(
      (line) =>
        `<li>${escapeHtml(line.itemName)} × ${line.quantity} — ${formatMoney(line.unitPrice * line.quantity)}</li>`,
    )
    .join("");
  const address = paidOrder.shipAddress as
    | {
        name?: string | null;
        address?: Record<string, string | null | undefined>;
      }
    | null;
  const addressText = address?.address
    ? [
        address.name,
        address.address.line1,
        address.address.line2,
        [address.address.city, address.address.state, address.address.postal_code]
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .map((line) => `<div>${escapeHtml(String(line))}</div>`)
        .join("")
    : "Pickup";
  const ownerHeader = shopEmailHeader({
    shopName: organizationName,
    logo: null,
    accent: null,
  });
  const buyerHeader = shopEmailHeader({ shopName, logo: null, accent: null });
  const orderHeading = `Shop order #${paidOrder.number}`;

  await notify({
    orgId,
    kind: "shop_order",
    title: `New order #${paidOrder.number} — ${formatMoney(total)}`,
    body: paidOrder.lines.map((line) => line.itemName).join(", "),
    href: `/shop/orders/${paidOrder.id}`,
  });
  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `New order #${paidOrder.number} — ${formatMoney(total)}`,
      html: `${ownerHeader}<h1>${escapeHtml(orderHeading)}</h1><p><strong>Status:</strong> ${escapeHtml(shopOrderStatusLabel("PAID"))}</p><ul>${itemList}</ul><p><strong>Total:</strong> ${formatMoney(total)}</p><p><strong>Fulfillment:</strong> ${escapeHtml(shopFulfillmentLabel(paidOrder.fulfillment))}</p><p><strong>Ship to / pickup:</strong><br>${addressText}</p><p><a href="${escapeHtml(`${appOrigin()}/shop/orders/${paidOrder.id}`)}">View order</a></p>`,
    });
  }
  if (paidOrder.buyerEmail) {
    await sendEmail({
      to: paidOrder.buyerEmail,
      subject: `Your order from ${shopName}`,
      html: `${buyerHeader}<h1>Thank you for your order</h1><ul>${itemList}</ul><p><strong>Total:</strong> ${formatMoney(total)}</p><p><a href="${escapeHtml(orderUrl)}">View your order</a></p>`,
      replyTo: ownerEmail ?? undefined,
    });
  }
}

export async function cancelExpiredShopOrder(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.metadata?.kind !== "shop") return;
  const orgId = session.metadata.orgId;
  const orderId = session.metadata.shopOrderId;
  if (!orgId || !orderId) return;
  await db.shopOrder.updateMany({
    where: { id: orderId, orgId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
}

export type ShopCartItem = {
  partId: string;
  quantity: number;
};

export type ShopCartPart = {
  id: string;
  name: string;
  unitPrice: number | null;
  qtyOnHand: number;
  shopListed: boolean;
  archived: boolean;
  photos?: Array<{ id: string }>;
};

export type ShopCartLine = {
  partId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  photoId?: string;
};

export type ShopCartResult =
  | {
      ok: true;
      lines: ShopCartLine[];
      subtotal: number;
      shipping: number;
      total: number;
    }
  | { ok: false; error: string };

export function buildShopCart(
  parts: ShopCartPart[],
  items: ShopCartItem[],
  shop: {
    shipEnabled: boolean;
    shipFlatRate: number;
    pickupEnabled: boolean;
  },
  fulfillment: string,
): ShopCartResult {
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };
  if (fulfillment !== "SHIP" && fulfillment !== "PICKUP") {
    return { ok: false, error: "Choose a valid fulfillment option." };
  }
  if (fulfillment === "SHIP" && !shop.shipEnabled) {
    return { ok: false, error: "Shipping is not available." };
  }
  if (fulfillment === "PICKUP" && !shop.pickupEnabled) {
    return { ok: false, error: "Pickup is not available." };
  }
  if (
    !Number.isFinite(shop.shipFlatRate) ||
    shop.shipFlatRate < 0
  ) {
    return { ok: false, error: "Shipping rate is invalid." };
  }

  const byId = new Map(parts.map((part) => [part.id, part]));
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (
      !item.partId ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return { ok: false, error: "Cart quantities must be whole numbers." };
    }
    quantities.set(
      item.partId,
      (quantities.get(item.partId) ?? 0) + item.quantity,
    );
  }

  const lines: ShopCartLine[] = [];
  let subtotalCents = 0;
  for (const [partId, quantity] of quantities) {
    const part = byId.get(partId);
    if (!part || !part.shopListed || part.archived) {
      return { ok: false, error: "An item in your cart is no longer available." };
    }
    if (part.unitPrice == null || !Number.isFinite(part.unitPrice) || part.unitPrice <= 0) {
      return { ok: false, error: `${part.name} is not available for purchase.` };
    }
    if (!part.photos?.length) {
      return { ok: false, error: `${part.name} is not available for purchase.` };
    }
    if (quantity > part.qtyOnHand) {
      return {
        ok: false,
        error: `Only ${Math.max(0, part.qtyOnHand)} ${part.qtyOnHand === 1 ? "is" : "are"} available for ${part.name}.`,
      };
    }
    const cents = Math.round(part.unitPrice * 100);
    subtotalCents += cents * quantity;
    lines.push({
      partId,
      itemName: part.name,
      unitPrice: cents / 100,
      quantity,
      ...(part.photos?.[0] ? { photoId: part.photos[0].id } : {}),
    });
  }

  const shippingCents =
    fulfillment === "SHIP" ? Math.round(shop.shipFlatRate * 100) : 0;
  return {
    ok: true,
    lines,
    subtotal: subtotalCents / 100,
    shipping: shippingCents / 100,
    total: (subtotalCents + shippingCents) / 100,
  };
}

const DEFAULTS: Record<string, string> = {
  shopName: "",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  shopLogo: "",
  shopAccent: "",
  defaultLaborRate: "150",
  defaultTaxRate: "8.25",
  remindAppointmentsEnabled: "false",
  remindAppointmentsHoursBefore: "24",
  remindPastDueEnabled: "false",
  remindPastDueDays: "30",
  remindServiceDueEnabled: "false",
  reminderSendHour: "8",
  weeklyReviewEmailEnabled: "false",
  dailyDigestEmailEnabled: "false",
};

export async function getSetting(orgId: string, key: string): Promise<string> {
  const row = await db.shopSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  if (row) return row.value;
  // Default the shop name to the organization's own name (not a hardcoded
  // sample shop) so a brand-new business sees their name until they customize.
  if (key === "shopName") {
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (org?.name) return org.name;
  }
  return DEFAULTS[key] ?? "";
}

export async function getAllSettings(
  orgId: string,
): Promise<Record<string, string>> {
  const [rows, org] = await Promise.all([
    db.shopSetting.findMany({ where: { orgId } }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
  ]);
  const out: Record<string, string> = { ...DEFAULTS };
  // Per-org default: show their own business name as the shop name until an
  // explicit shopName setting is saved below.
  if (org?.name) out.shopName = org.name;
  for (const r of rows) out[r.key] = r.value; // explicit saved settings win
  return out;
}

export async function setSetting(orgId: string, key: string, value: string) {
  await db.shopSetting.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value },
    update: { value },
  });
}

export async function shopBranding(
  orgId: string,
): Promise<{ logo: string | null; accent: string | null }> {
  const settings = await getAllSettings(orgId);
  const logo =
    /^data:image\/(?:png|jpeg|webp);base64,/.test(settings.shopLogo) &&
    settings.shopLogo.length <= 400_000
      ? settings.shopLogo
      : null;
  const accent = /^#[0-9a-f]{6}$/i.test(settings.shopAccent)
    ? settings.shopAccent
    : null;
  return { logo, accent };
}

export function shopBrandStyle(
  accent: string | null,
): CSSProperties | undefined {
  if (!accent) return undefined;
  return accentVarsFromHex(accent) as CSSProperties;
}

export async function getNextRoNumber(orgId: string): Promise<number> {
  // Use dbBase (no soft-delete filter) so the next number also clears
  // trashed/soft-deleted repair orders. The (orgId, roNumber) unique constraint
  // spans deleted rows too, so ignoring them here would reuse a number a
  // trashed ticket still holds and crash the create with a unique violation.
  const last = await dbBase.repairOrder.findFirst({
    where: { orgId },
    orderBy: { roNumber: "desc" },
    select: { roNumber: true },
  });
  return (last?.roNumber ?? 1000) + 1;
}
