-- CreateTable
CREATE TABLE "SocialPostBookmark" (
    "userId" TEXT NOT NULL,
    "socialPostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "socialPostId"),
    CONSTRAINT "SocialPostBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SocialPostBookmark_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SocialPostBookmark_userId_createdAt_idx" ON "SocialPostBookmark"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPostBookmark_socialPostId_idx" ON "SocialPostBookmark"("socialPostId");
