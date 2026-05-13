import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { SESSION_COOKIE, checkPassword } from "@/lib/auth";

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.APP_PASSWORD ||
    "dev-secret-change-me"
  );
}

function makeToken(): string {
  const body = `${Date.now().toString(36)}.${crypto.randomBytes(16).toString("hex")}`;
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(body)
    .digest("hex");
  return `${body}.${sig}`;
}

function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData();
  const password = form.get("password");
  const remember = form.get("remember") === "1";
  const next = safeNext(
    typeof form.get("next") === "string" ? (form.get("next") as string) : "/",
  );

  if (typeof password !== "string" || !checkPassword(password)) {
    const loginUrl = new URL("/login", url);
    if (next !== "/") loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next, url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  return res;
}
