-- Phase 3: Data isolation.
-- Add an `orgId` to every top-level tenant model so each business only sees its
-- own data. Existing rows are backfilled to the first (starter) organization,
-- then the column is made required and a FK + index are added.
--
-- The backfill targets the oldest Organization. On a fresh database the tenant
-- tables are empty, so the UPDATE affects no rows and SET NOT NULL succeeds.

-- ---------------------------------------------------------------------------
-- Customer
-- ---------------------------------------------------------------------------
ALTER TABLE "Customer" ADD COLUMN "orgId" TEXT;
UPDATE "Customer" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Customer_orgId_idx" ON "Customer"("orgId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Vehicle
-- ---------------------------------------------------------------------------
ALTER TABLE "Vehicle" ADD COLUMN "orgId" TEXT;
UPDATE "Vehicle" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Vehicle_orgId_idx" ON "Vehicle"("orgId");
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RepairOrder
-- ---------------------------------------------------------------------------
ALTER TABLE "RepairOrder" ADD COLUMN "orgId" TEXT;
UPDATE "RepairOrder" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "RepairOrder" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "RepairOrder_orgId_idx" ON "RepairOrder"("orgId");
ALTER TABLE "RepairOrder" ADD CONSTRAINT "RepairOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Payment
-- ---------------------------------------------------------------------------
ALTER TABLE "Payment" ADD COLUMN "orgId" TEXT;
UPDATE "Payment" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Technician
-- ---------------------------------------------------------------------------
ALTER TABLE "Technician" ADD COLUMN "orgId" TEXT;
UPDATE "Technician" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Technician" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Technician_orgId_idx" ON "Technician"("orgId");
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Part
-- ---------------------------------------------------------------------------
ALTER TABLE "Part" ADD COLUMN "orgId" TEXT;
UPDATE "Part" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Part" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Part_orgId_idx" ON "Part"("orgId");
ALTER TABLE "Part" ADD CONSTRAINT "Part_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Appointment
-- ---------------------------------------------------------------------------
ALTER TABLE "Appointment" ADD COLUMN "orgId" TEXT;
UPDATE "Appointment" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Appointment" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Appointment_orgId_idx" ON "Appointment"("orgId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RepairNote
-- ---------------------------------------------------------------------------
ALTER TABLE "RepairNote" ADD COLUMN "orgId" TEXT;
UPDATE "RepairNote" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "RepairNote" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "RepairNote_orgId_idx" ON "RepairNote"("orgId");
ALTER TABLE "RepairNote" ADD CONSTRAINT "RepairNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- CannedJob
-- ---------------------------------------------------------------------------
ALTER TABLE "CannedJob" ADD COLUMN "orgId" TEXT;
UPDATE "CannedJob" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "CannedJob" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "CannedJob_orgId_idx" ON "CannedJob"("orgId");
ALTER TABLE "CannedJob" ADD CONSTRAINT "CannedJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Expense
-- ---------------------------------------------------------------------------
ALTER TABLE "Expense" ADD COLUMN "orgId" TEXT;
UPDATE "Expense" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "Expense_orgId_idx" ON "Expense"("orgId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ShopFee
-- ---------------------------------------------------------------------------
ALTER TABLE "ShopFee" ADD COLUMN "orgId" TEXT;
UPDATE "ShopFee" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "ShopFee" ALTER COLUMN "orgId" SET NOT NULL;
CREATE INDEX "ShopFee_orgId_idx" ON "ShopFee"("orgId");
ALTER TABLE "ShopFee" ADD CONSTRAINT "ShopFee_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ShopSetting (also switch the unique key from `key` to `(orgId, key)`)
-- ---------------------------------------------------------------------------
ALTER TABLE "ShopSetting" ADD COLUMN "orgId" TEXT;
UPDATE "ShopSetting" SET "orgId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1) WHERE "orgId" IS NULL;
ALTER TABLE "ShopSetting" ALTER COLUMN "orgId" SET NOT NULL;
DROP INDEX "ShopSetting_key_key";
CREATE UNIQUE INDEX "ShopSetting_orgId_key_key" ON "ShopSetting"("orgId", "key");
CREATE INDEX "ShopSetting_orgId_idx" ON "ShopSetting"("orgId");
ALTER TABLE "ShopSetting" ADD CONSTRAINT "ShopSetting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
