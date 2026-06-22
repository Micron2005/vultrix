-- AlterTable: let each business connect its own Stripe account to take customer payments
ALTER TABLE "Organization"
  ADD COLUMN "stripeConnectAccountId" TEXT,
  ADD COLUMN "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeConnectDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeConnectAccountId_key" ON "Organization"("stripeConnectAccountId");
