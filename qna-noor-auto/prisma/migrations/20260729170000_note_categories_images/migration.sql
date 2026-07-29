-- AlterTable
ALTER TABLE "RepairNote" ADD COLUMN "category" TEXT;

-- CreateTable
CREATE TABLE "NoteImage" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NoteImage_noteId_idx" ON "NoteImage"("noteId");

-- CreateIndex
CREATE INDEX "NoteImage_orgId_idx" ON "NoteImage"("orgId");

-- AddForeignKey
ALTER TABLE "NoteImage" ADD CONSTRAINT "NoteImage_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "RepairNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
