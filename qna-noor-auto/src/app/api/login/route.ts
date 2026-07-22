import { NextResponse } from "next/server";
import { SESSION_COOKIE, makeToken, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const form = await req.formData();
  const username =
    typeof form.get("username") === "string"
      ? (form.get("username") as string).trim()
      : "";
  const usernameLower = username.toLowerCase();
  const password = form.get("password");
  const remember = form.get("remember") === "1";
  const next = safeNext(
    typeof form.get("next") === "string" ? (form.get("next") as string) : "/",
  );

  function fail() {
    const loginUrl = new URL("/login", url);
    if (next !== "/") loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  if (!username || typeof password !== "string" || !password) return fail();

  const user = await db.user.findUnique({
    where: { usernameLower },
    include: { organization: true },
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return fail();
  }

  // Non-platform users must belong to an active organization.
  if (user.role !== "SUPERADMIN") {
    if (!user.organization || user.organization.status !== "ACTIVE") {
      const loginUrl = new URL("/login", url);
      loginUrl.searchParams.set("suspended", "1");
      return NextResponse.redirect(loginUrl, { status: 303 });
    }
  }

  const res = NextResponse.redirect(new URL(next, url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, makeToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  return res;
}
