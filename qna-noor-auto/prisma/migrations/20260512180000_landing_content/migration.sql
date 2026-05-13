-- CreateTable
CREATE TABLE "LandingContent" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "html" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingContent_pkey" PRIMARY KEY ("id")
);
