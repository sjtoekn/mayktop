-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "advertiserId" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "communityId" INTEGER,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAt" DATETIME,
    "submittedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewRule" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdCampaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdCampaign_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdCampaign_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "adId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("adId", "date"),
    CONSTRAINT "AdDailyStat_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdCampaign_status_slot_idx" ON "AdCampaign"("status", "slot");

-- CreateIndex
CREATE INDEX "AdCampaign_advertiserId_createdAt_idx" ON "AdCampaign"("advertiserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdCampaign_communityId_idx" ON "AdCampaign"("communityId");
