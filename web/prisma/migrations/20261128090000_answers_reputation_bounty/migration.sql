-- AlterTable: the accepted answer of a question (SITE_PLAN B4)
ALTER TABLE "Comment" ADD COLUMN "acceptedAt" DATETIME;

-- CreateIndex: reputation counts the accepted answers of one person
CREATE INDEX "Comment_authorId_acceptedAt_idx" ON "Comment"("authorId", "acceptedAt");

-- CreateTable: a bounty on a question (SITE_PLAN B6)
CREATE TABLE "Bounty" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "offeredById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" DATETIME NOT NULL,
    "awardedToId" TEXT,
    "awardedCommentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedAt" DATETIME,
    CONSTRAINT "Bounty_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bounty_offeredById_fkey" FOREIGN KEY ("offeredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bounty_awardedToId_fkey" FOREIGN KEY ("awardedToId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_postId_key" ON "Bounty"("postId");
CREATE INDEX "Bounty_offeredById_status_idx" ON "Bounty"("offeredById", "status");
CREATE INDEX "Bounty_awardedToId_status_idx" ON "Bounty"("awardedToId", "status");
