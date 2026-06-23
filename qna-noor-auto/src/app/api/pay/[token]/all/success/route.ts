import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { recordBulkOnlinePayment } from "@/lib/connect";

function baseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

/**
 * Stripe redirects the customer here after a successful bulk Checkout. We record
 * each invoice's payment immediately (idempotently) so the portal reflects them
 * right away; the webhook is a redundant backstop calling the same recorder.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const root = baseUrl(req);
  const portal = `${root}/p/${token}`;

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !billingConfigured()) {
    return NextResponse.redirect(portal, { status: 303 });
  }

  const customer = await db.customer.findUnique({
    where: { portalToken: token },
    select: { orgId: true },
  });
  if (!customer) return NextResponse.redirect(portal, { status: 303 });

  const org = await db.organization.findUnique({
    where: { id: customer.orgId },
    select: { stripeConnectAccountId: true },
  });
  if (!org?.stripeConnectAccountId) {
    return NextResponse.redirect(portal, { status: 303 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      undefined,
      { stripeAccount: org.stripeConnectAccountId },
    );
    await recordBulkOnlinePayment(session);
  } catch {
    // Non-fatal: the webhook will reconcile the payment if this fails.
  }

  return NextResponse.redirect(`${portal}?paid=1`, { status: 303 });
}
