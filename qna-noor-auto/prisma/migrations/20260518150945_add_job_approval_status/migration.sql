-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "customerNote" TEXT,
ADD COLUMN     "declinedAt" TIMESTAMP(3);
