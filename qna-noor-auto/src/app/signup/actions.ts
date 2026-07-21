"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { resolvePriceId, TRIAL_DAYS } from "@/lib/billing";
import { sanitizeFeatureKeys } from "@/lib/features";

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
 * Public self-serve sign-up. Validates the form, then sends the prospect to
 * Stripe Checkout to start their subscription (with a free trial). NO account
 * is created yet — the pending signup details ride along on the Stripe
 * customer's metadata and the Organization + OWNER login are materialized only
 * once checkout completes (see ensureAccountFromCheckout in @/lib/signup, hit
 * by both /api/signup/complete and the Stripe webhook). An abandoned checkout
 * therefore never yields a half-finished account or ties up a username.
 */
export async function startSignup(formData: FormData) {
  if (!billingConfigured()) {
    back({ error: "Sign-up isn't available yet. Please contact us." });
  }

  const name = String(formData.get("name") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const agreed = formData.get("agree") === "1";
  const accountTypeRaw = String(formData.get("accountType") ?? "AUTO_SHOP")
    .trim()
    .toUpperCase();
  const accountType =
    accountTypeRaw === "BUSINESS" || accountTypeRaw === "PERSONAL"
      ? accountTypeRaw
      : "AUTO_SHOP";
  const submittedFeatures = String(formData.get("features") ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const features = sanitizeFeatureKeys(accountType, submittedFeatures);
  const displayName =
    accountType === "PERSONAL" ? `${firstName} ${lastName}`.trim() : name;

  if (!agreed) {
    back({ error: "You must agree to the Terms of Service to continue." });
  }
  if (!firstName || !lastName) {
    back({ error: "First and last name are required." });
  }
  if (!displayName) {
    back({
      error:
        accountType === "PERSONAL"
          ? "First and last name are required."
          : "Business name is required.",
    });
  }
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

  // NOTE: we deliberately do NOT create the Organization / OWNER user here.
  // The account is materialized only once Stripe Checkout completes (see
  // ensureAccountFromCheckout in @/lib/signup), so an abandoned checkout never
  // leaves a half-finished account behind. The pending signup details ride
  // along on the Stripe customer's metadata (password stored hashed).
  const stripe = getStripe();
  const priceId = await resolvePriceId(accountType);

  const customer = await stripe.customers.create({
    email,
    name: displayName,
    metadata: {
      signupName: displayName,
      signupFirstName: firstName,
      signupLastName: lastName,
      signupEmail: email,
      signupPhone: phone,
      signupUsername: username,
      signupPasswordHash: hashPassword(password),
      signupAccountType: accountType,
      signupFeatures: features.join(","),
    },
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
      metadata: { pendingSignup: "1" },
    },
    metadata: { pendingSignup: "1" },
    success_url: `${root}/api/signup/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${root}/signup?canceled=1`,
  });

  if (!session.url) {
    back({ error: "Couldn't start checkout. Please try again." });
  }
  redirect(session.url);
}
