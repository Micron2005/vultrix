-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "aiAssistantApiKeyEncrypted" TEXT,
ADD COLUMN     "aiAssistantEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiAssistantName" TEXT NOT NULL DEFAULT 'Assistant',
ADD COLUMN     "aiAssistantProvider" TEXT NOT NULL DEFAULT 'OLLAMA',
ADD COLUMN     "aiAssistantVoice" TEXT;

