import type Stripe from "stripe";
import { db } from "./db";
import { getStripe } from "./stripe";

// ---------------------------------------------------------------------------
// Billing configuration. Both monthly subscription tiers share the same free
// trial. Amounts/durations are env-configurable so prices can change without a
// code change.
// ---------------------------------------------------------------------------

/** Recurring Stripe Price id for the plan (e.g. price_123). */
export function planPriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID?.trim() || undefined;
}

/**
 * Free-trial length, in days, applied to new subscriptions.
 *
 * LIMITED-TIME PROMO: defaults to 60 days (≈2 months). To change or end the
 * promo without a code change, set BILLING_TRIAL_DAYS in the environment
 * (e.g. BILLING_TRIAL_DAYS=14 to return to the standard 2-week trial).
 */
export const TRIAL_DAYS = Number(process.env.BILLING_TRIAL_DAYS ?? 60);

/**
 * Days a subscription may stay unpaid (past_due/unpaid) before the business is
 * automatically put on hold. The daily cron enforces this.
 */
export const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS ?? 3);

/** Auto-shop monthly price in whole dollars, for display only. */
export const PRICE_USD = Number(process.env.BILLING_PRICE_USD ?? 45);
/** General-account monthly price in whole dollars, for display only. */
export const GENERAL_PRICE_USD = Number(
  process.env.BILLING_GENERAL_PRICE_USD ?? 25,
);

/**
 * Resolve the recurring Price id for an account type.
 *
 * Auto shops prefer the explicit STRIPE_PRICE_ID env var. Other account types
 * always use their tier's lookup key, so the auto-shop override cannot hijack
 * the general price. Missing prices are created on demand.
 */
export async function resolvePriceId(accountType = "AUTO_SHOP"): Promise<string> {
  const isAutoShop = accountType === "AUTO_SHOP";
  const priceUsd = isAutoShop ? PRICE_USD : GENERAL_PRICE_USD;
  const explicit = isAutoShop ? planPriceId() : undefined;
  if (explicit) return explicit;

  const stripe = getStripe();
  const lookupKey = `vultrix_monthly_${priceUsd}`;

  const found = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (found.data[0]) return found.data[0].id;

  const product = await stripe.products.create({
    name: "Vultrix subscription",
    description: "Monthly access to the Vultrix shop management platform.",
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(priceUsd * 100),
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return price.id;
}

/** Subscription statuses that grant access (trial counts as paid access). */
const ACTIVE_SUB_STATUSES = new Set(["trialing", "active"]);

export function subscriptionGrantsAccess(status: string | null): boolean {
  return status != null && ACTIVE_SUB_STATUSES.has(status);
}

/**
 * Human-readable billing summary for an organization, used in the admin list
 * and the owner billing page.
 */
export function describeBilling(org: {
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
}): string {
  switch (org.subscriptionStatus) {
    case "trialing":
      return org.trialEndsAt
        ? `Free trial · ends ${org.trialEndsAt.toLocaleDateString()}`
        : "Free trial";
    case "active":
      return org.currentPeriodEnd
        ? `Active · renews ${org.currentPeriodEnd.toLocaleDateString()}`
        : "Active";
    case "past_due":
    case "unpaid":
      return org.pastDueSince
        ? `Payment failed ${org.pastDueSince.toLocaleDateString()}`
        : "Payment failed";
    case "canceled":
      return "Canceled";
    case "incomplete":
    case "incomplete_expired":
      return "Awaiting payment";
    default:
      return "No subscription";
  }
}

/**
 * Apply a Stripe subscription's current state to its organization: keep the
 * mirrored status/dates in sync, manage the past-due timer, and flip the org's
 * access (ACTIVE/SUSPENDED) accordingly.
 *
 * Access rules:
 *  - trialing/active  → ensure ACTIVE, clear the past-due timer.
 *  - past_due/unpaid  → start the past-due timer (the cron suspends after the
 *    grace period). We do NOT suspend immediately, to allow Stripe's retries.
 *  - canceled         → suspend immediately (the customer is gone).
 */
export async function syncSubscriptionToOrg(
  orgId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const status = sub.status;
  const grantsAccess = subscriptionGrantsAccess(status);
  const periodEnd = subscriptionPeriodEnd(sub);
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) return;

  const data: {
    stripeSubscriptionId: string;
    subscriptionStatus: string;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    pastDueSince?: Date | null;
    status?: string;
  } = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: status,
    currentPeriodEnd: periodEnd,
    trialEndsAt: trialEnd,
  };

  if (grantsAccess) {
    data.pastDueSince = null;
    data.status = "ACTIVE";
  } else if (status === "past_due" || status === "unpaid") {
    // Start (but don't reset) the grace timer; the cron suspends after GRACE_DAYS.
    if (!org.pastDueSince) data.pastDueSince = new Date();
  } else if (status === "canceled" || status === "incomplete_expired") {
    data.status = "SUSPENDED";
  }

  await db.organization.update({ where: { id: orgId }, data });
}

/** The current period end of a subscription, tolerant of API shape changes. */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items?.data?.[0];
  const end = item?.current_period_end;
  return typeof end === "number" ? new Date(end * 1000) : null;
}
