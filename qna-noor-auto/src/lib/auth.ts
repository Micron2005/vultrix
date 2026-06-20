import { cookies } from "next/headers";
import crypto from "node:crypto";

// Pure auth primitives (no database access) so this module is safe to import
// from the proxy/edge runtime. Database-backed helpers like getCurrentUser live
// in ./session.ts.

export const SESSION_COOKIE = "noor_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.APP_PASSWORD ||
    "dev-secret-change-me"
  );
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Session token: a signed cookie that identifies the logged-in user. The body
// embeds the userId so each request can resolve the user (and their org).
//   token = `${userId}.${ts}.${nonce}.${sig}`
// ---------------------------------------------------------------------------

export function makeToken(userId: string): string {
  const body = `${userId}.${Date.now().toString(36)}.${crypto
    .randomBytes(16)
    .toString("hex")}`;
  return `${body}.${sign(body)}`;
}

/** Verify a token's signature and return the userId it carries, else null. */
export function userIdFromToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, ts, nonce, sig] = parts;
  const body = `${userId}.${ts}.${nonce}`;
  const expected = sign(body);
  if (expected.length !== sig.length) return null;
  try {
    const ok = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex"),
    );
    return ok ? userId : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt via node:crypto — no native deps).
//   stored = `scrypt$${saltHex}$${hashHex}`
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  if (expected.length !== actual.length) return false;
  try {
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export async function createSession(
  userId: string,
  remember = true,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: COOKIE_MAX_AGE } : {}),
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function isPublicPath(pathname: string): boolean {
  // The homepage is the public Vultrix marketing landing page for logged-out
  // visitors. src/app/page.tsx still renders the dashboard for signed-in users,
  // so allowing "/" through the proxy only serves the landing page publicly.
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/signup") return true;
  if (pathname === "/terms") return true;
  if (pathname === "/privacy") return true;
  if (pathname === "/api/login") return true;
  if (pathname === "/logout") return true;
  if (pathname.startsWith("/e/")) return true;
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/a/")) return true;
  if (pathname.startsWith("/q/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}
