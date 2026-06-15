import { redirect } from "next/navigation";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { billingConfigured } from "@/lib/stripe";
import { describeBilling, PRICE_USD } from "@/lib/billing";
import { openBillingPortal } from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");

  const sp = (await searchParams) ?? {};
  const org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) redirect("/");

  const hasSubscription = Boolean(org.stripeCustomerId);

  return (
    <div>
      <PageHeader
        title="Billing"
        description={`Your ${org.name} subscription — $${PRICE_USD}/month.`}
      />

      {sp.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <Card>
        <CardHeader title="Subscription" />
        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Status
            </div>
            <div className="text-sm font-medium text-zinc-900">
              {describeBilling(org)}
            </div>
          </div>

          {!billingConfigured() ? (
            <p className="text-sm text-zinc-500">
              Billing isn&apos;t set up on this server yet.
            </p>
          ) : hasSubscription ? (
            <form action={openBillingPortal}>
              <Button type="submit">Manage billing</Button>
              <p className="mt-2 text-xs text-zinc-500">
                Update your card, view invoices, or cancel. Opens Stripe&apos;s
                secure billing portal.
              </p>
            </form>
          ) : (
            <p className="text-sm text-zinc-500">
              This business was set up by the platform owner and has no
              self-serve subscription. Contact support to make changes.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
