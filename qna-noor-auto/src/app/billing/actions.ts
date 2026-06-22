"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getStripe, billingConfigured } from "@/lib/stripe";
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
  const accountId = await getOrCreateConnectAccount({
    id: org.id,
    name: org.name,
    billingEmail: org.billingEmail,
    stripeConnectAccountId: org.stripeConnectAccountId,
  });
  const url = await createOnboardingLink(
    accountId,
    `${root}/billing?connect=refresh`,
    `${root}/billing?connect=return`,
  );
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

  const url = await createDashboardLink(org.stripeConnectAccountId);
  redirect(url);
}
