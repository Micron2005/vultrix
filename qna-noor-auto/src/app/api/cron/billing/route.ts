import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GRACE_DAYS } from "@/lib/billing";

/**
 * Daily billing enforcement. Puts on hold any business whose payment has been
 * failing for longer than the grace period (GRACE_DAYS). Businesses are given
 * the grace window so Stripe's automatic card retries can recover first; a
 * successful payment clears pastDueSince (see the webhook), sparing them.
 *
 * Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token. Manual
 * businesses (no subscription, pastDueSince null) are never touched.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const overdue = await db.organization.findMany({
    where: {
      status: "ACTIVE",
      pastDueSince: { not: null, lt: cutoff },
    },
    select: { id: true, name: true },
  });

  if (overdue.length > 0) {
    await db.organization.updateMany({
      where: { id: { in: overdue.map((o) => o.id) } },
      data: { status: "SUSPENDED" },
    });
  }

  return NextResponse.json({
    suspended: overdue.length,
    businesses: overdue.map((o) => o.name),
  });
}
