CREATE TABLE "BeatTake" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audioDataUrl" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "offsetMs" INTEGER NOT NULL DEFAULT 0,
    "gain" INTEGER NOT NULL DEFAULT 100,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatTake_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BeatTake_beatId_createdAt_idx" ON "BeatTake"("beatId", "createdAt");

ALTER TABLE "BeatTake"
ADD CONSTRAINT "BeatTake_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BeatTake"
ADD CONSTRAINT "BeatTake_beatId_fkey"
FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
