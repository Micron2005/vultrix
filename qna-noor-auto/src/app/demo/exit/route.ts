import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Leaving the demo clears the session cookie — a state change, so it must only
// happen on POST (from the "Exit demo" form). A GET here (e.g. link prefetch or
// a crawler) must NOT log the visitor out, or they'd get bounced to /login mid-
// demo; it just sends them to the public landing page.
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}

export function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
