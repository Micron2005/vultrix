CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partId" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "channel" TEXT,
    "note" TEXT,
    "incomeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sale_orgId_idx" ON "Sale"("orgId");
CREATE INDEX "Sale_soldAt_idx" ON "Sale"("soldAt");
CREATE INDEX "Sale_partId_idx" ON "Sale"("partId");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_incomeId_fkey"
FOREIGN KEY ("incomeId") REFERENCES "Income"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
