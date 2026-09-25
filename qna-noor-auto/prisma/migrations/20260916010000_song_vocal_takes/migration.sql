CREATE TABLE "SongVocalTake" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audioDataUrl" TEXT NOT NULL,
    "audioMimeType" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongVocalTake_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SongVocalTake_songId_createdAt_idx" ON "SongVocalTake"("songId", "createdAt");

ALTER TABLE "SongVocalTake"
ADD CONSTRAINT "SongVocalTake_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongVocalTake"
ADD CONSTRAINT "SongVocalTake_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
