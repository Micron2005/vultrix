import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { SESSION_COOKIE, makeToken } from "@/lib/auth";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { ensureAccountFromCheckout } from "@/lib/signup";

/**
 * Stripe Checkout success_url lands here. The account is materialized now that
 * the customer got past payment (idempotent — the webhook is the authoritative
 * backstop if this request is missed), then the new owner is signed in so they
 * land straight on their dashboard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!billingConfigured() || !sessionId) {
    return NextResponse.redirect(new URL("/login", url), { status: 303 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);
  const subscription = (session.subscription as Stripe.Subscription | null) ?? null;

  const result = await ensureAccountFromCheckout({ customerId, subscription });

  // Sign the owner in if access was granted; otherwise send them to login with
  // a note (e.g. payment still processing).
  if (result) {
    const org = await db.organization.findUnique({
      where: { id: result.orgId },
      select: { status: true },
    });
    if (org && org.status === "ACTIVE") {
      const res = NextResponse.redirect(new URL("/", url), { status: 303 });
      res.cookies.set(SESSION_COOKIE, makeToken(result.ownerId), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("pending", "1");
  return NextResponse.redirect(loginUrl, { status: 303 });
}
