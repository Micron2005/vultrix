import type Stripe from "stripe";
import { db } from "./db";
import { getStripe } from "./stripe";

// ---------------------------------------------------------------------------
// Billing configuration. Every account type is billed monthly on the same free
// trial. Prices are env-configurable so they can change without a code change,
// and the recurring Stripe Price for each tier is created/reused automatically
// by resolvePriceId() (keyed by amount) — no manual Price wiring required.
// ---------------------------------------------------------------------------

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
export const PRICE_USD = Number(process.env.BILLING_PRICE_USD ?? 35);
/** General-account monthly price in whole dollars, for display only. */
export const GENERAL_PRICE_USD = Number(
  process.env.BILLING_GENERAL_PRICE_USD ?? 25,
);
/** Personal-account monthly price without the invoices feature. */
export const PERSONAL_BASIC_PRICE_USD = Number(
  process.env.BILLING_PERSONAL_PRICE_USD ?? 15,
);
/** Hosted assistant add-on price for Personal accounts, in whole dollars. */
export const PERSONAL_AI_ADDON_USD = Number(
  process.env.BILLING_PERSONAL_AI_ADDON_USD ?? 10,
);

export function priceForAccount(
  accountType = "AUTO_SHOP",
  hasInvoices = true,
  aiHosted = false,
): number {
  if (accountType === "AUTO_SHOP") return PRICE_USD;
  const basePrice =
    accountType === "PERSONAL" && !hasInvoices
      ? PERSONAL_BASIC_PRICE_USD
      : GENERAL_PRICE_USD;
  return accountType === "PERSONAL" && aiHosted
    ? basePrice + PERSONAL_AI_ADDON_USD
    : basePrice;
}

/**
 * Resolve the recurring Price id for an account type.
 *
 * Every tier uses a lookup key derived from its monthly amount, so the correct
 * Stripe Price is found (or created once on demand) automatically. No manual
 * Price/env wiring is required — changing the amount constants is enough.
 */
export async function resolvePriceId(
  accountType = "AUTO_SHOP",
  hasInvoices = true,
  aiHosted = false,
): Promise<string> {
  const priceUsd = priceForAccount(accountType, hasInvoices, aiHosted);

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
    description: "Monthly access to the Vultrix platform.",
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

/**
 * Swap a personal account's subscription between the invoice and basic tiers.
 * Stripe keeps the existing trial and billing cycle; proration is disabled so
 * the new amount applies at the next renewal instead of charging immediately.
 */
export async function applyInvoiceTierToSubscription(opts: {
  orgId: string;
  accountType: string;
  subscriptionId: string;
  hasInvoices: boolean;
  aiHosted?: boolean;
}): Promise<Stripe.Subscription> {
  return applySubscriptionPriceToSubscription(opts);
}

/**
 * Swap a subscription to the price for its account type and invoice choice.
 * Stripe preserves the current trial and billing cycle because only the
 * recurring item's price is changed with proration disabled.
 */
export async function applySubscriptionPriceToSubscription(opts: {
  orgId: string;
  accountType: string;
  subscriptionId: string;
  hasInvoices: boolean;
  aiHosted?: boolean;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    opts.subscriptionId,
  );
  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no recurring item.");

  const priceId = await resolvePriceId(
    opts.accountType,
    opts.hasInvoices,
    opts.aiHosted,
  );
  if (item.price.id === priceId) {
    await syncSubscriptionToOrg(opts.orgId, subscription);
    return subscription;
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: "none",
  });
  await syncSubscriptionToOrg(opts.orgId, updated);
  return updated;
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
