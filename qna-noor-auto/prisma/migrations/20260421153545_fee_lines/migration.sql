-- CreateTable
CREATE TABLE "FeeLine" (
    "id" TEXT NOT NULL,
    "repairOrderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeLine_repairOrderId_idx" ON "FeeLine"("repairOrderId");

-- AddForeignKey
ALTER TABLE "FeeLine" ADD CONSTRAINT "FeeLine_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "RepairOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
