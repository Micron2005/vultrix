/**
 * One-time migration: move existing AUTO_SHOP subscriptions onto the current
 * auto-shop monthly price ($35 by default — see PRICE_USD in src/lib/billing).
 *
 * Why this is needed: auto shops that signed up before the price change are on
 * an older Stripe Price (e.g. $45). New signups already get the right price
 * automatically. This script re-points existing auto-shop subscriptions to the
 * current price with proration DISABLED, so nobody is charged/credited mid-cycle
 * — the new amount simply applies at their next renewal.
 *
 * It is SAFE and IDEMPOTENT:
 *   - Only touches Organizations with accountType = AUTO_SHOP and an active,
 *     trialing, or past-due subscription.
 *   - Subscriptions already on the target price are skipped.
 *   - Trials and billing cycles are preserved (only the recurring item's price
 *     changes).
 *
 * Preview WITHOUT making any changes:
 *   MIGRATE_DRY_RUN=1 tsx prisma/migrate-auto-shop-price.ts
 *
 * Apply the migration:
 *   tsx prisma/migrate-auto-shop-price.ts
 *
 * Requires STRIPE_SECRET_KEY and DATABASE_URL to be set in the environment.
 */
import { db } from "../src/lib/db";
import { billingConfigured, getStripe } from "../src/lib/stripe";
import {
  resolvePriceId,
  applySubscriptionPriceToSubscription,
  PRICE_USD,
} from "../src/lib/billing";

const DRY_RUN = process.env.MIGRATE_DRY_RUN === "1";
// Statuses where changing the recurring price is meaningful and safe.
const MIGRATABLE = new Set(["trialing", "active", "past_due", "unpaid"]);

function dollars(cents: number | null | undefined): string {
  return cents == null ? "?" : `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  if (!billingConfigured()) {
    console.error("STRIPE_SECRET_KEY is not set — cannot run this migration.");
    process.exit(1);
  }

  const stripe = getStripe();

  // Resolve (creating once if needed) the current auto-shop price id.
  const targetPriceId = await resolvePriceId("AUTO_SHOP");
  console.log(
    `Target AUTO_SHOP price: $${PRICE_USD}/mo (${targetPriceId})` +
      (DRY_RUN ? "   [DRY RUN — no changes will be made]" : ""),
  );

  const orgs = await db.organization.findMany({
    where: { accountType: "AUTO_SHOP", stripeSubscriptionId: { not: null } },
    select: {
      id: true,
      name: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });
  console.log(`Found ${orgs.length} auto-shop org(s) with a subscription.\n`);

  let changed = 0;
  let skipped = 0;
  let failed = 0;

  for (const org of orgs) {
    const subId = org.stripeSubscriptionId as string;
    const label = `${org.name} (${org.id})`;

    if (!MIGRATABLE.has(org.subscriptionStatus ?? "")) {
      console.log(`- SKIP  ${label} — status=${org.subscriptionStatus}`);
      skipped++;
      continue;
    }

    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const item = sub.items.data[0];
      const currentPriceId = item?.price?.id;
      const currentAmount = item?.price?.unit_amount ?? null;

      if (currentPriceId === targetPriceId) {
        console.log(`- OK    ${label} — already on $${PRICE_USD}`);
        skipped++;
        continue;
      }

      console.log(
        `- ${DRY_RUN ? "WOULD" : "MIGRATE"} ${label} — ` +
          `${dollars(currentAmount)} (${currentPriceId}) -> $${PRICE_USD} (${targetPriceId})`,
      );

      if (!DRY_RUN) {
        await applySubscriptionPriceToSubscription({
          orgId: org.id,
          accountType: "AUTO_SHOP",
          subscriptionId: subId,
          hasInvoices: true,
          aiHosted: false,
        });
      }
      changed++;
    } catch (e) {
      failed++;
      console.error(
        `- FAIL  ${label} —`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? "would change" : "changed"}=${changed}, skipped=${skipped}, failed=${failed}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
