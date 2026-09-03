import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import { assertCanManagePayments } from "@/lib/permissions";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { computeRoPaid, computeRoTotal } from "@/lib/roTotal";
import { parseDecimal } from "@/lib/utils";
import { baseUrl } from "@/lib/requestUrl";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roId: string }> },
) {
  const { roId } = await params;
  const root = baseUrl(req);
  const destination = `${root}/repair-orders/${roId}`;
  const user = await requireUser();
  const orgId = await requireOrgId();

  try {
    assertCanManagePayments(user.role);
  } catch {
    return NextResponse.redirect(`${destination}?payerror=forbidden`, {
      status: 303,
    });
  }

  if (!billingConfigured()) {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  const ro = await db.repairOrder.findFirst({
    where: { id: roId, orgId },
    select: { id: true, roNumber: true, status: true },
  });
  if (!ro) return NextResponse.redirect(`${root}/repair-orders`, { status: 303 });

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      stripeConnectAccountId: true,
      stripeConnectChargesEnabled: true,
    },
  });
  if (!org?.stripeConnectAccountId || !org.stripeConnectChargesEnabled) {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  const [total, paid] = await Promise.all([
    computeRoTotal(orgId, ro.id),
    computeRoPaid(ro.id),
  ]);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  if (balance <= 0) {
    return NextResponse.redirect(`${destination}?paid=1`, { status: 303 });
  }

  const formData = await req.formData();
  const parsedAmount = parseDecimal(String(formData.get("amount") ?? "0"));
  const amount = Math.min(parsedAmount ?? 0, balance);
  if (amount <= 0) {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  const preInvoice =
    ro.status === "ESTIMATE" ||
    ro.status === "IN_PROGRESS" ||
    ro.status === "COMPLETED";
  const deposit = String(formData.get("kind") ?? "") === "deposit" && preInvoice;
  const metadata = {
    repairOrderId: ro.id,
    orgId,
    deposit: deposit ? "1" : "0",
    source: "in_person",
  };

  let session: Stripe.Checkout.Session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${deposit ? "Deposit" : "Invoice"} #${ro.roNumber} — ${org.name}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${root}/api/pay/in-person/${roId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: destination,
      },
      { stripeAccount: org.stripeConnectAccountId },
    );
  } catch (err) {
    console.error("In-person payment checkout failed:", err);
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }

  if (!session.url) {
    return NextResponse.redirect(`${destination}?payerror=1`, { status: 303 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
