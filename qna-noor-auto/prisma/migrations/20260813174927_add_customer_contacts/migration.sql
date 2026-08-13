-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_kind_idx" ON "CustomerContact"("customerId", "kind");

-- CreateIndex
CREATE INDEX "CustomerContact_orgId_idx" ON "CustomerContact"("orgId");

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill only customers that do not already have contact rows. The NOT EXISTS
-- guard makes this insert safe to run repeatedly without duplicating contacts.
INSERT INTO "CustomerContact"
    ("id", "customerId", "orgId", "kind", "value", "label", "isPrimary", "sortOrder", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."id",
    c."orgId",
    v."kind",
    v."value",
    v."label",
    v."isPrimary",
    v."sortOrder",
    CURRENT_TIMESTAMP
FROM "Customer" c
CROSS JOIN LATERAL (
    VALUES
      ('EMAIL', NULLIF(BTRIM(c."email"), ''), NULL, true, 0),
      ('PHONE', NULLIF(BTRIM(c."phone"), ''), NULL, true, 0),
      (
        'PHONE',
        NULLIF(BTRIM(c."altPhone"), ''),
        NULL,
        NULLIF(BTRIM(c."phone"), '') IS NULL,
        CASE WHEN NULLIF(BTRIM(c."phone"), '') IS NULL THEN 0 ELSE 1 END
      )
) AS v("kind", "value", "label", "isPrimary", "sortOrder")
WHERE v."value" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CustomerContact" cc
    WHERE cc."customerId" = c."id"
  );
