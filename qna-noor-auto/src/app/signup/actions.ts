"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { resolvePriceId, TRIAL_DAYS } from "@/lib/billing";

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/signup${qs ? `?${qs}` : ""}`);
}

async function baseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Public self-serve sign-up. Creates the business (Organization) plus its OWNER
 * login up front in a SUSPENDED/incomplete state, then sends the owner to
 * Stripe Checkout to start their subscription (with a free trial). Access is
 * granted once payment/trial is confirmed (see /api/signup/complete and the
 * Stripe webhook), so an abandoned checkout never yields a usable account.
 */
export async function startSignup(formData: FormData) {
  if (!billingConfigured()) {
    back({ error: "Sign-up isn't available yet. Please contact us." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const agreed = formData.get("agree") === "1";

  if (!agreed) {
    back({ error: "You must agree to the Terms of Service to continue." });
  }
  if (!name) back({ error: "Business name is required." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    back({ error: "Enter a valid billing email." });
  }
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    back({ error: "Username must be 3+ characters (letters, numbers, . _ -)." });
  }
  if (password.length < 6) {
    back({ error: "Password must be at least 6 characters." });
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) back({ error: "That username is already taken." });

  const org = await db.organization.create({
    data: {
      name,
      status: "SUSPENDED",
      subscriptionStatus: "incomplete",
      billingEmail: email,
    },
  });

  let ownerId: string;
  try {
    const owner = await db.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: "OWNER",
        orgId: org.id,
      },
    });
    ownerId = owner.id;
  } catch (e: unknown) {
    await db.organization.delete({ where: { id: org.id } });
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      back({ error: "That username is already taken." });
    }
    throw e;
  }

  const stripe = getStripe();
  const priceId = await resolvePriceId();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { orgId: org.id },
  });
  await db.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  const root = await baseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    // Card only: disables Stripe Link's one-click flow (the "confirm it's you"
    // SMS step) so every customer just enters their card details directly.
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    // Let customers enter a discount/promo code at checkout. Create coupons +
    // promotion codes in the Stripe dashboard whenever you want to run a deal —
    // no code change needed per discount.
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: TRIAL_DAYS > 0 ? TRIAL_DAYS : undefined,
      metadata: { orgId: org.id },
    },
    metadata: { orgId: org.id, ownerId },
    success_url: `${root}/api/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${root}/signup?canceled=1`,
  });

  if (!session.url) {
    back({ error: "Couldn't start checkout. Please try again." });
  }
  redirect(session.url);
}
