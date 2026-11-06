import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { baseUrl } from "@/lib/requestUrl";
import { billingConfigured, getStripe } from "@/lib/stripe";
import {
  buildShopCart,
  createShopOrderToken,
  shopDisplayName,
  type ShopCartItem,
} from "@/lib/shop";

const CheckoutBody = z.object({
  items: z
    .array(
      z.object({
        partId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(40),
  fulfillment: z.enum(["SHIP", "PICKUP"]),
});

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = CheckoutBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  }

  const shop = await db.shop.findUnique({
    where: { slug },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          stripeConnectAccountId: true,
          stripeConnectChargesEnabled: true,
        },
      },
    },
  });
  if (!shop?.enabled) {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }
  const displayName = shopDisplayName(shop, shop.organization.name);
  if (
    !billingConfigured() ||
    !shop.organization.stripeConnectChargesEnabled ||
    !shop.organization.stripeConnectAccountId
  ) {
    return NextResponse.json(
      { error: "This shop isn't taking payments yet." },
      { status: 409 },
    );
  }

  const items: ShopCartItem[] = parsed.data.items;
  const parts = await db.part.findMany({
    where: { orgId: shop.orgId, id: { in: items.map((item) => item.partId) } },
    select: {
      id: true,
      name: true,
      description: true,
      unitPrice: true,
      qtyOnHand: true,
      shopListed: true,
      archived: true,
      photos: {
        orderBy: { position: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  const cart = buildShopCart(parts, items, shop, parsed.data.fulfillment);
  if (!cart.ok) {
    return NextResponse.json({ error: cart.error }, { status: 409 });
  }

  let order;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      order = await db.$transaction(async (tx) => {
        const aggregate = await tx.shopOrder.aggregate({
          where: { orgId: shop.orgId },
          _max: { number: true },
        });
        const number = (aggregate._max.number ?? 0) + 1;
        return tx.shopOrder.create({
          data: {
            orgId: shop.orgId,
            number,
            publicToken: createShopOrderToken(),
            fulfillment: parsed.data.fulfillment,
            subtotal: cart.subtotal,
            shipping: cart.shipping,
            total: cart.total,
            lines: {
              create: cart.lines.map((line) => ({
                partId: line.partId,
                itemName: line.itemName,
                unitPrice: line.unitPrice,
                quantity: line.quantity,
              })),
            },
          },
          include: { lines: true },
        });
      });
      break;
    } catch (error) {
      if (attempt === 0 && isUniqueConflict(error)) continue;
      throw error;
    }
  }
  if (!order) {
    return NextResponse.json(
      { error: "Could not create the order. Please try again." },
      { status: 500 },
    );
  }

  const root = baseUrl(req);
  const httpsRoot = root.startsWith("https://");
  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: cart.lines.map((line) => {
          const photo = httpsRoot && line.photoId
            ? `${root}/api/shop/photo/${encodeURIComponent(line.photoId)}`
            : undefined;
          return {
            quantity: line.quantity,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(line.unitPrice * 100),
              product_data: {
                name: line.itemName,
                description: `Sold by ${displayName}`,
                ...(photo ? { images: [photo] } : {}),
              },
            },
          };
        }),
        ...(parsed.data.fulfillment === "SHIP"
          ? {
              shipping_address_collection: { allowed_countries: ["US"] as ["US"] },
              shipping_options: [
                {
                  shipping_rate_data: {
                    type: "fixed_amount" as const,
                    fixed_amount: {
                      amount: Math.round(cart.shipping * 100),
                      currency: "usd",
                    },
                    display_name: "Shipping",
                  },
                },
              ],
            }
          : {}),
        phone_number_collection: { enabled: true },
        customer_creation: "if_required",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        metadata: {
          kind: "shop",
          orgId: shop.orgId,
          shopOrderId: order.id,
        },
        payment_intent_data: {
          metadata: {
            kind: "shop",
            orgId: shop.orgId,
            shopOrderId: order.id,
          },
        },
        success_url: `${root}/api/shop/${encodeURIComponent(slug)}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${root}/store/${encodeURIComponent(slug)}/cart`,
      },
      { stripeAccount: shop.organization.stripeConnectAccountId },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    await db.shopOrder.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    await db.shopOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "CANCELED" },
    });
    console.error("Shop checkout session creation failed:", error);
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 502 },
    );
  }
}
