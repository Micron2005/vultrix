CREATE TABLE "RecurringEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "interval" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastPostedAt" TIMESTAMP(3),
    "autoPost" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "vendor" TEXT,
    "method" TEXT,
    "reference" TEXT,
    "source" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "recurringId" TEXT;
ALTER TABLE "Income" ADD COLUMN "recurringId" TEXT;

CREATE INDEX "RecurringEntry_orgId_idx" ON "RecurringEntry"("orgId");
CREATE INDEX "RecurringEntry_active_nextRunAt_idx" ON "RecurringEntry"("active", "nextRunAt");
CREATE INDEX "Expense_recurringId_idx" ON "Expense"("recurringId");
CREATE INDEX "Income_recurringId_idx" ON "Income"("recurringId");

ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringId_fkey"
FOREIGN KEY ("recurringId") REFERENCES "RecurringEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Income" ADD CONSTRAINT "Income_recurringId_fkey"
FOREIGN KEY ("recurringId") REFERENCES "RecurringEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  income_row RECORD;
  series_id TEXT;
BEGIN
  FOR income_row IN
    SELECT "id", "orgId", "amount", "source", "note", "frequency", "receivedAt"
    FROM "Income"
    WHERE "frequency" <> 'ONE_TIME' AND "recurringId" IS NULL
  LOOP
    series_id := gen_random_uuid()::text;
    INSERT INTO "RecurringEntry" (
      "id", "orgId", "kind", "amount", "interval", "startDate", "nextRunAt",
      "autoPost", "source", "note", "createdAt", "updatedAt"
    ) VALUES (
      series_id,
      income_row."orgId",
      'INCOME',
      income_row."amount",
      CASE income_row."frequency"
        WHEN 'WEEKLY' THEN 'WEEKLY'
        WHEN 'BIWEEKLY' THEN 'BIWEEKLY'
        WHEN 'MONTHLY' THEN 'MONTHLY'
        WHEN 'DAILY' THEN 'DAILY'
        WHEN 'YEARLY' THEN 'YEARLY'
        ELSE 'MONTHLY'
      END,
      income_row."receivedAt",
      income_row."receivedAt",
      true,
      income_row."source",
      income_row."note",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
    UPDATE "Income" SET "recurringId" = series_id WHERE "id" = income_row."id";
  END LOOP;
END $$;
