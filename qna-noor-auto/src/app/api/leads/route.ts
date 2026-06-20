// Next.js App Router — lead capture endpoint for the Vultrix marketing landing page.
// Located at: src/app/api/leads/route.ts
//
// On POST it: (1) validates, (2) persists the lead via Prisma (@/lib/db), and
// (3) best-effort emails the owner a notification via Resend. The email is never
// allowed to break or delay the visitor's success response.
//
// Required env vars for email alerts (set in Vercel → Settings → Environment Variables):
//   RESEND_API_KEY      your Resend API key (re_...)
//   LEADS_NOTIFY_EMAIL  the inbox alerts are sent TO (kept out of the public repo)
//   LEADS_FROM_EMAIL    (optional) verified sender; defaults to onboarding@resend.dev

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type LeadData = {
  name: string;
  email: string;
  shop: string;
  phone: string;
  message: string;
  source: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const name = String((body as Record<string, unknown>).name || "").trim();
    const email = String((body as Record<string, unknown>).email || "")
      .trim()
      .toLowerCase();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 422 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 422 },
      );
    }

    const data: LeadData = {
      name,
      email,
      shop: String((body as Record<string, unknown>).shop || ""),
      phone: String((body as Record<string, unknown>).phone || ""),
      message: String((body as Record<string, unknown>).message || ""),
      source: String((body as Record<string, unknown>).source || "contact"),
    };

    try {
      await db.marketingLead.create({ data });
    } catch (e) {
      console.error(
        "[marketing-leads] could not persist (did you run the Prisma migration?):",
        e,
      );
    }

    // Best-effort owner notification. Awaited (reliable on serverless) but never
    // throws into the response — a failed email must not fail the lead capture.
    try {
      await notifyNewLead(data);
    } catch (e) {
      console.error("[marketing-leads] email notify error:", e);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

// Optional JSON read of leads, protected by MARKETING_ADMIN_TOKEN header.
// (The owner-facing UI lives at /admin/leads.)
export async function GET(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (
    !process.env.MARKETING_ADMIN_TOKEN ||
    token !== process.env.MARKETING_ADMIN_TOKEN
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const leads = await db.marketingLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return NextResponse.json(leads);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Email the owner when a new lead arrives. No-ops quietly if Resend isn't
 * configured yet (so the form keeps working before env vars are set).
 */
async function notifyNewLead(lead: LeadData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEADS_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const from =
    process.env.LEADS_FROM_EMAIL || "Vultrix Leads <onboarding@resend.dev>";

  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:4px 16px 4px 0;color:#71717a;font:14px system-ui,sans-serif;white-space:nowrap">${label}</td><td style="padding:4px 0;color:#18181b;font:14px system-ui,sans-serif">${escapeHtml(value)}</td></tr>`
      : "";

  const html = `
  <div style="max-width:560px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
    <h2 style="margin:0 0 4px;color:#18181b">New Vultrix lead 🔧</h2>
    <p style="margin:0 0 16px;color:#71717a;font-size:14px">Someone just submitted the contact form on vultrix.net.</p>
    <table style="border-collapse:collapse">
      ${row("Name", lead.name)}
      ${row("Email", lead.email)}
      ${row("Phone", lead.phone)}
      ${row("Shop", lead.shop)}
      ${row("Source", lead.source)}
    </table>
    ${
      lead.message
        ? `<div style="margin-top:16px"><div style="color:#71717a;font-size:14px;margin-bottom:4px">Message</div><div style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px;color:#18181b;font-size:14px">${escapeHtml(lead.message)}</div></div>`
        : ""
    }
    <p style="margin-top:20px;color:#a1a1aa;font-size:12px">Reply to this email to respond directly to ${escapeHtml(lead.email)}.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: lead.email,
      subject: `New Vultrix lead: ${lead.name}${lead.shop ? ` — ${lead.shop}` : ""}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error(
      "[marketing-leads] Resend notify failed:",
      res.status,
      await res.text().catch(() => ""),
    );
  }
}
