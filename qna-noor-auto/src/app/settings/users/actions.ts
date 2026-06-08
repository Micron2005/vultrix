"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getCurrentUser, canManageUsers, type Role } from "@/lib/session";

const ASSIGNABLE_ROLES: Role[] = ["OWNER", "ADMIN", "STAFF"];

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/settings/users${qs ? `?${qs}` : ""}`);
}

async function requireManagerOrg() {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.role)) redirect("/login");
  // Staff management on this page is scoped to a single organization.
  if (!me.orgId) back({ error: "Platform admins manage businesses elsewhere." });
  return me;
}

export async function createUser(formData: FormData) {
  const me = await requireManagerOrg();

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "STAFF") as Role;
  const role = ASSIGNABLE_ROLES.includes(roleRaw) ? roleRaw : "STAFF";

  if (!username || !/^[a-z0-9._-]{3,}$/.test(username)) {
    back({ error: "Username must be 3+ characters (letters, numbers, . _ -)." });
  }
  if (password.length < 6) {
    back({ error: "Password must be at least 6 characters." });
  }

  try {
    await db.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role,
        orgId: me.orgId,
      },
    });
  } catch (e: unknown) {
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

  revalidatePath("/settings/users");
  back({ saved: "1" });
}

export async function setUserActive(formData: FormData) {
  const me = await requireManagerOrg();
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";

  if (userId === me.id) back({ error: "You can't change your own access." });

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.orgId !== me.orgId) back({ error: "User not found." });

  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  revalidatePath("/settings/users");
  back({ saved: "1" });
}

export async function resetPassword(formData: FormData) {
  const me = await requireManagerOrg();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 6) {
    back({ error: "Password must be at least 6 characters." });
  }

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.orgId !== me.orgId) back({ error: "User not found." });

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(password) },
  });
  revalidatePath("/settings/users");
  back({ saved: "1" });
}

export async function deleteUser(formData: FormData) {
  const me = await requireManagerOrg();
  const userId = String(formData.get("userId") ?? "");

  if (userId === me.id) back({ error: "You can't delete your own login." });

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.orgId !== me.orgId) back({ error: "User not found." });

  // Never delete the last remaining owner of an organization.
  if (target.role === "OWNER") {
    const owners = await db.user.count({
      where: { orgId: me.orgId, role: "OWNER" },
    });
    if (owners <= 1) back({ error: "Can't remove the last owner." });
  }

  await db.user.delete({ where: { id: userId } });
  revalidatePath("/settings/users");
  back({ deleted: "1" });
}
