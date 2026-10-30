ALTER TABLE "ChatMessage"
ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "ChatMessage_chatId_senderId_clientMessageId_key"
ON "ChatMessage"("chatId", "senderId", "clientMessageId");
