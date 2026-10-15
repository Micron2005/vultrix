"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { limitPersonalLogins } from "@/lib/personalLogins";
import { getStripe, billingConfigured } from "@/lib/stripe";
import {
  applySubscriptionPriceToSubscription,
  priceForAccount,
  resolveMusicAddonPriceId,
  restartSubscription,
  subscriptionIsDead,
} from "@/lib/billing";
import { normalizeFocusPacks } from "@/lib/focusPacks";
import { sanitizeFeatureKeys } from "@/lib/features";
import { isMusicAddonItem, MUSIC_ADDON_PRICE_USD } from "@/lib/musicAddon";
import {
  getOrCreateConnectAccount,
  createOnboardingLink,
  createDashboardLink,
} from "@/lib/connect";

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/billing${qs ? `?${qs}` : ""}`);
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
 * Open the Stripe Billing Portal so the business owner can update their card,
 * view invoices, or cancel. Owners/admins only; Stripe hosts the secure page.
 */
export async function openBillingPortal() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") back({ error: "Not allowed." });
  if (!user.orgId) back({ error: "No business on this account." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (org?.billingExempt) {
    back({ error: "This is a free account — there's nothing to bill." });
  }
  if (!billingConfigured()) back({ error: "Billing isn't configured." });
  if (!org?.stripeCustomerId) {
    back({ error: "No subscription on file for this business." });
  }

  const stripe = getStripe();
  const root = await baseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${root}/billing`,
  });
  redirect(session.url);
}

export async function updatePlan(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    back({ error: "Not allowed." });
  }
  if (!user.orgId) back({ error: "No business on this account." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) back({ error: "Business not found." });

  const requestedType = String(formData.get("accountType") ?? "").toUpperCase();
  if (!["AUTO_SHOP", "BUSINESS", "PERSONAL"].includes(requestedType)) {
    back({ error: "Choose a valid account type." });
  }

  const accountType = requestedType;
  const oldAccountType = org.accountType ?? "AUTO_SHOP";
  const oldFeatures = sanitizeFeatureKeys(oldAccountType, org.features);
  const oldHasInvoices = oldFeatures.includes("invoices");
  const requestedHasInvoices =
    formData.has("invoices")
      ? formData.get("invoices") === "yes"
      : oldHasInvoices;
  const nextFeatures = sanitizeFeatureKeys(
    accountType,
    requestedHasInvoices ? ["invoices"] : [],
  );
  const nextHasInvoices = nextFeatures.includes("invoices");
  const accountTypeChanged = accountType !== oldAccountType;
  const invoicesChanged = nextHasInvoices !== oldHasInvoices;
  const planChanged = accountTypeChanged || invoicesChanged;

  let subscriptionStatus = org.subscriptionStatus;
  if (
    !org.billingExempt &&
    org.stripeCustomerId &&
    org.stripeSubscriptionId &&
    billingConfigured()
  ) {
    try {
      const subscription = await applySubscriptionPriceToSubscription({
        orgId: org.id,
        accountType,
        subscriptionId: org.stripeSubscriptionId,
        hasInvoices: nextHasInvoices,
      });
      subscriptionStatus = subscription.status;
    } catch (err) {
      console.error("Plan price sync failed:", err, {
        accountType,
        orgId: org.id,
      });
      const message = err instanceof Error ? err.message : String(err);
      back({ error: `Could not update the subscription price: ${message}` });
    }
  }

  await db.organization.update({
    where: { id: org.id },
    data: {
      accountType,
      features: nextFeatures,
    },
  });
  if (accountTypeChanged && accountType === "PERSONAL") {
    await limitPersonalLogins(org.id);
  }

  const price = priceForAccount(accountType, nextHasInvoices);
  const planLabel =
    accountType === "AUTO_SHOP"
      ? "Auto shop"
      : accountType === "BUSINESS"
        ? "Business"
        : "Personal";
  const confirmation = org.billingExempt
    ? `${planLabel} plan updated — free account, never billed.`
    : !planChanged
      ? "Billing plan saved."
      : subscriptionStatus === "trialing"
        ? `${planLabel} plan updated — free during your trial, then $${price}/month.`
        : `${planLabel} plan updated — $${price}/month starting next renewal.`;

  revalidatePath("/billing");
  revalidatePath("/settings");
  revalidatePath("/");
  redirect(`/billing?plan_saved=${encodeURIComponent(confirmation)}`);
}

