ALTER TABLE "Organization" ADD COLUMN "focusPacks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'IDEA',
    "musicalKey" TEXT,
    "bpm" INTEGER,
    "genre" TEXT,
    "collaborators" TEXT,
    "notes" TEXT,
    "releasedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SongTask" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SongTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Song_orgId_stage_idx" ON "Song"("orgId", "stage");
CREATE INDEX "SongTask_songId_idx" ON "SongTask"("songId");

ALTER TABLE "Song"
ADD CONSTRAINT "Song_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongTask"
ADD CONSTRAINT "SongTask_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
