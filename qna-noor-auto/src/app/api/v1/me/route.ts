import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authenticateApiKey,
  unauthorizedResponse,
} from "@/lib/apiKeys";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorizedResponse();

  const organization = await db.organization.findUnique({
    where: { id: auth.orgId },
    select: { id: true, name: true, accountType: true },
  });
  if (!organization) return unauthorizedResponse();

  return NextResponse.json({
    org: {
      id: organization.id,
      name: organization.name,
      accountType: organization.accountType,
    },
  });
}
