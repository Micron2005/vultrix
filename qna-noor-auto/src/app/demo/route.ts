import { NextResponse } from "next/server";
import { SESSION_COOKIE, makeToken } from "@/lib/auth";
import { seedDemo, DEMO_USER_ID } from "@/lib/demo";

// Public entry point for the live demo. Each visit wipes + re-seeds the demo
// org with fresh sample data, then signs the visitor in as the demo owner and
// drops them on the dashboard. The reset-on-every-visit behavior keeps the
// sandbox safe no matter what a prospect clicks or edits.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await seedDemo();

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, makeToken(DEMO_USER_ID), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // a one-day demo session is plenty
  });
  return res;
}
