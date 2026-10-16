CREATE TABLE "BeatVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "authorOrgId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL,
    "swing" INTEGER NOT NULL,
    "kit" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BeatVersion_beatId_createdAt_idx" ON "BeatVersion"("beatId", "createdAt");

ALTER TABLE "BeatVersion" ADD CONSTRAINT "BeatVersion_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeatVersion" ADD CONSTRAINT "BeatVersion_beatId_fkey"
    FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
