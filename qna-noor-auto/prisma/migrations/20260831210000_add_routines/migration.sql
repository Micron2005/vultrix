CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "goalId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "weekdays" TEXT,
    "day" TEXT,
    "dueTime" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineItem" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "target" DOUBLE PRECISION,
    "unit" TEXT,
    "dueTime" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineCheckOff" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineCheckOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Routine_orgId_idx" ON "Routine"("orgId");
CREATE INDEX "Routine_goalId_idx" ON "Routine"("goalId");
CREATE INDEX "RoutineItem_routineId_position_idx" ON "RoutineItem"("routineId", "position");
CREATE INDEX "RoutineItem_orgId_idx" ON "RoutineItem"("orgId");
CREATE UNIQUE INDEX "RoutineCheckOff_itemId_day_key" ON "RoutineCheckOff"("itemId", "day");
CREATE INDEX "RoutineCheckOff_routineId_day_idx" ON "RoutineCheckOff"("routineId", "day");
CREATE INDEX "RoutineCheckOff_orgId_idx" ON "RoutineCheckOff"("orgId");

ALTER TABLE "Routine" ADD CONSTRAINT "Routine_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_routineId_fkey"
  FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineItem" ADD CONSTRAINT "RoutineItem_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineCheckOff" ADD CONSTRAINT "RoutineCheckOff_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "RoutineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineCheckOff" ADD CONSTRAINT "RoutineCheckOff_routineId_fkey"
  FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineCheckOff" ADD CONSTRAINT "RoutineCheckOff_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
