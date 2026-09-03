import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDailyDigestForOrg } from "@/lib/dailyDigest";
import { sendDueRemindersForOrg } from "@/lib/reminders";
import { sendWeeklyReviewForOrg } from "@/lib/weeklyReview";

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
    organizations.map(async (organization) => {
      const [reminders, weeklyReview, dailyDigest] = await Promise.all([
        sendDueRemindersForOrg(organization.id),
        sendWeeklyReviewForOrg(organization.id),
        sendDailyDigestForOrg(organization.id),
      ]);
      return { reminders, weeklyReview, dailyDigest };
    }),
  );
  return NextResponse.json({
    attempted: results.reduce(
      (total, result) =>
        total +
        result.reminders.attempted +
        result.weeklyReview.attempted +
        result.dailyDigest.attempted,
      0,
    ),
    sent: results.reduce(
      (total, result) =>
        total + result.reminders.sent + result.weeklyReview.sent + result.dailyDigest.sent,
      0,
    ),
    failed: results.reduce(
      (total, result) =>
        total +
        result.reminders.failed +
        result.weeklyReview.failed +
        result.dailyDigest.failed,
      0,
    ),
    skippedNoEmail: results.reduce(
      (total, result) => total + result.reminders.skippedNoEmail + result.weeklyReview.skippedNoEmail,
      0,
    ),
    skippedEmpty: results.reduce(
      (total, result) =>
        total + result.dailyDigest.skippedEmpty,
      0,
    ),
    organizations: organizations.length,
  });
}
