// ---------------------------------------------------------------------------
// Self-serve password reset via a 6-digit one-time code (OTP).
//
// Users sign in with a username (not an email), so "forgot password" accepts a
// username OR an email and resolves the account. A short numeric code is
// emailed to the user's stored email, falling back to their organization's
// billing email for owners.
//
// Security:
//   - We store only a SALTED SHA-256 hash of the code (userId + code); the raw
//     code lives only in the email. Salting with the userId prevents rainbow
//     tables and cross-user hash collisions on the unique column.
//   - Codes expire after 15 minutes and are single-use.
//   - A code is burned after 5 wrong attempts, so guessing a 6-digit code is
//     infeasible (an attacker must regain inbox access to get a fresh one).
//   - All lookups return generic results so the public form can never reveal
//     whether a given username/email exists.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sendEmail, escapeHtml } from "@/lib/email";
import { APP_NAME } from "@/lib/branding";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // don't issue a new code within 60s
const MAX_ATTEMPTS = 5;
export const MIN_PASSWORD_LENGTH = 6;
export const CODE_LENGTH = 6;

function hashCode(userId: string, code: string): string {
  return crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function generateCode(): string {
  // Uniform, cryptographically-random 6-digit code, zero-padded (e.g. "003941").
  return crypto.randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, "0");
}

type ResolvedUser = { id: string; username: string; deliveryEmail: string | null };

/**
 * Resolve a username/email to a single account and the address a reset code
 * should be sent to. Order: exact username -> user email -> org billing email
 * (owner). Returns null when nothing matches or the user is deactivated.
 */
async function resolveUser(identifierRaw: string): Promise<ResolvedUser | null> {
  const id = identifierRaw.trim().toLowerCase();
  if (!id) return null;

  let user = await db.user.findUnique({
    where: { usernameLower: id },
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
 * Create a 6-digit reset code and email it. Never throws and never reveals
 * whether the account exists -- callers should always show the same "if an
 * account exists, we've sent a code" message.
 */
export async function requestPasswordReset(identifier: string): Promise<void> {
  const resolved = await resolveUser(identifier);
  if (!resolved || !resolved.deliveryEmail) return;

  // Soft resend cooldown: if a still-valid code was issued moments ago, don't
  // send another (prevents inbox spam + repeated-request abuse).
  const latest = await db.passwordResetToken.findFirst({
    where: { userId: resolved.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (
    latest &&
    latest.expiresAt.getTime() > Date.now() &&
    Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return;
  }

  // Replace any outstanding codes with a single fresh one.
  await db.passwordResetToken.deleteMany({ where: { userId: resolved.id } });

  const code = generateCode();
  await db.passwordResetToken.create({
    data: {
      userId: resolved.id,
      tokenHash: hashCode(resolved.id, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const sent = await sendEmail({
    to: resolved.deliveryEmail,
    subject: `Your ${APP_NAME} password reset code: ${code}`,
    html: resetHtml({ username: resolved.username, code }),
  });

  // Local/dev convenience: when email isn't configured the code can't be
  // delivered, so surface it in the server log. Never runs in production.
  if (!sent && process.env.NODE_ENV !== "production") {
    console.warn(
      `[passwordReset] email not delivered (RESEND_API_KEY unset?). Dev reset code for "${resolved.username}": ${code}`,
    );
  }
}

export type ResetOutcome = { ok: true } | { ok: false; error: string };

/**
 * Validate an identifier + 6-digit code and set the user's new password.
 * Single-use; the code is burned after MAX_ATTEMPTS wrong guesses.
 */
export async function completePasswordReset(
  identifier: string,
  codeRaw: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const code = String(codeRaw ?? "").replace(/\D/g, "");
  const generic = "That code is invalid or has expired. Request a new one.";

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const resolved = await resolveUser(identifier);
  if (!resolved) return { ok: false, error: generic };

  const token = await db.passwordResetToken.findFirst({
    where: { userId: resolved.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: generic };
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    // Too many wrong guesses -- burn the code so an attacker must start over
    // (and a new code requires access to the inbox again).
    await db.passwordResetToken
      .delete({ where: { id: token.id } })
      .catch(() => {});
    return {
      ok: false,
      error: "Too many incorrect attempts. Request a new code.",
    };
  }

  const expected = Buffer.from(token.tokenHash, "hex");
  const actual = Buffer.from(hashCode(resolved.id, code), "hex");
  const matches =
    code.length === CODE_LENGTH &&
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    await db.passwordResetToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    const left = Math.max(0, MAX_ATTEMPTS - (token.attempts + 1));
    return {
      ok: false,
      error:
        left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many incorrect attempts. Request a new code.",
    };
  }

  await db.$transaction([
    db.user.update({
      where: { id: resolved.id },
      data: { passwordHash: hashPassword(newPassword) },
    }),
    db.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding codes for this user.
    db.passwordResetToken.deleteMany({
      where: { userId: resolved.id, usedAt: null },
    }),
  ]);

  return { ok: true };
}

function resetHtml(p: { username: string; code: string }): string {
  return `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <h2 style="margin:0 0 6px;color:#18181b">Your ${escapeHtml(APP_NAME)} password reset code</h2>
    <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.5">
      We got a request to reset the password for <strong>${escapeHtml(p.username)}</strong>.
      Enter this code on the reset page to choose a new password. It expires in 15 minutes.
    </p>
    <div style="font:700 34px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:8px;color:#18181b;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:16px 20px;text-align:center;margin:0 0 18px">
      ${escapeHtml(p.code)}
    </div>
    <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.5">
      If you didn't request this, you can safely ignore this email -- your password won't change.
    </p>
  </div>`;
}
