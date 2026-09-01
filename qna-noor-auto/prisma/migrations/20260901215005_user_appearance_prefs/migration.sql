ALTER TABLE "User"
  ADD COLUMN "uiPalette" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "uiAccent" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "uiScale" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "uiRadius" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "uiFont" TEXT NOT NULL DEFAULT 'default';
