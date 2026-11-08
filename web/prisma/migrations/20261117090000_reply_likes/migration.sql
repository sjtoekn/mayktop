-- Fair ranking of replies (SOCIAL_TODO B10): a Like on a reply.
-- CreateTable
CREATE TABLE "SocialReplyLike" (
    "userId" TEXT NOT NULL,
    "socialReplyId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "socialReplyId"),
    CONSTRAINT "SocialReplyLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SocialReplyLike_socialReplyId_fkey" FOREIGN KEY ("socialReplyId") REFERENCES "SocialReply" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SocialReplyLike_socialReplyId_idx" ON "SocialReplyLike"("socialReplyId");