export async function enableMusicAddon() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    back({ error: "Not allowed." });
  }
  if (!user.orgId) back({ error: "No business on this account." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) back({ error: "Business not found." });

  const focusPacks = normalizeFocusPacks([...org.focusPacks, "music"]);
  if (org.billingExempt) {
    await db.organization.update({
      where: { id: org.id },
      data: { musicAddon: true, focusPacks },
    });
    revalidatePath("/billing");
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    revalidatePath("/songs");
    back({ music_saved: "Music is included with your free account." });
  }

  if (!org.stripeCustomerId) {
    back({ error: "Contact support to set up billing for this account." });
  }
  if (!org.stripeSubscriptionId) {
    back({ error: "Start a subscription first." });
  }
  if (!billingConfigured()) {
    back({ error: "Billing isn't configured on this server." });
  }

  const stripe = getStripe();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    back({ error: `Couldn't load the subscription: ${message}` });
  }
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    back({ error: "Start or restart a subscription first." });
  }

  try {
    if (!subscription.items.data.some(isMusicAddonItem)) {
      const price = await resolveMusicAddonPriceId();
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price,
        proration_behavior: "none",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    back({ error: `Couldn't add the Music add-on: ${message}` });
  }

  await db.organization.update({
    where: { id: org.id },
    data: { musicAddon: true, focusPacks },
  });
  revalidatePath("/billing");
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  revalidatePath("/songs");
  back({
    music_saved:
      subscription.status === "trialing"
        ? `Music add-on enabled — free during your trial, then $${MUSIC_ADDON_PRICE_USD}/month.`
        : `Music add-on enabled — $${MUSIC_ADDON_PRICE_USD}/month on your subscription.`,
  });
}

export async function disableMusicAddon() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    back({ error: "Not allowed." });
  }
  if (!user.orgId) back({ error: "No business on this account." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) back({ error: "Business not found." });

  if (!org.billingExempt && org.stripeSubscriptionId) {
    if (!billingConfigured()) {
      back({ error: "Billing isn't configured on this server." });
    }
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(
        org.stripeSubscriptionId,
      );
      const addonItem = subscription.items.data.find(isMusicAddonItem);
      if (addonItem && !subscriptionIsDead(subscription.status)) {
        await stripe.subscriptionItems.del(addonItem.id, {
          proration_behavior: "none",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      back({ error: `Couldn't remove the Music add-on: ${message}` });
    }
  }

  await db.organization.update({
    where: { id: org.id },
    data: { musicAddon: false },
  });
  revalidatePath("/billing");
  revalidatePath("/", "layout");
  revalidatePath("/songs");
  back({ music_saved: "Music add-on removed. Your Songs data is unchanged." });
}

export async function restartOwnSubscription() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    back({ error: "Not allowed." });
  }
  if (!user.orgId) back({ error: "No business on this account." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) back({ error: "Business not found." });
  if (org.billingExempt) {
    back({ error: "This is a free account — there's nothing to bill." });
  }
  if (!org.stripeCustomerId || !subscriptionIsDead(org.subscriptionStatus)) {
    back({ error: "There is no canceled subscription to restart." });
  }

  try {
    await restartSubscription(org.id, org.trialEndsAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    back({ error: `Couldn't restart the subscription: ${message}` });
  }
  back({ plan_saved: "Subscription restarted." });
}

/**
 * Start (or resume) Stripe Connect onboarding so this shop can accept card
 * payments from its own customers. Creates the connected account on first use,
 * then sends the owner to Stripe's hosted onboarding to enter their business +
 * bank details. Owners/admins only.
 */
export async function startConnectOnboarding() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") back({ error: "Not allowed." });
  if (!user.orgId) back({ error: "No business on this account." });
  if (!billingConfigured()) back({ error: "Payments aren't configured on this server." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) back({ error: "Business not found." });

  const root = await baseUrl();
  let url: string;
  try {
    const accountId = await getOrCreateConnectAccount({
      id: org.id,
      name: org.name,
      billingEmail: org.billingEmail,
      stripeConnectAccountId: org.stripeConnectAccountId,
    });
    url = await createOnboardingLink(
      accountId,
      `${root}/billing?connect=refresh`,
      `${root}/billing?connect=return`,
    );
  } catch (err) {
    console.error("Stripe Connect onboarding failed:", err);
    back({
      error:
        "Couldn't start payment setup. Online payments may not be enabled on this account yet — please try again later or contact support.",
    });
  }
  redirect(url);
}

/**
 * Open the connected account's Stripe Express dashboard (to see payouts, manage
 * their bank, view payments). Owners/admins only.
 */
export async function openConnectDashboard() {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") back({ error: "Not allowed." });
  if (!user.orgId) back({ error: "No business on this account." });
  if (!billingConfigured()) back({ error: "Payments aren't configured on this server." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org?.stripeConnectAccountId) {
    back({ error: "Set up payments first." });
  }

  let url: string;
  try {
    url = await createDashboardLink(org.stripeConnectAccountId);
  } catch (err) {
    console.error("Stripe Connect dashboard link failed:", err);
    back({ error: "Couldn't open your Stripe dashboard. Please try again." });
  }
  redirect(url);
}
