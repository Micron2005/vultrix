CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Budget_orgId_category_key" ON "Budget"("orgId", "category");
CREATE INDEX "Budget_orgId_idx" ON "Budget"("orgId");

ALTER TABLE "Budget" ADD CONSTRAINT "Budget_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
