import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import {
  makeToken,
  SESSION_COOKIE,
  tokenNonce,
  userIdFromToken,
} from "./auth";
import { normalizeFocusPacks, type FocusPackId } from "./focusPacks";

export type Role = "SUPERADMIN" | "OWNER" | "ADMIN" | "STAFF";

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Platform admin",
  OWNER: "Owner",
  ADMIN: "Manager",
  STAFF: "Staff",
};

export function roleLabel(role: string): string {
  const knownLabel = ROLE_LABELS[role as Role];
  if (knownLabel) return knownLabel;
  const humanized = role.trim().replace(/[_-]+/g, " ").toLowerCase();
  return humanized
    ? humanized.charAt(0).toUpperCase() + humanized.slice(1)
    : "Unknown role";
}

export type CurrentUser = {
  id: string;
  username: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  orgStatus: string | null;
  accountType: string | null;
  features: string[];
  focusPacks: FocusPackId[];
  aiAssistantEnabled: boolean;
  aiMemoryEnabled: boolean;
  aiAssistantName: string;
  aiAssistantVoice: string | null;
  totpEnrolled: boolean;
};

export async function issueSessionToken(user: {
  id: string;
  organization: { accountType: string } | null;
}): Promise<string> {
  const token = makeToken(user.id);
  if (user.organization?.accountType === "PERSONAL") {
    const nonce = tokenNonce(token);
    if (!nonce) throw new Error("Could not read the issued session token nonce.");
    await db.user.update({
      where: { id: user.id },
      data: { sessionNonce: nonce },
    });
  }
  return token;
}

type CurrentUserResolution =
  | { user: CurrentUser }
  | { reason: "none" | "replaced" };

/**
 * Resolve the logged-in user from the session cookie. Returns null when the
 * cookie is missing/invalid, the user is deactivated, or the user's
 * organization is suspended (platform SUPERADMINs have no org and bypass that).
 */
async function resolveCurrentUser(): Promise<CurrentUserResolution> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = userIdFromToken(token);
  if (!userId) return { reason: "none" };

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user || !user.isActive) return { reason: "none" };

  if (user.role !== "SUPERADMIN") {
    if (!user.organization) return { reason: "none" };
    if (user.organization.status !== "ACTIVE") return { reason: "none" };
  }

  if (
    user.organization?.accountType === "PERSONAL" &&
    user.sessionNonce !== null &&
    tokenNonce(token) !== user.sessionNonce
  ) {
    return { reason: "replaced" };
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      orgId: user.orgId,
      orgName: user.organization?.name ?? null,
      orgStatus: user.organization?.status ?? null,
      accountType: user.organization?.accountType ?? null,
      features: user.organization?.features ?? [],
      focusPacks:
        user.organization?.accountType === "PERSONAL"
          ? normalizeFocusPacks(user.organization.focusPacks)
          : [],
      aiAssistantEnabled: user.organization?.aiAssistantEnabled ?? false,
      aiMemoryEnabled: user.aiMemoryEnabled,
      aiAssistantName: user.organization?.aiAssistantName ?? "Assistant",
      aiAssistantVoice: user.organization?.aiAssistantVoice ?? null,
      totpEnrolled: Boolean(user.totpSecret),
    },
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const resolution = await resolveCurrentUser();
  return "user" in resolution ? resolution.user : null;
}

/** Like getCurrentUser but redirects when there is no valid session. */
export async function requireUser(): Promise<CurrentUser> {
  const resolution = await resolveCurrentUser();
  if ("user" in resolution) return resolution.user;
  redirect(resolution.reason === "replaced" ? "/login?elsewhere=1" : "/login");
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
 * Require a platform SUPERADMIN (M.S.A.M Enterprise staff who manage the whole
 * platform). Anyone with an organization is a tenant user and is sent back to
 * their own dashboard, since the platform controls aren't theirs to see.
 */
export async function requireSuperadmin(options?: {
  allowUnenrolled?: boolean;
}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "SUPERADMIN") notFound();
  if (!options?.allowUnenrolled && !user.totpEnrolled) {
    redirect("/admin/security");
  }
  return user;
}
