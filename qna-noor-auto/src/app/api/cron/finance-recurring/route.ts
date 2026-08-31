import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postDueForOrg } from "@/lib/recurring";
import { postDueInvoicesForOrg } from "@/lib/recurringInvoices";

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
      const [money, invoices] = await Promise.all([
        postDueForOrg(organization.id),
        postDueInvoicesForOrg(organization.id),
      ]);
      return { money, invoices };
    }),
  );
  return NextResponse.json({
    posted: results.reduce((total, result) => total + result.money.posted, 0),
    invoicesPosted: results.reduce(
      (total, result) => total + result.invoices.posted,
      0,
    ),
    organizations: organizations.length,
  });
}
