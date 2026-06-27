import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const url = new URL(req.url);
  // Send people back to the marketing landing page after signing out (it has
  // clear "Log in" / "Sign up" entry points), rather than straight to /login.
  const res = NextResponse.redirect(new URL("/", url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function GET(req: Request) {
  return POST(req);
}
