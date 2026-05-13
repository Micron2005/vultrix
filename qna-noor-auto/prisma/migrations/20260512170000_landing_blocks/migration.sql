-- CreateTable
CREATE TABLE "LandingBlock" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "imageData" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingBlock_sortOrder_idx" ON "LandingBlock"("sortOrder");
