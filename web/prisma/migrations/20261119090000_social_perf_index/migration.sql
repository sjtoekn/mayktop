-- CreateIndex
CREATE INDEX "Post_createdAt_id_idx" ON "Post"("createdAt", "id");

-- CreateIndex
CREATE INDEX "SocialRepost_createdAt_id_idx" ON "SocialRepost"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPostTag_createdAt_idx" ON "SocialPostTag"("createdAt");
