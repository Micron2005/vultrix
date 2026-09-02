UPDATE "Organization"
SET "aiAssistantEnabled" = false,
    "aiAssistantProvider" = 'OPENAI'
WHERE "aiAssistantProvider" = 'OLLAMA';

ALTER TABLE "Organization"
ALTER COLUMN "aiAssistantProvider"
SET DEFAULT 'OPENAI';

ALTER TABLE "Organization"
DROP COLUMN "aiHostedEnabled";
