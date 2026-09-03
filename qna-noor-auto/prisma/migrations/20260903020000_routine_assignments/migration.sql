ALTER TABLE "Routine" ADD COLUMN "assigneeUserId" TEXT;
ALTER TABLE "RoutineCheckOff" ADD COLUMN "userId" TEXT;

CREATE INDEX "Routine_assigneeUserId_idx" ON "Routine"("assigneeUserId");

ALTER TABLE "Routine"
  ADD CONSTRAINT "Routine_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoutineCheckOff"
  ADD CONSTRAINT "RoutineCheckOff_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
