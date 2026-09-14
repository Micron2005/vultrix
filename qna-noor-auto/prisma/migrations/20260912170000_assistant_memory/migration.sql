ALTER TABLE "User"
ADD COLUMN "aiMemoryEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AssistantMemory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'fact',
    "source" TEXT NOT NULL DEFAULT 'ASSISTANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantMemory_orgId_userId_updatedAt_idx"
ON "AssistantMemory"("orgId", "userId", "updatedAt");

ALTER TABLE "AssistantMemory"
ADD CONSTRAINT "AssistantMemory_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssistantMemory"
ADD CONSTRAINT "AssistantMemory_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
