-- CreateTable
CREATE TABLE "SocialPinnedPost" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "socialPostId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialPinnedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SocialPinnedPost_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SocialPinnedPost_socialPostId_idx" ON "SocialPinnedPost"("socialPostId");
