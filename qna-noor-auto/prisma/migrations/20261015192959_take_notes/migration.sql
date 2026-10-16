CREATE TABLE "TakeNote" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "songTakeId" TEXT,
  "beatTakeId" TEXT,
  "authorOrgId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "atMs" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TakeNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TakeNote_exactly_one_take" CHECK (("songTakeId" IS NOT NULL) <> ("beatTakeId" IS NOT NULL))
);

CREATE INDEX "TakeNote_songTakeId_atMs_idx" ON "TakeNote"("songTakeId", "atMs");
CREATE INDEX "TakeNote_beatTakeId_atMs_idx" ON "TakeNote"("beatTakeId", "atMs");

ALTER TABLE "TakeNote" ADD CONSTRAINT "TakeNote_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeNote" ADD CONSTRAINT "TakeNote_songTakeId_fkey"
FOREIGN KEY ("songTakeId") REFERENCES "SongVocalTake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeNote" ADD CONSTRAINT "TakeNote_beatTakeId_fkey"
FOREIGN KEY ("beatTakeId") REFERENCES "BeatTake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
