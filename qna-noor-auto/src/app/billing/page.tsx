import { redirect } from "next/navigation";
import { Button, Card, CardHeader, PageHeader, Select } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { billingConfigured } from "@/lib/stripe";
import {
  describeBilling,
  priceForAccount,
  subscriptionIsDead,
} from "@/lib/billing";
import { MUSIC_ADDON_PRICE_USD } from "@/lib/musicAddon";
import { enabledFeatureSet } from "@/lib/features";
import { refreshConnectStatus } from "@/lib/connect";
import { SALES_EMAIL } from "@/lib/branding";
import {
  openBillingPortal,
  restartOwnSubscription,
  startConnectOnboarding,
  openConnectDashboard,
  updatePlan,
  enableMusicAddon,
  disableMusicAddon,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
    connect?: string;
    plan_saved?: string;
    music_saved?: string;
  }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");

  const sp = (await searchParams) ?? {};
  let org = await db.organization.findUnique({ where: { id: user.orgId } });
  if (!org) redirect("/");

  // Returning from Stripe onboarding — pull the latest status so the page
  // immediately reflects whether the shop can now accept payments.
  if (sp.connect === "return" && org.stripeConnectAccountId && billingConfigured()) {
    try {
      await refreshConnectStatus(org.id, org.stripeConnectAccountId);
      org = await db.organization.findUnique({ where: { id: user.orgId } });
    } catch {
      // Non-fatal: the webhook will reconcile status shortly.
    }
    if (!org) redirect("/");
  }

  const hasSubscription = Boolean(org.stripeCustomerId);
  const connectStarted = Boolean(org.stripeConnectAccountId);
  const connectReady = org.stripeConnectChargesEnabled;
  const featureSet = enabledFeatureSet(org);
  const hasInvoices = featureSet.has("invoices");
  const monthlyPrice = priceForAccount(org.accountType, hasInvoices);
  const hasFutureTrial = Boolean(
    org.trialEndsAt && org.trialEndsAt > new Date(),
  );

  return (
    <div>
      <PageHeader
        title="Billing"
        description={
          org.billingExempt
            ? `Your ${org.name} account — free, never billed.`
            : hasSubscription
              ? `Your ${org.name} subscription — $${monthlyPrice}/month.`
              : `Your ${org.name} account.`
        }
      />

      {(sp.error || sp.plan_saved || sp.music_saved) && (
        <div
          className={
            sp.error
              ? "mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
              : "mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800"
          }
        >
          {sp.error ?? sp.plan_saved ?? sp.music_saved}
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

          {org.billingExempt ? (
            <p className="text-sm text-zinc-500">
              This is a free account. You&apos;ll never be charged.
            </p>
          ) : !billingConfigured() ? (
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
          {!org.billingExempt &&
            subscriptionIsDead(org.subscriptionStatus) &&
            org.stripeCustomerId && (
              <form action={restartOwnSubscription}>
                <Button type="submit">Restart subscription</Button>
                <p className="mt-2 text-xs text-zinc-500">
                  {hasFutureTrial
                    ? "Starts a new subscription on the saved card."
                    : `Starts a new $${monthlyPrice}/month subscription on the saved card, charged today.`}
                </p>
              </form>
            )}
          <p className="text-sm text-zinc-500">
            Subscription or payment questions?{" "}
            <a
              href={`mailto:${SALES_EMAIL}`}
              className="underline underline-offset-2"
            >
              {SALES_EMAIL}
            </a>
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Plan and account type" />
        <form action={updatePlan} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Account type
            </label>
            <Select name="accountType" defaultValue={org.accountType}>
              <option value="PERSONAL">Personal</option>
              <option value="BUSINESS">Business</option>
              <option value="AUTO_SHOP">Auto shop</option>
            </Select>
          </div>
          {org.accountType === "PERSONAL" ? (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Invoices
              </label>
              <Select name="invoices" defaultValue={hasInvoices ? "yes" : "no"}>
                <option value="no">
                  No — $
                  {priceForAccount("PERSONAL", false)}
                  /month
                </option>
                <option value="yes">
                  Yes — $
                  {priceForAccount("PERSONAL", true)}
                  /month
                </option>
              </Select>
              <p className="mt-1 text-xs text-zinc-500">
                Invoices also enable Customers and Businesses.
              </p>
            </div>
          ) : (
            <input type="hidden" name="invoices" value="yes" />
          )}
          <p className="text-sm text-zinc-600">
            {org.accountType === "AUTO_SHOP"
              ? "Auto shops include all automotive features and invoicing."
              : org.accountType === "BUSINESS"
                ? "Business accounts include all general features and invoicing."
                : "Personal accounts include all general features. Choose whether you need invoicing."}
          </p>
          <SaveButton>Save plan</SaveButton>
        </form>
      </Card>

      <div id="music">
        <Card className="mt-6">
          <CardHeader title="Music add-on" />
          <div className="space-y-4 p-4">
            <p className="text-sm text-zinc-600">
              Add Songs, lyrics, beats and practice tools to this account.
            </p>
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Status
              </div>
              <div className="text-sm font-medium text-zinc-900">
                {org.billingExempt
                  ? "Included with your free account"
                  : org.musicAddon
                    ? `On — $${MUSIC_ADDON_PRICE_USD}/month`
                    : user.musicAccess.reason === "grace" &&
                        user.musicAccess.graceUntil
                      ? `Free until ${user.musicAccess.graceUntil.toLocaleDateString()}`
                      : "Off"}
              </div>
            </div>
            {!org.billingExempt && (
              <p className="text-sm text-zinc-600">
                Monthly total:{" "}
                {org.musicAddon
                  ? `$${monthlyPrice} base + $${MUSIC_ADDON_PRICE_USD} Music = $${monthlyPrice + MUSIC_ADDON_PRICE_USD}/month`
                  : `$${monthlyPrice}/month`}
              </p>
            )}
            {org.musicAddon ? (
              <form action={disableMusicAddon}>
                <Button type="submit" variant="secondary">
                  Remove Music add-on
                </Button>
              </form>
            ) : (
              <form action={enableMusicAddon}>
                <Button type="submit">Add Music add-on</Button>
              </form>
            )}
          </div>
        </Card>
      </div>

      {hasInvoices && (
        <Card className="mt-6">
          <CardHeader title="Accept customer payments" />
          <div className="p-4 space-y-4">
          <p className="text-sm text-zinc-600">
            Let your customers pay their invoices online by card. Money goes
            straight to your own Stripe account and pays out to your bank — we
            never hold it and take no cut.
          </p>

          {!billingConfigured() ? (
            <p className="text-sm text-zinc-500">
              Online payments aren&apos;t set up on this server yet.
            </p>
          ) : connectReady ? (
            <>
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                ✓ Active — a <strong>Pay</strong> button now appears on your
                customers&apos; invoices.
              </div>
              <form action={openConnectDashboard}>
                <Button type="submit" variant="secondary">
                  View payouts &amp; payments
                </Button>
                <p className="mt-2 text-xs text-zinc-500">
                  Opens your Stripe dashboard to see payments, manage your bank
                  account, and track payouts.
                </p>
              </form>
            </>
          ) : connectStarted ? (
            <>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                Setup not finished — Stripe still needs a few details before you
                can accept payments.
              </div>
              <form action={startConnectOnboarding}>
                <Button type="submit">Finish payment setup</Button>
              </form>
            </>
          ) : (
            <form action={startConnectOnboarding}>
              <Button type="submit">Set up payments</Button>
              <p className="mt-2 text-xs text-zinc-500">
                Takes a few minutes. Stripe will ask for your business and bank
                details to deposit your customers&apos; payments.
              </p>
            </form>
          )}
          </div>
        </Card>
      )}
    </div>
  );
}
