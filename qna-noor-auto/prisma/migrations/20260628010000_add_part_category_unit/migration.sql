-- AlterTable
ALTER TABLE "Part" ADD COLUMN "category" TEXT,
ADD COLUMN "unit" TEXT;

-- CreateIndex
CREATE INDEX "Part_category_idx" ON "Part"("category");
