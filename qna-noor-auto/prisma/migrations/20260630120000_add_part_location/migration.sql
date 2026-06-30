-- AlterTable
ALTER TABLE "Part" ADD COLUMN "location" TEXT;

-- CreateIndex
CREATE INDEX "Part_location_idx" ON "Part"("location");
