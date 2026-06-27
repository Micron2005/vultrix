// ---------------------------------------------------------------------------
// Self-serve password reset.
//
// Users sign in with a username (not an email), so "forgot password" accepts a
// username OR an email and resolves the account. Reset links are delivered to
// the user's stored email, falling back to their organization's billing email
// for owners. We store only a SHA-256 hash of each single-use token (the raw
// token lives only in the emailed link) and tokens expire after one hour.
//
// All lookups return generic results to the caller so the public form can never
// reveal whether a given username/email exists.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendEmail, escapeHtml } from "@/lib/email";
import { APP_NAME } from "@/lib/branding";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const MIN_PASSWORD_LENGTH = 6;

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://vultrix.net"
  );
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

type ResolvedUser = { id: string; username: string; deliveryEmail: string | null };

/**
 * Resolve a username/email to a single account and the address a reset link
 * should be sent to. Order: exact username → user email → org billing email
 * (owner). Returns null when nothing matches or the user is deactivated.
 */
async function resolveUser(identifierRaw: string): Promise<ResolvedUser | null> {
  const id = identifierRaw.trim().toLowerCase();
  if (!id) return null;

  let user = await db.user.findUnique({
    where: { username: id },
    include: { organization: true },
  });

  if (!user) {
    user = await db.user.findFirst({
      where: { email: id },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!user) {
    const org = await db.organization.findFirst({
      where: { billingEmail: id },
      select: { id: true },
    });
    if (org) {
      user = await db.user.findFirst({
        where: { orgId: org.id, role: "OWNER" },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  if (!user || !user.isActive) return null;

  const deliveryEmail =
    user.email?.trim() ||
    (user.role === "OWNER"
      ? user.organization?.billingEmail?.trim() || null
      : null) ||
    null;

  return { id: user.id, username: user.username, deliveryEmail };
}

/**
 * Create a reset token and email a reset link. Never throws and never reveals
 * whether the account exists — callers should always show the same "if an
 * account exists, we've sent an email" message.
 */
export async function requestPasswordReset(identifier: string): Promise<void> {
  const resolved = await resolveUser(identifier);
  if (!resolved || !resolved.deliveryEmail) return;

  // Replace any outstanding tokens with a single fresh one.
  await db.passwordResetToken.deleteMany({
    where: { userId: resolved.id, usedAt: null },
  });

  const raw = crypto.randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: {
      userId: resolved.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${baseUrl()}/reset-password?token=${encodeURIComponent(raw)}`;
  const sent = await sendEmail({
    to: resolved.deliveryEmail,
    subject: `Reset your ${APP_NAME} password`,
    html: resetHtml({ username: resolved.username, link }),
  });

  // Local/dev convenience: when email isn't configured the link can't be
  // delivered, so surface it in the server log. Never runs in production.
  if (!sent && process.env.NODE_ENV !== "production") {
    console.warn(
      `[passwordReset] email not delivered (RESEND_API_KEY unset?). Dev reset link for "${resolved.username}": ${link}`,
    );
  }
}

/** True when a raw token is unused and not yet expired. */
export async function isResetTokenValid(raw: string): Promise<boolean> {
  if (!raw) return false;
  const t = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  return !!t && t.usedAt === null && t.expiresAt.getTime() > Date.now();
}

export type ResetOutcome = { ok: true } | { ok: false; error: string };

/** Validate a token and set the user's new password (single use). */
export async function completePasswordReset(
  raw: string,
  newPassword: string,
): Promise<ResetOutcome> {
  if (!raw) return { ok: false, error: "This reset link is invalid." };
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const token = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
    return {
      ok: false,
      error:
        "This reset link has expired or already been used. Request a new one.",
    };
  }

  await db.$transaction([
    db.user.update({
      where: { id: token.userId },
      data: { passwordHash: hashPassword(newPassword) },
    }),
    db.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for this user.
    db.passwordResetToken.deleteMany({
      where: { userId: token.userId, usedAt: null },
    }),
  ]);

  return { ok: true };
}

function resetHtml(p: { username: string; link: string }): string {
  return `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <h2 style="margin:0 0 6px;color:#18181b">Reset your ${escapeHtml(APP_NAME)} password</h2>
    <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.5">
      We got a request to reset the password for <strong>${escapeHtml(p.username)}</strong>.
      Click the button below to choose a new password. This link expires in 1 hour.
    </p>
    <a href="${p.link}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;font:600 15px sans-serif;padding:11px 20px;border-radius:8px">
      Reset my password
    </a>
    <p style="margin:22px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5">
      If you didn't request this, you can safely ignore this email — your password won't change.
    </p>
  </div>`;
}
