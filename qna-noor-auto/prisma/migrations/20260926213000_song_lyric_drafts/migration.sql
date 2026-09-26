CREATE TABLE "SongLyricDraft" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lyrics" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongLyricDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SongLyricDraft_songId_createdAt_idx" ON "SongLyricDraft"("songId", "createdAt");

ALTER TABLE "SongLyricDraft" ADD CONSTRAINT "SongLyricDraft_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongLyricDraft" ADD CONSTRAINT "SongLyricDraft_songId_fkey"
  FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
