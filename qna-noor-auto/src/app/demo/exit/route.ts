import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

// Leave the demo: clear the demo session cookie and return to the public
// marketing landing page (not /login — the visitor is a prospect, not a user).
export const dynamic = "force-dynamic";

function leave(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  return leave(req);
}

export async function POST(req: Request) {
  return leave(req);
}
