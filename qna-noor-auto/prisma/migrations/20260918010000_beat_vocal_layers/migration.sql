CREATE TABLE "BeatVocalLayer" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gain" INTEGER NOT NULL DEFAULT 100,
    "pan" INTEGER NOT NULL DEFAULT 0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "solo" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeatVocalLayer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BeatTake" ADD COLUMN "layerId" TEXT;

CREATE INDEX "BeatVocalLayer_beatId_sortOrder_idx" ON "BeatVocalLayer"("beatId", "sortOrder");

ALTER TABLE "BeatVocalLayer" ADD CONSTRAINT "BeatVocalLayer_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BeatVocalLayer" ADD CONSTRAINT "BeatVocalLayer_beatId_fkey"
  FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BeatTake" ADD CONSTRAINT "BeatTake_layerId_fkey"
  FOREIGN KEY ("layerId") REFERENCES "BeatVocalLayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
