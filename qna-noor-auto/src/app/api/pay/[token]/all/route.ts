import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { computeRoTotal, computeRoPaid } from "@/lib/roTotal";
import { encodeBulkAllocation } from "@/lib/connect";

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

  const payable: { id: string; roNumber: number; balance: number }[] = [];
  for (const ro of ros) {
    const [total, paid] = await Promise.all([
      computeRoTotal(customer.orgId, ro.id),
      computeRoPaid(ro.id),
    ]);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (balance > 0) payable.push({ id: ro.id, roNumber: ro.roNumber, balance });
  }

  if (payable.length === 0) {
    return NextResponse.redirect(`${portal}?paid=1`, { status: 303 });
  }

  const alloc = encodeBulkAllocation(
    payable.map((p) => ({ repairOrderId: p.id, amount: p.balance })),
  );

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: payable.map((p) => ({
          price_data: {
            currency: "usd",
            product_data: { name: `Invoice #${p.roNumber} — ${org.name}` },
            unit_amount: Math.round(p.balance * 100),
          },
          quantity: 1,
        })),
        metadata: { orgId: customer.orgId, alloc },
        payment_intent_data: {
          metadata: { orgId: customer.orgId, alloc },
        },
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
