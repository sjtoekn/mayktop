-- CreateTable
CREATE TABLE "ContentAdStat" (
    "date" DATETIME NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'POST',
    "contentId" INTEGER NOT NULL,
    "adId" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("date", "contentType", "contentId", "adId"),
    CONSTRAINT "ContentAdStat_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termsVersion" TEXT NOT NULL,
    "payoutCountry" TEXT,
    "payoutMethod" TEXT,
    "payoutDetails" TEXT,
    "payoutDetailsChangedAt" DATETIME,
    "earningsHold" BOOLEAN NOT NULL DEFAULT false,
    "earningsHoldNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EarningEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "amountMicroUsd" INTEGER NOT NULL,
    "adId" INTEGER,
    "contentType" TEXT,
    "contentId" INTEGER,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "spendAdId" INTEGER,
    "dedupeKey" TEXT,
    "payoutId" INTEGER,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EarningEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EarningEntry_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EarningEntry_spendAdId_fkey" FOREIGN KEY ("spendAdId") REFERENCES "AdCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EarningEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" DATETIME,
    CONSTRAINT "PayoutBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMicroUsd" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" DATETIME,
    "paidById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ContentAdStat_adId_date_idx" ON "ContentAdStat"("adId", "date");

-- CreateIndex
CREATE INDEX "ContentAdStat_contentType_contentId_idx" ON "ContentAdStat"("contentType", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "EarningEntry_dedupeKey_key" ON "EarningEntry"("dedupeKey");

-- CreateIndex
CREATE INDEX "EarningEntry_userId_status_payoutId_idx" ON "EarningEntry"("userId", "status", "payoutId");

-- CreateIndex
CREATE INDEX "EarningEntry_userId_createdAt_idx" ON "EarningEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EarningEntry_adId_idx" ON "EarningEntry"("adId");

-- CreateIndex
CREATE INDEX "EarningEntry_contentType_contentId_idx" ON "EarningEntry"("contentType", "contentId");

-- CreateIndex
CREATE INDEX "PayoutBatch_status_createdAt_idx" ON "PayoutBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_batchId_idx" ON "Payout"("batchId");

-- CreateIndex
CREATE INDEX "Payout_userId_status_idx" ON "Payout"("userId", "status");
