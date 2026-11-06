-- Date-only expenses and income used to be saved as midnight UTC, which is
-- the previous evening in US time zones. Move those rows to midnight in the
-- organization's own time zone, matching sales and report ranges.
WITH org_zone AS (
  SELECT o."id",
         COALESCE(z."name", 'America/New_York') AS zone
  FROM "Organization" o
  LEFT JOIN pg_timezone_names z ON z."name" = o."timezone"
)
UPDATE "Expense" e
SET "paidAt" = ((e."paidAt"::date)::timestamp AT TIME ZONE oz.zone) AT TIME ZONE 'UTC'
FROM org_zone oz
WHERE e."orgId" = oz."id"
  AND e."paidAt" = date_trunc('day', e."paidAt");

WITH org_zone AS (
  SELECT o."id",
         COALESCE(z."name", 'America/New_York') AS zone
  FROM "Organization" o
  LEFT JOIN pg_timezone_names z ON z."name" = o."timezone"
)
UPDATE "Income" i
SET "receivedAt" = ((i."receivedAt"::date)::timestamp AT TIME ZONE oz.zone) AT TIME ZONE 'UTC'
FROM org_zone oz
WHERE i."orgId" = oz."id"
  AND i."receivedAt" = date_trunc('day', i."receivedAt");
