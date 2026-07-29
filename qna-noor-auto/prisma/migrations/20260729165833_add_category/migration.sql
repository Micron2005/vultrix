-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_orgId_name_key" ON "Category"("orgId", "name");

-- CreateIndex
CREATE INDEX "Category_orgId_idx" ON "Category"("orgId");

-- Backfill categories from the existing free-text Part.category values.
INSERT INTO "Category" ("id", "name", "orgId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "category", "orgId", NOW(), NOW()
FROM (
    SELECT DISTINCT "orgId", "category"
    FROM "Part"
    WHERE "category" IS NOT NULL AND "category" <> ''
) d;

-- AddForeignKey
ALTER TABLE "Category"
ADD CONSTRAINT "Category_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
