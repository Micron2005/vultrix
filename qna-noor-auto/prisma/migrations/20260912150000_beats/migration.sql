CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "songId" TEXT,
    "title" TEXT NOT NULL,
    "bpm" INTEGER NOT NULL DEFAULT 90,
    "swing" INTEGER NOT NULL DEFAULT 0,
    "kit" TEXT NOT NULL DEFAULT '808',
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Beat_orgId_updatedAt_idx" ON "Beat"("orgId", "updatedAt");

ALTER TABLE "Beat"
ADD CONSTRAINT "Beat_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Beat"
ADD CONSTRAINT "Beat_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
