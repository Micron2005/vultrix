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
 * Start a single Stripe Checkout that pays every outstanding invoice for a
 * customer at once. One line item per invoice; on success each invoice is paid
 * its own balance (idempotently). Direct charges on the shop's connected
 * account, no platform fee — same as the per-invoice flow.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const root = baseUrl(req);
  const portal = `${root}/p/${token}`;

  if (!billingConfigured()) {
    return NextResponse.redirect(`${portal}?payerror=1`, { status: 303 });
  }

  const customer = await db.customer.findUnique({
    where: { portalToken: token },
    select: { id: true, orgId: true },
  });
  if (!customer) {
    return NextResponse.redirect(`${root}/`, { status: 303 });
  }

  const org = await db.organization.findUnique({
    where: { id: customer.orgId },
    select: {
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!org?.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
    return NextResponse.redirect(`${portal}?payerror=1`, { status: 303 });
  }

  const ros = await db.repairOrder.findMany({
    where: { customerId: customer.id, status: "INVOICED" },
    select: { id: true, roNumber: true },
    orderBy: { invoicedAt: "asc" },
  });

  let payableCount = 0;
  let totalBalance = 0;
  for (const ro of ros) {
    const [total, paid] = await Promise.all([
      computeRoTotal(customer.orgId, ro.id),
      computeRoPaid(ro.id),
    ]);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (balance > 0) {
      payableCount += 1;
      totalBalance = Math.round((totalBalance + balance) * 100) / 100;
    }
  }

  if (payableCount === 0 || totalBalance <= 0) {
    return NextResponse.redirect(`${portal}?paid=1`, { status: 303 });
  }

  // The exact per-invoice split is recomputed at success time (see the bulk
  // success route), so we charge one aggregate line item. This avoids Stripe's
  // metadata size / line-item count limits when a customer has many invoices.
  const label =
    payableCount === 1
      ? `Invoice payment — ${org.name}`
      : `${payableCount} invoices — ${org.name}`;
  const meta = { orgId: customer.orgId, bulk: "1", customerId: customer.id };

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
              product_data: { name: label },
              unit_amount: Math.round(totalBalance * 100),
            },
            quantity: 1,
          },
        ],
        metadata: meta,
        payment_intent_data: { metadata: meta },
        success_url: `${root}/api/pay/${token}/all/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: portal,
      },
      { stripeAccount: org.stripeConnectAccountId },
    );
  } catch (err) {
    console.error("Bulk online payment checkout failed:", err);
    return NextResponse.redirect(`${portal}?payerror=1`, { status: 303 });
  }

  if (!session.url) {
    return NextResponse.redirect(`${portal}?payerror=1`, { status: 303 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
