CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "repairOrderId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "technicianId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "sentAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rating" TEXT,
    "note" TEXT,
    "jobId" TEXT,
    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InspectionTemplate_orgId_idx" ON "InspectionTemplate"("orgId");
CREATE INDEX "InspectionTemplateItem_templateId_idx" ON "InspectionTemplateItem"("templateId");
CREATE INDEX "Inspection_repairOrderId_idx" ON "Inspection"("repairOrderId");
CREATE INDEX "Inspection_orgId_idx" ON "Inspection"("orgId");
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");
CREATE INDEX "InspectionPhoto_itemId_idx" ON "InspectionPhoto"("itemId");

ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_repairOrderId_fkey" FOREIGN KEY ("repairOrderId") REFERENCES "RepairOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InspectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
