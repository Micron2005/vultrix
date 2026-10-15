CREATE TABLE "SongMember" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SongMember_songId_orgId_key" ON "SongMember"("songId", "orgId");
CREATE INDEX "SongMember_orgId_idx" ON "SongMember"("orgId");

ALTER TABLE "SongMember" ADD CONSTRAINT "SongMember_songId_fkey"
FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SongMember" ADD CONSTRAINT "SongMember_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
