INSERT INTO "GoalEntry" (
    "id",
    "goalId",
    "orgId",
    "day",
    "value"
)
SELECT
    md5(random()::text || clock_timestamp()::text || g.id),
    g."id",
    g."orgId",
    to_char(g."updatedAt", 'YYYY-MM-DD'),
    g."manualProgress"
FROM "Goal" g
WHERE g."metric" = 'MANUAL'
  AND g."manualProgress" IS NOT NULL
  AND g."period" <> 'BY_DATE';
