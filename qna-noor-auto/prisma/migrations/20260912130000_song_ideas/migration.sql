CREATE TABLE "SongIdea" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "songId" TEXT,
    "title" TEXT,
    "body" TEXT,
    "audioDataUrl" TEXT,
    "audioMimeType" TEXT,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongIdea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SongIdea_orgId_createdAt_idx" ON "SongIdea"("orgId", "createdAt");
CREATE INDEX "SongIdea_songId_idx" ON "SongIdea"("songId");

ALTER TABLE "SongIdea"
ADD CONSTRAINT "SongIdea_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongIdea"
ADD CONSTRAINT "SongIdea_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
