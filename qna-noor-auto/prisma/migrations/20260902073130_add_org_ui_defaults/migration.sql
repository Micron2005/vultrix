ALTER TABLE "Organization"
  ADD COLUMN "uiDefaults" TEXT,
  ADD COLUMN "navDefault" TEXT,
  ADD COLUMN "dashDefault" TEXT;

ALTER TABLE "User"
  ALTER COLUMN "uiPalette" DROP NOT NULL,
  ALTER COLUMN "uiPalette" DROP DEFAULT,
  ALTER COLUMN "uiAccent" DROP NOT NULL,
  ALTER COLUMN "uiAccent" DROP DEFAULT,
  ALTER COLUMN "uiScale" DROP NOT NULL,
  ALTER COLUMN "uiScale" DROP DEFAULT,
  ALTER COLUMN "uiRadius" DROP NOT NULL,
  ALTER COLUMN "uiRadius" DROP DEFAULT,
  ALTER COLUMN "uiFont" DROP NOT NULL,
  ALTER COLUMN "uiFont" DROP DEFAULT;

UPDATE "User" SET "uiPalette" = NULL WHERE "uiPalette" = 'default';
UPDATE "User" SET "uiAccent" = NULL WHERE "uiAccent" = 'default';
UPDATE "User" SET "uiScale" = NULL WHERE "uiScale" = 'default';
UPDATE "User" SET "uiRadius" = NULL WHERE "uiRadius" = 'default';
UPDATE "User" SET "uiFont" = NULL WHERE "uiFont" = 'default';
