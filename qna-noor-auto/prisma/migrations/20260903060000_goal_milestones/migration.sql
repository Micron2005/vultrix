CREATE TABLE "GoalMilestone" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "dueDay" TEXT,
    "doneDay" TEXT,
    "doneByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GoalMilestone_orgId_goalId_idx" ON "GoalMilestone"("orgId", "goalId");

ALTER TABLE "GoalMilestone"
    ADD CONSTRAINT "GoalMilestone_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalMilestone"
    ADD CONSTRAINT "GoalMilestone_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoalMilestone"
    ADD CONSTRAINT "GoalMilestone_doneByUserId_fkey"
    FOREIGN KEY ("doneByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
