import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postDueForOrg } from "@/lib/recurring";

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
    organizations.map((organization) => postDueForOrg(organization.id)),
  );
  return NextResponse.json({
    posted: results.reduce((total, result) => total + result.posted, 0),
    organizations: organizations.length,
  });
}
