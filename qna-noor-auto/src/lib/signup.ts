// Account materialization for self-serve signup.
//
// IMPORTANT: a business account (Organization + OWNER User) is created ONLY
// after the customer completes Stripe Checkout — i.e. they got past the payment
// page and a subscription that grants access (trialing/active) exists. The
// pending signup details (business name, email, username, hashed password) ride
// along on the Stripe customer's metadata until then. This guarantees an
// abandoned checkout never leaves a half-finished account behind (which used to
// tie up usernames and create duplicates to clean up).
//
// Both the Checkout success redirect (/api/signup/complete) and the Stripe
// webhook call ensureAccountFromCheckout(); it is idempotent (anchored on the
// unique stripeCustomerId), so exactly one account is created and the welcome /
// notification emails are sent exactly once.

import type Stripe from "stripe";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  syncSubscriptionToOrg,
  subscriptionGrantsAccess,
  TRIAL_DAYS,
} from "@/lib/billing";
import { sendEmail, escapeHtml } from "@/lib/email";
import { APP_NAME } from "@/lib/branding";

export type EnsureResult = {
  orgId: string;
  ownerId: string;
  isNew: boolean;
} | null;

type Pending = {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
};

function isUniqueViolation(e: unknown): boolean {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function pendingFromMetadata(
  md: Stripe.Metadata | null | undefined,
): Pending | null {
  const m = md ?? {};
  const username = String(m.signupUsername ?? "").trim().toLowerCase();
  const email = String(m.signupEmail ?? "").trim().toLowerCase();
  const passwordHash = String(m.signupPasswordHash ?? "");
  const name = String(m.signupName ?? "").trim();
  if (!username || !email || !passwordHash) return null;
  return { name: name || email, username, email, passwordHash };
}

async function findOwner(orgId: string): Promise<string | null> {
  const owner = await db.user.findFirst({
    where: { orgId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? null;
}

/**
 * Create the account from a completed checkout, or return the existing one.
 * Anchored on the unique Organization.stripeCustomerId so concurrent calls
 * (success redirect + webhook) never duplicate.
 */
export async function ensureAccountFromCheckout(opts: {
  customerId: string | null;
  subscription: Stripe.Subscription | null;
}): Promise<EnsureResult> {
  const { customerId, subscription } = opts;
  if (!customerId) return null;

  // Already materialized?
  const existing = await db.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (existing) {
    if (subscription) await syncSubscriptionToOrg(existing.id, subscription);
    const ownerId = await findOwner(existing.id);
    return ownerId ? { orgId: existing.id, ownerId, isNew: false } : null;
  }

  // Only create once the customer truly got through payment.
  if (!subscription || !subscriptionGrantsAccess(subscription.status)) {
    return null;
  }

  // Read the pending signup the start action stashed on the customer.
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return null;
  const pending = pendingFromMetadata((customer as Stripe.Customer).metadata);
  if (!pending) {
    // A concurrent call may have just materialized it (and cleared metadata).
    const raced = await db.organization.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (raced) {
      await syncSubscriptionToOrg(raced.id, subscription);
      const ownerId = await findOwner(raced.id);
      return ownerId ? { orgId: raced.id, ownerId, isNew: false } : null;
    }
    return null;
  }

  return materializeAccount(pending, customerId, subscription);
}

/**
 * The DB-creation core (also unit-testable without Stripe). Creates the org +
 * owner, syncs the subscription, clears the pending metadata, and fires the
 * welcome + owner-notification emails — only when a brand-new account is made.
 */
export async function materializeAccount(
  pending: Pending,
  customerId: string,
  subscription: Stripe.Subscription,
): Promise<EnsureResult> {
  // 1. Organization (idempotent on the unique stripeCustomerId).
  let orgId: string;
  try {
    const org = await db.organization.create({
      data: {
        name: pending.name,
        status: "ACTIVE",
        subscriptionStatus: subscription.status,
        billingEmail: pending.email,
        stripeCustomerId: customerId,
      },
      select: { id: true },
    });
    orgId = org.id;
  } catch (e) {
    if (isUniqueViolation(e)) {
      const raced = await db.organization.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (raced) {
        await syncSubscriptionToOrg(raced.id, subscription);
        const ownerId = await findOwner(raced.id);
        return ownerId ? { orgId: raced.id, ownerId, isNew: false } : null;
      }
    }
    throw e;
  }

  // 2. OWNER user. On the (rare) race where someone else already claimed the
  //    username, append a numeric suffix so the paying customer still gets in.
  let ownerId: string | null = null;
  let finalUsername = pending.username;
  for (let attempt = 0; attempt <= 20; attempt++) {
    const candidate =
      attempt === 0 ? pending.username : `${pending.username}${attempt}`;
    try {
      const owner = await db.user.create({
        data: {
          username: candidate,
          // Store the signup email so the owner can reset their own password.
          email: pending.email,
          passwordHash: pending.passwordHash,
          role: "OWNER",
          orgId,
        },
        select: { id: true },
      });
      ownerId = owner.id;
      finalUsername = candidate;
      break;
    } catch (e) {
      if (isUniqueViolation(e)) continue; // username taken — try next suffix
      // Don't leave an orphan org with no owner.
      await db.organization.delete({ where: { id: orgId } }).catch(() => {});
      throw e;
    }
  }
  if (!ownerId) {
    await db.organization.delete({ where: { id: orgId } }).catch(() => {});
    throw new Error("Could not allocate a unique username for the new owner.");
  }

  // 3. Mirror the subscription's status / dates onto the org.
  await syncSubscriptionToOrg(orgId, subscription);

  // 4. Best-effort: clear the pending signup (incl. the password hash) from
  //    Stripe now that it's persisted in our DB.
  try {
    await getStripe().customers.update(customerId, { metadata: { orgId } });
  } catch {
    /* non-fatal */
  }

  // 5. Welcome + owner-notification emails (only on a brand-new account).
  try {
    await sendSignupEmails({
      name: pending.name,
      email: pending.email,
      username: finalUsername,
      subscription,
    });
  } catch (e) {
    console.error("[signup] email error:", e);
  }

  return { orgId, ownerId, isNew: true };
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://vultrix.net"
  );
}

function trialEndDate(sub: Stripe.Subscription): Date | null {
  return sub.trial_end ? new Date(sub.trial_end * 1000) : null;
}

async function sendSignupEmails(args: {
  name: string;
  email: string;
  username: string;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const { name, email, username, subscription } = args;
  const loginUrl = `${baseUrl()}/login`;
  const trialEnd = trialEndDate(subscription);

  // 1. Thank-you / welcome to the new shop owner.
  await sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME} 🔧`,
    html: welcomeHtml({ name, username, loginUrl, trialEnd }),
  });

  // 2. Notify the platform owner that a new shop signed up.
  const notify =
    process.env.SIGNUP_NOTIFY_EMAIL || process.env.LEADS_NOTIFY_EMAIL;
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `New ${APP_NAME} signup: ${name}`,
      html: ownerNotifyHtml({ name, email, username, trialEnd }),
      replyTo: email,
    });
  }
}

function welcomeHtml(p: {
  name: string;
  username: string;
  loginUrl: string;
  trialEnd: Date | null;
}): string {
  const trialLine = p.trialEnd
    ? `Your ${TRIAL_DAYS}-day free trial is active — you won't be charged until ${p.trialEnd.toLocaleDateString()}.`
    : `Your subscription is active.`;
  return `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <h2 style="margin:0 0 6px;color:#18181b">Welcome to ${escapeHtml(APP_NAME)}, ${escapeHtml(p.name)} 🔧</h2>
    <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.5">
      Your shop is all set up. ${escapeHtml(trialLine)}
    </p>
    <table style="border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:4px 16px 4px 0;color:#71717a;font:14px sans-serif">Username</td>
          <td style="padding:4px 0;color:#18181b;font:14px sans-serif"><strong>${escapeHtml(p.username)}</strong></td></tr>
    </table>
    <a href="${p.loginUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font:600 15px sans-serif;padding:11px 20px;border-radius:8px">
      Sign in to your dashboard
    </a>
    <p style="margin:22px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5">
      Need a hand getting started? Just reply to this email — a real person (a working mechanic) will help.
    </p>
  </div>`;
}

function ownerNotifyHtml(p: {
  name: string;
  email: string;
  username: string;
  trialEnd: Date | null;
}): string {
  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:4px 16px 4px 0;color:#71717a;font:14px sans-serif;white-space:nowrap">${label}</td><td style="padding:4px 0;color:#18181b;font:14px sans-serif">${escapeHtml(value)}</td></tr>`
      : "";
  return `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <h2 style="margin:0 0 4px;color:#18181b">New ${escapeHtml(APP_NAME)} shop signed up 🎉</h2>
    <p style="margin:0 0 16px;color:#71717a;font-size:14px">A new business just completed checkout and activated their account.</p>
    <table style="border-collapse:collapse">
      ${row("Business", p.name)}
      ${row("Email", p.email)}
      ${row("Username", p.username)}
      ${row("Trial ends", p.trialEnd ? p.trialEnd.toLocaleDateString() : "")}
    </table>
    <p style="margin-top:20px;color:#a1a1aa;font-size:12px">Reply to this email to reach ${escapeHtml(p.email)} directly.</p>
  </div>`;
}
