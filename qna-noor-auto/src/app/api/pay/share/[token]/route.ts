import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { computeRoTotal, computeRoPaid } from "@/lib/roTotal";

function baseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

/**
 * Start a Stripe Checkout for a customer paying their invoice straight from the
 * shareable invoice link the shop sent them (`/e/<shareToken>`), without having
 * to navigate the portal. Same direct charge on the shop's connected account as
 * the portal Pay button, so the money goes straight to the shop, no platform fee.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const root = baseUrl(req);
  const invoice = `${root}/e/${token}`;

  if (!billingConfigured()) {
    return NextResponse.redirect(`${invoice}?payerror=1`, { status: 303 });
  }

  const ro = await db.repairOrder.findUnique({
    where: { shareToken: token },
    select: { id: true, roNumber: true, status: true, orgId: true },
  });
  if (!ro) {
    return NextResponse.redirect(`${root}/`, { status: 303 });
  }

  const org = await db.organization.findUnique({
    where: { id: ro.orgId },
    select: {
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!org?.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
    return NextResponse.redirect(`${invoice}?payerror=1`, { status: 303 });
  }

  const [total, paid] = await Promise.all([
    computeRoTotal(ro.orgId, ro.id),
    computeRoPaid(ro.id),
  ]);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  if (balance <= 0) {
    return NextResponse.redirect(`${invoice}?paid=1`, { status: 303 });
  }

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: `Invoice #${ro.roNumber} — ${org.name}` },
              unit_amount: Math.round(balance * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { repairOrderId: ro.id, orgId: ro.orgId },
        payment_intent_data: {
          metadata: { repairOrderId: ro.id, orgId: ro.orgId },
        },
        success_url: `${root}/api/pay/share/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: invoice,
      },
      { stripeAccount: org.stripeConnectAccountId },
    );
  } catch (err) {
    console.error("Online payment checkout failed:", err);
    return NextResponse.redirect(`${invoice}?payerror=1`, { status: 303 });
  }

  if (!session.url) {
    return NextResponse.redirect(`${invoice}?payerror=1`, { status: 303 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
