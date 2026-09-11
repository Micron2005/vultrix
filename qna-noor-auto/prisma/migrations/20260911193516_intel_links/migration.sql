CREATE TABLE "VehicleLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT,
    "url" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "yearMin" INTEGER,
    "yearMax" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "engine" TEXT,
    "thumbnailUrl" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VehicleLink_orgId_idx" ON "VehicleLink"("orgId");
CREATE INDEX "VehicleLink_make_model_idx" ON "VehicleLink"("make", "model");

ALTER TABLE "VehicleLink"
ADD CONSTRAINT "VehicleLink_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
