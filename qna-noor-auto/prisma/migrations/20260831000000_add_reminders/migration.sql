ALTER TABLE "Organization" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "to" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderLog_orgId_kind_targetKey_key"
ON "ReminderLog"("orgId", "kind", "targetKey");

CREATE INDEX "ReminderLog_orgId_createdAt_idx"
ON "ReminderLog"("orgId", "createdAt");

ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
