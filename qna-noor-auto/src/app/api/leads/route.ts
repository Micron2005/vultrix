// Next.js App Router — lead capture endpoint for the Vultrix marketing landing page.
// Place at: src/app/api/leads/route.ts  (or app/api/leads/route.ts)
//
// IMPORTANT: If your app already has an /api/leads route, rename this folder to
// /api/marketing-leads and update the fetch("/api/leads") call inside
// components/marketing/VultrixLanding.jsx to match.
//
// Persists a lead using your existing Prisma client (@/lib/db). It is defensive:
// if the MarketingLead model hasn't been migrated yet, the form still succeeds
// for the visitor and the error is logged server-side.

import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // <- your existing Prisma client (same import your pages use)

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 422 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 422 });

    const data = {
      name,
      email,
      shop: String(body.shop || ""),
      phone: String(body.phone || ""),
      message: String(body.message || ""),
      source: String(body.source || "contact"),
    };

    try {
      // Requires the MarketingLead model — see prisma/marketing-lead.prisma
      // @ts-ignore model may not exist until you run the migration
      await db.marketingLead.create({ data });
    } catch (e) {
      console.error("[marketing-leads] could not persist (did you run the Prisma migration?):", e);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

// Optional: read leads for a simple admin view.
// Protect with the MARKETING_ADMIN_TOKEN env var, sent as the 'x-admin-token' header.
export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!process.env.MARKETING_ADMIN_TOKEN || token !== process.env.MARKETING_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // @ts-ignore
    const leads = await db.marketingLead.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
    return NextResponse.json(leads);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
