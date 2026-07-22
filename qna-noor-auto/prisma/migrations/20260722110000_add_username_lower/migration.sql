-- AlterTable
ALTER TABLE "User" ADD COLUMN "usernameLower" TEXT;

-- Backfill normalized usernames before making the column required.
UPDATE "User" SET "usernameLower" = LOWER("username");

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "usernameLower" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");
