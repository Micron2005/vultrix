import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { baseUrl } from "@/lib/requestUrl";
import { billingConfigured, getStripe } from "@/lib/stripe";
import { recordShopOrderPayment } from "@/lib/shop";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const root = baseUrl(req);
  const returnToShop = () =>
    NextResponse.redirect(new URL(`/s/${encodeURIComponent(slug)}`, root), 303);
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !billingConfigured()) return returnToShop();

  const shop = await db.shop.findUnique({
    where: { slug },
    include: {
      organization: {
        select: { id: true, stripeConnectAccountId: true },
      },
    },
  });
  if (!shop?.organization.stripeConnectAccountId) return returnToShop();

  try {
    const session = await getStripe().checkout.sessions.retrieve(
      sessionId,
      {},
      { stripeAccount: shop.organization.stripeConnectAccountId },
    );
    if (
      session.metadata?.kind !== "shop" ||
      session.metadata.orgId !== shop.orgId ||
      !session.metadata.shopOrderId
    ) {
      return returnToShop();
    }
    try {
      await recordShopOrderPayment(session);
    } catch (error) {
      console.error("Could not record shop order from success return:", error);
    }
    const order = await db.shopOrder.findFirst({
      where: {
        id: session.metadata.shopOrderId,
        orgId: shop.orgId,
      },
      select: { publicToken: true },
    });
    if (!order) return returnToShop();
    return NextResponse.redirect(
      new URL(
        `/s/${encodeURIComponent(slug)}/order/${encodeURIComponent(order.publicToken)}?new=1`,
        root,
      ),
      303,
    );
  } catch (error) {
    console.error("Could not retrieve completed shop checkout:", error);
    return returnToShop();
  }
}
