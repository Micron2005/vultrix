import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { recordOnlinePayment } from "@/lib/connect";

function baseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return `${proto}://${host}`;
}

/**
 * Stripe redirects the customer here after paying from the shareable invoice
 * link. We record the payment immediately (idempotently) so the invoice reflects
 * it right away, even if the webhook is delayed; the webhook is a redundant
 * backstop calling the same idempotent recorder.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const root = baseUrl(req);
  const invoice = `${root}/e/${token}`;

  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !billingConfigured()) {
    return NextResponse.redirect(invoice, { status: 303 });
  }

  const ro = await db.repairOrder.findUnique({
    where: { shareToken: token },
    select: { orgId: true },
  });
  if (!ro) return NextResponse.redirect(invoice, { status: 303 });

  const org = await db.organization.findUnique({
    where: { id: ro.orgId },
    select: { stripeConnectAccountId: true },
  });
  if (!org?.stripeConnectAccountId) {
    return NextResponse.redirect(invoice, { status: 303 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      undefined,
      { stripeAccount: org.stripeConnectAccountId },
    );
    await recordOnlinePayment(session);
  } catch {
    // Non-fatal: the webhook will reconcile the payment if this fails.
  }

  return NextResponse.redirect(`${invoice}?paid=1`, { status: 303 });
}
