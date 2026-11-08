CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "aProfileId" TEXT NOT NULL,
    "bProfileId" TEXT NOT NULL,
    "aReadAt" TIMESTAMP(3),
    "bReadAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastSenderProfileId" TEXT,
    "lastPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderProfileId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_aProfileId_bProfileId_key" ON "Conversation"("aProfileId", "bProfileId");

CREATE INDEX "Conversation_aProfileId_lastMessageAt_idx" ON "Conversation"("aProfileId", "lastMessageAt");

CREATE INDEX "Conversation_bProfileId_lastMessageAt_idx" ON "Conversation"("bProfileId", "lastMessageAt");

CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_aProfileId_fkey" FOREIGN KEY ("aProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_bProfileId_fkey" FOREIGN KEY ("bProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderProfileId_fkey" FOREIGN KEY ("senderProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
