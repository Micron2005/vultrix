import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { syncSubscriptionToOrg } from "@/lib/billing";
import { ensureAccountFromCheckout } from "@/lib/signup";
import { recordOnlinePayment } from "@/lib/connect";

// Stripe needs the raw request body to verify the signature, so this handler
// reads req.text() directly (no JSON parsing middleware in the App Router).

async function orgIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const org = await db.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

export async function POST(req: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret missing" }, { status: 503 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig ?? "", secret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // A one-time payment (mode=payment) is a customer paying a shop's invoice
      // on the shop's connected account — record it. Subscriptions are the
      // platform's own $45/mo billing.
      if (session.mode === "payment") {
        await recordOnlinePayment(session);
        break;
      }
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      let sub: Stripe.Subscription | null = null;
      if (session.subscription) {
        sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
      }
      // Materialize the account now that the customer got through payment.
      // Idempotent — safe even if /api/signup/complete already ran.
      await ensureAccountFromCheckout({ customerId, subscription: sub });
      break;
    }

    case "account.updated": {
      // A shop's connected account changed (e.g. finished onboarding) — mirror
      // its capability status so the customer Pay button shows/hides correctly.
      const account = event.data.object as Stripe.Account;
      await db.organization.updateMany({
        where: { stripeConnectAccountId: account.id },
        data: {
          stripeConnectChargesEnabled: Boolean(account.charges_enabled),
          stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
        },
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const orgId = sub.metadata?.orgId ?? (await orgIdForCustomer(customerId));
      if (orgId) {
        await syncSubscriptionToOrg(orgId, sub);
      } else {
        // Brand-new signup not yet materialized — create it from the pending
        // checkout metadata. No-ops unless the subscription grants access, so
        // an abandoned/expired checkout still never yields an account.
        await ensureAccountFromCheckout({ customerId, subscription: sub });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId = await orgIdForCustomer(
        typeof invoice.customer === "string" ? invoice.customer : null,
      );
      if (orgId) {
        const org = await db.organization.findUnique({ where: { id: orgId } });
        if (org && !org.pastDueSince) {
          await db.organization.update({
            where: { id: orgId },
            data: { pastDueSince: new Date(), subscriptionStatus: "past_due" },
          });
        }
      }
      break;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const orgId = await orgIdForCustomer(
        typeof invoice.customer === "string" ? invoice.customer : null,
      );
      if (orgId) {
        await db.organization.update({
          where: { id: orgId },
          data: { pastDueSince: null, status: "ACTIVE" },
        });
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
