CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "songId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "bpm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeSession_orgId_startedAt_idx" ON "PracticeSession"("orgId", "startedAt");

ALTER TABLE "PracticeSession"
ADD CONSTRAINT "PracticeSession_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeSession"
ADD CONSTRAINT "PracticeSession_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE SET NULL ON UPDATE CASCADE;
