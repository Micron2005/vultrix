import { verifyUnsubscribeToken } from "@/lib/announcements";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get("o");
  const token = url.searchParams.get("t");
  if (!orgId || !token || !verifyUnsubscribeToken(orgId, token)) {
    return Response.json({ error: "Invalid unsubscribe link." }, { status: 400 });
  }

  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      ?.includes("application/x-www-form-urlencoded")
  ) {
    return Response.json({ error: "Invalid one-click request." }, { status: 400 });
  }
  const body = new URLSearchParams(await request.text());
  if (body.get("List-Unsubscribe") !== "One-Click") {
    return Response.json({ error: "Invalid one-click request." }, { status: 400 });
  }
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!org) return Response.json({ error: "Account not found." }, { status: 404 });

  await db.organization.update({
    where: { id: orgId },
    data: { announcementsOptOut: true },
  });
  return new Response(null, { status: 204 });
}
