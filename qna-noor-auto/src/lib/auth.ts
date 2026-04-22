import { cookies } from "next/headers";
import crypto from "node:crypto";

export const SESSION_COOKIE = "noor_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "dev-secret-change-me";
}

function getAppPassword(): string {
  return process.env.APP_PASSWORD || "changeme";
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function makeToken(): string {
  const secret = getSessionSecret();
  const body = `${Date.now().toString(36)}.${crypto.randomBytes(16).toString("hex")}`;
  return `${body}.${sign(body, secret)}`;
}

function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const body = `${ts}.${nonce}`;
  const expected = sign(body, getSessionSecret());
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(SESSION_COOKIE)?.value);
}

export function checkPassword(input: string): boolean {
  const expected = getAppPassword();
  const a = Buffer.from(input, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function createSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
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
