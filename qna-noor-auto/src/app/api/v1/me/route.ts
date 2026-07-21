import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/apiV1";

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, accountType: true },
    });
    if (!organization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      org: {
        id: organization.id,
        name: organization.name,
        accountType: organization.accountType,
      },
    });
  });
}
