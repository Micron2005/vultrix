import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDueRemindersForOrg } from "@/lib/reminders";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const organizations = await db.organization.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const results = await Promise.all(
    organizations.map((organization) =>
      sendDueRemindersForOrg(organization.id),
    ),
  );
  return NextResponse.json({
    attempted: results.reduce((total, result) => total + result.attempted, 0),
    sent: results.reduce((total, result) => total + result.sent, 0),
    failed: results.reduce((total, result) => total + result.failed, 0),
    skippedNoEmail: results.reduce(
      (total, result) => total + result.skippedNoEmail,
      0,
    ),
    organizations: organizations.length,
  });
}
