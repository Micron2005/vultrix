import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { SESSION_COOKIE, makeToken } from "@/lib/auth";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { syncSubscriptionToOrg } from "@/lib/billing";

/**
 * Stripe Checkout success_url lands here. We confirm the subscription, activate
 * the business, and sign the new owner in so they land straight on their
 * dashboard. The Stripe webhook is the authoritative backstop if this misses.
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

  const orgId = session.metadata?.orgId;
  const ownerId = session.metadata?.ownerId;
  if (!orgId) {
    return NextResponse.redirect(new URL("/login", url), { status: 303 });
  }

  const subscription = session.subscription as Stripe.Subscription | null;
  if (subscription) {
    await syncSubscriptionToOrg(orgId, subscription);
  }

  // Sign the owner in if the subscription granted access; otherwise send them to
  // login with a note (e.g. payment still processing).
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (ownerId && org && org.status === "ACTIVE") {
    const res = NextResponse.redirect(new URL("/", url), { status: 303 });
    res.cookies.set(SESSION_COOKIE, makeToken(ownerId), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  const loginUrl = new URL("/login", url);
  loginUrl.searchParams.set("pending", "1");
  return NextResponse.redirect(loginUrl, { status: 303 });
}
