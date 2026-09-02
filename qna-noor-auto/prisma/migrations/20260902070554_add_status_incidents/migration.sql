-- CreateTable
CREATE TABLE "StatusIncident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'INVESTIGATING',
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusIncident_pkey" PRIMARY KEY ("id")
);
