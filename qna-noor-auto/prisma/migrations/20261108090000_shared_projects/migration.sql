CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "notesUpdatedAt" TIMESTAMP(3),
    "notesUpdatedByOrgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeOrgId" TEXT,
    "done" BOOLEAN NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdByOrgId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectFile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectPost" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorOrgId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectSongLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "addedByOrgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSongLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMember_projectId_orgId_key" ON "ProjectMember"("projectId", "orgId");

CREATE UNIQUE INDEX "ProjectSongLink_projectId_songId_key" ON "ProjectSongLink"("projectId", "songId");

CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

CREATE INDEX "ProjectMember_orgId_idx" ON "ProjectMember"("orgId");

CREATE INDEX "ProjectTask_projectId_sortOrder_idx" ON "ProjectTask"("projectId", "sortOrder");

CREATE INDEX "ProjectFile_projectId_idx" ON "ProjectFile"("projectId");

CREATE INDEX "ProjectPost_projectId_createdAt_idx" ON "ProjectPost"("projectId", "createdAt");

CREATE INDEX "ProjectSongLink_projectId_idx" ON "ProjectSongLink"("projectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectPost" ADD CONSTRAINT "ProjectPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectPost" ADD CONSTRAINT "ProjectPost_authorOrgId_fkey" FOREIGN KEY ("authorOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectSongLink" ADD CONSTRAINT "ProjectSongLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectSongLink" ADD CONSTRAINT "ProjectSongLink_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectSongLink" ADD CONSTRAINT "ProjectSongLink_addedByOrgId_fkey" FOREIGN KEY ("addedByOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
