ALTER TABLE "Organization"
ADD COLUMN "musicAddon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "musicAddonGraceUntil" TIMESTAMP(3);

UPDATE "Organization"
SET "musicAddonGraceUntil" = NOW() + INTERVAL '30 days'
WHERE "focusPacks" @> ARRAY['music']::TEXT[];
