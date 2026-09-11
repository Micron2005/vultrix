ALTER TABLE "Organization"
ADD COLUMN "shareFixes" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RepairNote"
ADD COLUMN "shared" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "VehicleIntelCache" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleIntelCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleIntelCache_kind_year_make_model_key"
ON "VehicleIntelCache"("kind", "year", "make", "model");
