import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, userIdFromToken } from "./auth";

export type Role = "SUPERADMIN" | "OWNER" | "ADMIN" | "STAFF";

export type CurrentUser = {
  id: string;
  username: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  orgStatus: string | null;
};

/**
 * Resolve the logged-in user from the session cookie. Returns null when the
 * cookie is missing/invalid, the user is deactivated, or the user's
 * organization is suspended (platform SUPERADMINs have no org and bypass that).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const userId = userIdFromToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user || !user.isActive) return null;

  if (user.role !== "SUPERADMIN") {
    if (!user.organization) return null;
    if (user.organization.status !== "ACTIVE") return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role as Role,
    orgId: user.orgId,
    orgName: user.organization?.name ?? null,
    orgStatus: user.organization?.status ?? null,
  };
}

/** Like getCurrentUser but redirects to /login when there's no valid session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function canManageUsers(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Resolve the current user's organization id, for data-isolation scoping.
 *
 * Every business only ever sees its own data, so all tenant queries are scoped
 * by this orgId. Redirects to /login when there's no session. Platform
 * SUPERADMINs have no organization and are sent to /admin (the platform
 * controls they manage), since data pages are meaningless without an org.
 */
export async function requireOrgId(): Promise<string> {
  const user = await requireUser();
  if (!user.orgId) {
    // SUPERADMIN (platform owner) — no business data to show.
    redirect("/admin");
  }
  return user.orgId;
}

/**
 * Require a platform SUPERADMIN (M.S.A.M Industries staff who manage the whole
 * platform). Anyone with an organization is a tenant user and is sent back to
 * their own dashboard, since the platform controls aren't theirs to see.
 */
export async function requireSuperadmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "SUPERADMIN") redirect("/");
  return user;
}
