-- CreateTable
CREATE TABLE "SocialReply" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "socialPostId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "SocialReply_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SocialReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SocialReply_socialPostId_createdAt_idx" ON "SocialReply"("socialPostId", "createdAt");

-- CreateIndex
CREATE INDEX "SocialReply_authorId_createdAt_idx" ON "SocialReply"("authorId", "createdAt");
