"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import { syncSubscriptionToOrg } from "@/lib/billing";

const DAY_MS = 24 * 60 * 60 * 1000;

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/admin${qs ? `?${qs}` : ""}`);
}

/**
 * Create a new business (Organization) plus its first OWNER login in one step.
 * Platform-admin only. The owner can then sign in and add their own staff.
 */
export async function createBusiness(formData: FormData) {
  await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const usernameLower = username.toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) back({ error: "Business name is required." });
  if (!/^[a-z0-9._-]{3,}$/i.test(username)) {
    back({ error: "Owner username must be 3+ characters (letters, numbers, . _ -)." });
  }
  if (password.length < 6) {
    back({ error: "Owner password must be at least 6 characters." });
  }

  // Username is globally unique across all businesses; check before creating
  // the org so we don't leave an org with no owner login.
  const existing = await db.user.findUnique({ where: { usernameLower } });
  if (existing) back({ error: "That username is already taken." });

  const org = await db.organization.create({
    data: { name, status: "ACTIVE" },
  });

  try {
    await db.user.create({
      data: {
        username,
        usernameLower,
        passwordHash: hashPassword(password),
        role: "OWNER",
        orgId: org.id,
      },
    });
  } catch (e: unknown) {
    // Race: username taken between the check and the insert. Roll back the org
    // so we never leave a business that no one can sign in to.
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

  revalidatePath("/admin");
  back({ saved: "created" });
}

/**
 * Reset a login's password directly (platform-admin only). This is the
 * email-free recovery path: when a shop owner is locked out and email delivery
 * is unavailable, the SUPERADMIN can set a new password here and share it.
 * Access is gated behind requireSuperadmin(), so only the platform operator can
 * do it.
 */
export async function adminResetUserPassword(formData: FormData) {
  await requireSuperadmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!userId) back({ error: "Missing user." });
  if (password.length < 6) {
    back({ error: "New password must be at least 6 characters." });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) back({ error: "That login no longer exists." });

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(password) },
    }),
    // Clear any outstanding self-serve reset codes for this user.
    db.passwordResetToken.deleteMany({ where: { userId } }),
  ]);

  revalidatePath("/admin");
  back({ saved: "password-reset" });
}

/**
 * Put a business on hold (SUSPENDED) or reactivate it (ACTIVE). A suspended
 * business's users can't sign in — used when a payment fails.
 */
export async function setBusinessStatus(formData: FormData) {
  await requireSuperadmin();

  const orgId = String(formData.get("orgId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "ACTIVE" && status !== "SUSPENDED") {
    back({ error: "Unknown status." });
  }

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) back({ error: "Business not found." });

  await db.organization.update({ where: { id: orgId }, data: { status } });
  revalidatePath("/admin");
  back({ saved: status === "SUSPENDED" ? "suspended" : "reactivated" });
}

/** Rename a business (its on-screen shop name). */
export async function renameBusiness(formData: FormData) {
  await requireSuperadmin();

  const orgId = String(formData.get("orgId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back({ error: "Business name is required." });

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) back({ error: "Business not found." });

  await db.organization.update({ where: { id: orgId }, data: { name } });
  revalidatePath("/admin");
  back({ saved: "renamed" });
}

/**
 * Permanently delete a business and ALL of its data (logins, customers,
 * vehicles, repair orders, payments, inventory, …) via cascading deletes.
 * Guarded by a typed-name confirmation so it can't happen by accident.
 */
export async function deleteBusiness(formData: FormData) {
  await requireSuperadmin();

  const orgId = String(formData.get("orgId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) back({ error: "Business not found." });

  if (confirmName !== org.name) {
    back({ error: "Type the exact business name to confirm deletion." });
  }

  // RepairOrder -> Customer/Vehicle FKs are ON DELETE RESTRICT, so the cascade
  // from Organization -> Customer would fail while repair orders still point at
  // those customers. Delete the org's repair orders first (their own children
  // cascade), then drop the org (cascading the rest). One transaction so a
  // failure can't leave a half-deleted business.
  await db.$transaction([
    db.repairOrder.deleteMany({ where: { orgId } }),
    db.organization.delete({ where: { id: orgId } }),
  ]);
  revalidatePath("/admin");
  back({ saved: "deleted" });
}

/**
 * Extend a business's free trial — e.g. to honor a "2 months free" promo for a
 * customer who signed up under the old 14-day default. Superadmin only.
 *
 * `days` (default 60) and `from` ("signup" | "today") control the new trial
 * end. "signup" gives an early adopter the SAME total runway a current promo
 * signup gets (createdAt + days); "today" is more generous (now + days). We
 * never set the trial end in the past.
 *
 * Stripe is the source of truth: when the org already has a subscription we
 * push the new `trial_end` to Stripe (no proration) and mirror it back. If the
 * org has no subscription yet (signed up but never completed checkout) we just
 * set the local trial window so their access continues.
 */
export async function extendTrial(formData: FormData) {
  await requireSuperadmin();

  const orgId = String(formData.get("orgId") ?? "");
  const days = Math.max(1, Math.round(Number(formData.get("days")) || 60));
  const from = String(formData.get("from") ?? "signup");

  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) back({ error: "Business not found." });

  const base = from === "today" ? Date.now() : org.createdAt.getTime();
  let endMs = base + days * DAY_MS;
  // Guard against a trial end in the past (old signup): give at least `days`
  // from now so the extension always lands in the future.
  if (endMs <= Date.now()) endMs = Date.now() + days * DAY_MS;
  const trialEnd = new Date(endMs);

  if (org.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.update(org.stripeSubscriptionId, {
        trial_end: Math.floor(trialEnd.getTime() / 1000),
        proration_behavior: "none",
      });
      await syncSubscriptionToOrg(orgId, sub);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Stripe error";
      back({ error: `Couldn't extend the trial in Stripe: ${msg}` });
    }
  } else {
    await db.organization.update({
      where: { id: orgId },
      data: {
        subscriptionStatus: "trialing",
        trialEndsAt: trialEnd,
        status: "ACTIVE",
      },
    });
  }

  revalidatePath("/admin");
  back({ saved: "trial-extended" });
}
