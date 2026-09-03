import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { recordOnlinePayment } from "@/lib/connect";
import { baseUrl } from "@/lib/requestUrl";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roId: string }> },
) {
  const { roId } = await params;
  const root = baseUrl(req);
  const destination = `${root}/repair-orders/${roId}`;
  await requireUser();
  const orgId = await requireOrgId();
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId || !billingConfigured()) {
    return NextResponse.redirect(destination, { status: 303 });
  }

  const ro = await db.repairOrder.findFirst({
    where: { id: roId, orgId },
    select: { id: true },
  });
  if (!ro) return NextResponse.redirect(`${root}/repair-orders`, { status: 303 });

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { stripeConnectAccountId: true },
  });
  if (!org?.stripeConnectAccountId) {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      undefined,
      { stripeAccount: org.stripeConnectAccountId },
    );
    if (
      session.metadata?.repairOrderId !== roId ||
      session.metadata?.orgId !== orgId
    ) {
      return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
    }
    await recordOnlinePayment(session);
  } catch {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  return NextResponse.redirect(`${destination}?paid=1`, { status: 303 });
}
