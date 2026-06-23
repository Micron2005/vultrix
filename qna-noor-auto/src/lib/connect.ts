import type Stripe from "stripe";
import { db } from "./db";
import { getStripe } from "./stripe";
import { computeRoTotal, computeRoPaid } from "./roTotal";

// ---------------------------------------------------------------------------
// Stripe Connect: lets each business (an Organization) accept card payments
// from its own customers. Each shop gets its own connected Stripe account; the
// platform never holds the funds. Payments are direct charges on the connected
// account with no application fee, so the shop is the merchant of record and
// money pays out to the shop's bank.
// ---------------------------------------------------------------------------

type ConnectOrg = {
  id: string;
  name: string;
  billingEmail: string | null;
  stripeConnectAccountId: string | null;
};

/**
 * Return the org's connected account id, creating an Express account on first
 * use and persisting it. Express accounts are Stripe-hosted: the shop provides
 * its own business + bank details during onboarding.
 */
export async function getOrCreateConnectAccount(org: ConnectOrg): Promise<string> {
  if (org.stripeConnectAccountId) return org.stripeConnectAccountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email: org.billingEmail ?? undefined,
    business_profile: { name: org.name },
    metadata: { orgId: org.id },
  });

  await db.organization.update({
    where: { id: org.id },
    data: { stripeConnectAccountId: account.id },
  });
  return account.id;
}

/**
 * Create a one-time Stripe-hosted onboarding link for the connected account.
 * `refreshUrl` is hit if the link expires; `returnUrl` when the shop finishes.
 */
export async function createOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** A login link to the connected account's Express dashboard. */
export async function createDashboardLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

/**
 * Pull the latest capability status from Stripe and mirror it onto the org so
 * the UI (and the customer Pay button) reflect whether the shop can take money.
 */
export async function refreshConnectStatus(
  orgId: string,
  accountId: string,
): Promise<{ chargesEnabled: boolean; detailsSubmitted: boolean }> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  const chargesEnabled = Boolean(account.charges_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  await db.organization.update({
    where: { id: orgId },
    data: {
      stripeConnectChargesEnabled: chargesEnabled,
      stripeConnectDetailsSubmitted: detailsSubmitted,
    },
  });
  return { chargesEnabled, detailsSubmitted };
}

/**
 * Apply a single online card payment to one repair order, idempotently. The
 * `reference` is the dedupe key (the PaymentIntent id, optionally suffixed with
 * the RO id for bulk payments) so a payment is never double-recorded. Auto-flips
 * the RO to PAID once its balance is covered.
 */
async function applyOnlinePayment(
  orgId: string,
  repairOrderId: string,
  amount: number,
  reference: string,
): Promise<void> {
  if (amount <= 0) return;

  // Dedupe: skip if this payment was already recorded.
  const existing = await db.payment.findFirst({
    where: { repairOrderId, reference },
    select: { id: true },
  });
  if (existing) return;

  // Make sure the RO actually belongs to this org before touching it.
  const ro = await db.repairOrder.findFirst({
    where: { id: repairOrderId, orgId },
    select: { id: true, status: true, invoicedAt: true },
  });
  if (!ro) return;

  await db.payment.create({
    data: {
      orgId,
      repairOrderId,
      amount,
      method: "CARD",
      reference,
      note: "Online payment",
    },
  });

  const [total, paid] = await Promise.all([
    computeRoTotal(orgId, repairOrderId),
    computeRoPaid(repairOrderId),
  ]);

  const data: Record<string, unknown> = {};
  if (ro.status === "ESTIMATE" || ro.status === "IN_PROGRESS" || ro.status === "COMPLETED") {
    data.status = "INVOICED";
    if (!ro.invoicedAt) data.invoicedAt = new Date();
  }
  if (paid + 0.005 >= total && ro.status !== "PAID" && ro.status !== "CANCELLED") {
    data.status = "PAID";
    data.paidAt = new Date();
    data.closedAt = new Date();
  }
  if (Object.keys(data).length > 0) {
    await db.repairOrder.update({ where: { id: repairOrderId, orgId }, data });
  }
}

function paymentIntentIdOf(session: Stripe.Checkout.Session): string {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? session.id);
}

/**
 * Record a successful online (Stripe Checkout) customer payment against its
 * repair order, idempotently. Safe to call from both the Stripe webhook and the
 * post-checkout redirect — the PaymentIntent id is used as a dedupe key so a
 * payment is never double-recorded. Auto-flips the RO to PAID when covered.
 */
export async function recordOnlinePayment(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const orgId = session.metadata?.orgId;
  if (!orgId) return;

  // A bulk payment covers several invoices at once; record each individually.
  // `alloc` is the legacy metadata format kept for sessions created before this
  // change deployed; `bulk` is the current format.
  if (session.metadata?.bulk === "1" || session.metadata?.alloc) {
    await recordBulkOnlinePayment(session);
    return;
  }

  const repairOrderId = session.metadata?.repairOrderId;
  if (!repairOrderId) return;

  const amount = Math.round((session.amount_total ?? 0)) / 100;
  await applyOnlinePayment(
    orgId,
    repairOrderId,
    amount,
    paymentIntentIdOf(session),
  );
}

/**
 * Record a successful bulk online payment that covered every outstanding invoice
 * for a customer in one Checkout. The amount paid is split across the customer's
 * invoices (oldest first, capped at each balance) — recomputed here rather than
 * carried in metadata so it works for any number of invoices. The dedupe key
 * combines the PaymentIntent id with the RO id so re-delivery (webhook +
 * redirect) never double-records, and the split self-heals on retry.
 */
export async function recordBulkOnlinePayment(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const orgId = session.metadata?.orgId;
  if (!orgId) return;

  const paymentIntentId = paymentIntentIdOf(session);

  // Legacy format: an explicit per-invoice allocation was stored in metadata.
  // Kept so bulk sessions created before this change deployed still record.
  const rawAlloc = session.metadata?.alloc;
  if (rawAlloc) {
    let alloc: { r?: string; a?: number }[];
    try {
      alloc = JSON.parse(rawAlloc);
    } catch {
      return;
    }
    if (!Array.isArray(alloc)) return;
    for (const entry of alloc) {
      if (!entry?.r || typeof entry.a !== "number") continue;
      await applyOnlinePayment(
        orgId,
        entry.r,
        entry.a,
        `${paymentIntentId}:${entry.r}`,
      );
    }
    return;
  }

  const customerId = session.metadata?.customerId;
  if (!customerId) return;

  let remaining = Math.round(session.amount_total ?? 0) / 100;
  if (remaining <= 0) return;

  // Only invoices that existed when the customer started checkout are covered by
  // this charge, so a newer invoice can never be paid with this payment.
  const createdAt = session.created ? new Date(session.created * 1000) : new Date();
  const ros = await db.repairOrder.findMany({
    where: {
      customerId,
      orgId,
      status: "INVOICED",
      invoicedAt: { lte: createdAt },
    },
    select: { id: true },
    orderBy: { invoicedAt: "asc" },
  });

  for (const ro of ros) {
    if (remaining <= 0.005) break;
    const [total, paid] = await Promise.all([
      computeRoTotal(orgId, ro.id),
      computeRoPaid(ro.id),
    ]);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
    if (balance <= 0) continue;
    const amount = Math.min(balance, remaining);
    await applyOnlinePayment(orgId, ro.id, amount, `${paymentIntentId}:${ro.id}`);
    remaining = Math.round((remaining - amount) * 100) / 100;
  }
}
