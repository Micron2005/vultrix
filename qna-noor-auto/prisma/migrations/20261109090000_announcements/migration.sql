ALTER TABLE "Organization"
ADD COLUMN "announcementsOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "testSentAt" TIMESTAMP(3),
    "testSentTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementRecipient" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementRecipient_announcementId_email_key"
ON "AnnouncementRecipient"("announcementId", "email");

CREATE INDEX "AnnouncementRecipient_announcementId_status_idx"
ON "AnnouncementRecipient"("announcementId", "status");

ALTER TABLE "AnnouncementRecipient"
ADD CONSTRAINT "AnnouncementRecipient_announcementId_fkey"
FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnnouncementRecipient"
ADD CONSTRAINT "AnnouncementRecipient_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
