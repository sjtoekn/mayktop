-- AlterTable
ALTER TABLE "User" ADD COLUMN "eraseWarnedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SafetyRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "accountCreatedAt" DATETIME NOT NULL,
    "erasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reasons" TEXT NOT NULL,
    "siteRule" TEXT,
    "banReason" TEXT,
    "bannedAt" DATETIME,
    "auditLogIds" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "appeals" TEXT NOT NULL,
    "keepUntil" DATETIME NOT NULL,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SafetyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SafetyRecord_userId_idx" ON "SafetyRecord"("userId");

-- CreateIndex
CREATE INDEX "SafetyRecord_keepUntil_idx" ON "SafetyRecord"("keepUntil");
