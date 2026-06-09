"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/session";

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
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) back({ error: "Business name is required." });
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    back({ error: "Owner username must be 3+ characters (letters, numbers, . _ -)." });
  }
  if (password.length < 6) {
    back({ error: "Owner password must be at least 6 characters." });
  }

  // Username is globally unique across all businesses; check before creating
  // the org so we don't leave an org with no owner login.
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) back({ error: "That username is already taken." });

  const org = await db.organization.create({
    data: { name, status: "ACTIVE" },
  });

  try {
    await db.user.create({
      data: {
        username,
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

  await db.organization.delete({ where: { id: orgId } });
  revalidatePath("/admin");
  back({ saved: "deleted" });
}
