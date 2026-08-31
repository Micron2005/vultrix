ALTER TABLE "Goal"
ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'AT_LEAST',
ADD COLUMN "unit" TEXT;

CREATE TABLE "GoalCheckIn" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalCheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoalEntry" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoalCheckIn_goalId_day_key"
ON "GoalCheckIn"("goalId", "day");
CREATE INDEX "GoalCheckIn_orgId_idx" ON "GoalCheckIn"("orgId");

CREATE INDEX "GoalEntry_goalId_day_idx" ON "GoalEntry"("goalId", "day");
CREATE INDEX "GoalEntry_orgId_idx" ON "GoalEntry"("orgId");

ALTER TABLE "GoalCheckIn"
ADD CONSTRAINT "GoalCheckIn_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "Goal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalCheckIn"
ADD CONSTRAINT "GoalCheckIn_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalEntry"
ADD CONSTRAINT "GoalEntry_goalId_fkey"
FOREIGN KEY ("goalId") REFERENCES "Goal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalEntry"
ADD CONSTRAINT "GoalEntry_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
