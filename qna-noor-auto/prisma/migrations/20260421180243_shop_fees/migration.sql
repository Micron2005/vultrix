-- CreateTable
CREATE TABLE "ShopFee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "partsPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxCap" DOUBLE PRECISION,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairOrderShopFeeExclusion" (
    "repairOrderId" TEXT NOT NULL,
    "shopFeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairOrderShopFeeExclusion_pkey" PRIMARY KEY ("repairOrderId","shopFeeId")
);

-- CreateIndex
CREATE INDEX "ShopFee_active_idx" ON "ShopFee"("active");

-- CreateIndex
CREATE INDEX "ShopFee_sortOrder_idx" ON "ShopFee"("sortOrder");

-- CreateIndex
CREATE INDEX "RepairOrderShopFeeExclusion_repairOrderId_idx" ON "RepairOrderShopFeeExclusion"("repairOrderId");

-- CreateIndex
CREATE INDEX "RepairOrderShopFeeExclusion_shopFeeId_idx" ON "RepairOrderShopFeeExclusion"("shopFeeId");

-- AddForeignKey
ALTER TABLE "RepairOrderShopFeeExclusion" ADD CONSTRAINT "RepairOrderShopFeeExclusion_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "RepairOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairOrderShopFeeExclusion" ADD CONSTRAINT "RepairOrderShopFeeExclusion_shopFeeId_fkey" FOREIGN KEY ("shopFeeId") REFERENCES "ShopFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
