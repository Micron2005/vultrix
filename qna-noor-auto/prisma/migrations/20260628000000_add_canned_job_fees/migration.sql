-- CreateTable
CREATE TABLE "CannedJobFee" (
    "id" TEXT NOT NULL,
    "cannedJobId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CannedJobFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CannedJobFee_cannedJobId_idx" ON "CannedJobFee"("cannedJobId");

-- AddForeignKey
ALTER TABLE "CannedJobFee" ADD CONSTRAINT "CannedJobFee_cannedJobId_fkey" FOREIGN KEY ("cannedJobId") REFERENCES "CannedJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
