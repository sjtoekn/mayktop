-- AlterTable
ALTER TABLE "SocialReply" ADD COLUMN "statusChangedAt" DATETIME;
ALTER TABLE "SocialReply" ADD COLUMN "statusNote" TEXT;
ALTER TABLE "SocialReply" ADD COLUMN "statusSiteRule" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reporterId" TEXT NOT NULL,
    "postId" INTEGER,
    "commentId" INTEGER,
    "socialPostId" INTEGER,
    "siteRule" TEXT,
    "socialReplyId" INTEGER,
    "reportedUserId" TEXT,
    "ruleId" INTEGER,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_socialReplyId_fkey" FOREIGN KEY ("socialReplyId") REFERENCES "SocialReply" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Report_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("commentId", "createdAt", "id", "postId", "reason", "reporterId", "resolutionNote", "resolvedAt", "resolvedById", "ruleId", "siteRule", "socialPostId", "status") SELECT "commentId", "createdAt", "id", "postId", "reason", "reporterId", "resolutionNote", "resolvedAt", "resolvedById", "ruleId", "siteRule", "socialPostId", "status" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE UNIQUE INDEX "Report_reporterId_postId_key" ON "Report"("reporterId", "postId");
CREATE UNIQUE INDEX "Report_reporterId_commentId_key" ON "Report"("reporterId", "commentId");
CREATE UNIQUE INDEX "Report_reporterId_socialPostId_key" ON "Report"("reporterId", "socialPostId");
CREATE UNIQUE INDEX "Report_reporterId_socialReplyId_key" ON "Report"("reporterId", "socialReplyId");
CREATE UNIQUE INDEX "Report_reporterId_reportedUserId_key" ON "Report"("reporterId", "reportedUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
