"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStripe, billingConfigured } from "@/lib/stripe";
import {
  applySubscriptionPriceToSubscription,
  priceForAccount,
} from "@/lib/billing";
import { sanitizeFeatureKeys } from "@/lib/features";
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
  if (!billingConfigured()) back({ error: "Billing isn't configured." });

  const org = await db.organization.findUnique({ where: { id: user.orgId } });
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
    planChanged &&
    org.stripeCustomerId &&
    org.stripeSubscriptionId &&
    billingConfigured()
  ) {
    const subscription = await applySubscriptionPriceToSubscription({
      orgId: org.id,
      accountType,
      subscriptionId: org.stripeSubscriptionId,
      hasInvoices: nextHasInvoices,
    });
    subscriptionStatus = subscription.status;
  }

  await db.organization.update({
    where: { id: org.id },
    data: { accountType, features: nextFeatures },
  });

  const price = priceForAccount(accountType, nextHasInvoices);
  const planLabel =
    accountType === "AUTO_SHOP"
      ? "Auto shop"
      : accountType === "BUSINESS"
        ? "Business"
        : "Personal";
  const confirmation =
    !planChanged
      ? "Billing plan saved."
      : subscriptionStatus === "trialing"
        ? `${planLabel} plan updated — free during your trial, then $${price}/month.`
        : `${planLabel} plan updated — $${price}/month starting next renewal.`;

  revalidatePath("/billing");
  revalidatePath("/settings");
  revalidatePath("/");
  redirect(`/billing?plan_saved=${encodeURIComponent(confirmation)}`);
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
