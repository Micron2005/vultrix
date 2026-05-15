-- AlterTable
ALTER TABLE "FeeLine" ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "LaborLine" ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "PartLine" ADD COLUMN     "jobId" TEXT;

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "repairOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_repairOrderId_idx" ON "Job"("repairOrderId");

-- CreateIndex
CREATE INDEX "FeeLine_jobId_idx" ON "FeeLine"("jobId");

-- CreateIndex
CREATE INDEX "LaborLine_jobId_idx" ON "LaborLine"("jobId");

-- CreateIndex
CREATE INDEX "PartLine_jobId_idx" ON "PartLine"("jobId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "RepairOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborLine" ADD CONSTRAINT "LaborLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartLine" ADD CONSTRAINT "PartLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
