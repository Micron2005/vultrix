-- CreateTable
CREATE TABLE "LaborLineTech" (
    "laborLineId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LaborLineTech_pkey" PRIMARY KEY ("laborLineId","technicianId")
);

-- CreateIndex
CREATE INDEX "LaborLineTech_laborLineId_idx" ON "LaborLineTech"("laborLineId");

-- CreateIndex
CREATE INDEX "LaborLineTech_technicianId_idx" ON "LaborLineTech"("technicianId");

-- AddForeignKey
ALTER TABLE "LaborLineTech" ADD CONSTRAINT "LaborLineTech_laborLineId_fkey"
FOREIGN KEY ("laborLineId") REFERENCES "LaborLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborLineTech" ADD CONSTRAINT "LaborLineTech_technicianId_fkey"
FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing scalar assignments as full-credit assignments.
INSERT INTO "LaborLineTech" ("laborLineId", "technicianId", "hours")
SELECT "id", "technicianId", "hours"
FROM "LaborLine"
WHERE "technicianId" IS NOT NULL;
