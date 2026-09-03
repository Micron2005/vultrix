ALTER TABLE "Routine" ADD COLUMN "endDay" TEXT;
ALTER TABLE "Routine" ADD COLUMN "showStreak" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Routine" ADD COLUMN "completedDay" TEXT;
ALTER TABLE "RoutineCheckOff" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Routine" (
  id,"orgId","goalId",title,kind,weekdays,day,"dueTime",archived,
  "createdAt","updatedAt","endDay","showStreak"
)
SELECT
  md5(random()::text || g.id), g."orgId", g.id, g.title,
  CASE
    WHEN g.period='BY_DATE' AND date(g."startDate")=date(g."dueDate")
      THEN 'ONE_OFF'
    ELSE 'DAILY'
  END,
  '__HABIT_MIGRATION__',
  CASE
    WHEN g.period='BY_DATE' AND date(g."startDate")=date(g."dueDate")
      THEN to_char(g."dueDate",'YYYY-MM-DD')
  END,
  NULL, g.archived, g."createdAt", now(),
  CASE
    WHEN g.period='BY_DATE' AND date(g."startDate")<>date(g."dueDate")
      THEN to_char(g."dueDate",'YYYY-MM-DD')
  END,
  true
FROM "Goal" g
WHERE g.metric='HABIT';

INSERT INTO "RoutineItem" (
  id,"routineId","orgId",label,position,"createdAt"
)
SELECT
  md5(random()::text || r.id), r.id, r."orgId", r.title, 0, r."createdAt"
FROM "Routine" r
WHERE r.weekdays = '__HABIT_MIGRATION__';

INSERT INTO "RoutineCheckOff" (
  id,"itemId","routineId","orgId",day,late,skipped,note,"createdAt"
)
SELECT
  md5(random()::text || c.id), i.id, r.id, c."orgId", c.day, false, false,
  c.note, c."createdAt"
FROM "GoalCheckIn" c
JOIN "Routine" r ON r."goalId" = c."goalId"
  AND r.weekdays = '__HABIT_MIGRATION__'
JOIN "RoutineItem" i ON i."routineId" = r.id AND i.position = 0
WHERE c."orgId" = r."orgId";

UPDATE "Routine" r
SET "completedDay" = r.day, archived = true
WHERE r.kind = 'ONE_OFF'
  AND r.weekdays = '__HABIT_MIGRATION__'
  AND EXISTS (
    SELECT 1
    FROM "RoutineItem" i
    JOIN "RoutineCheckOff" c ON c."itemId" = i.id
    WHERE i."routineId" = r.id
      AND c.day = r.day
  );

UPDATE "Routine"
SET weekdays = NULL
WHERE weekdays = '__HABIT_MIGRATION__';

UPDATE "Routine"
SET "goalId" = NULL
WHERE "goalId" IN (SELECT id FROM "Goal" WHERE metric='HABIT');

DELETE FROM "Goal" WHERE metric='HABIT';
