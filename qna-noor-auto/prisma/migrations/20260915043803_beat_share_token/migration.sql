ALTER TABLE "Beat" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "Beat_shareToken_key" ON "Beat"("shareToken");
