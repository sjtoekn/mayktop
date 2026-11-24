-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "communityRequestId" INTEGER;

-- CreateTable
CREATE TABLE "CommunityRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requesterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "communityId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "CommunityRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommunityRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Place" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL,
    "description" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "website" TEXT,
    "dupKey" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "statusSiteRule" TEXT,
    "statusNote" TEXT,
    "statusChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Place_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "statusSiteRule" TEXT,
    "statusNote" TEXT,
    "statusChangedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "placeId" INTEGER,
    CONSTRAINT "Photo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Photo_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("caption", "category", "createdAt", "deletedAt", "editedAt", "file", "height", "id", "ownerId", "status", "statusChangedAt", "statusNote", "statusSiteRule", "title", "updatedAt", "viewCount", "width") SELECT "caption", "category", "createdAt", "deletedAt", "editedAt", "file", "height", "id", "ownerId", "status", "statusChangedAt", "statusNote", "statusSiteRule", "title", "updatedAt", "viewCount", "width" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
CREATE UNIQUE INDEX "Photo_file_key" ON "Photo"("file");
CREATE INDEX "Photo_createdAt_id_idx" ON "Photo"("createdAt", "id");
CREATE INDEX "Photo_placeId_createdAt_idx" ON "Photo"("placeId", "createdAt");
CREATE INDEX "Photo_ownerId_createdAt_idx" ON "Photo"("ownerId", "createdAt");
CREATE INDEX "Photo_status_createdAt_idx" ON "Photo"("status", "createdAt");
CREATE INDEX "Photo_category_createdAt_idx" ON "Photo"("category", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CommunityRequest_status_createdAt_idx" ON "CommunityRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityRequest_requesterId_createdAt_idx" ON "CommunityRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityRequest_slug_idx" ON "CommunityRequest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Place_dupKey_key" ON "Place"("dupKey");

-- CreateIndex
CREATE INDEX "Place_status_id_idx" ON "Place"("status", "id");

-- CreateIndex
CREATE INDEX "Place_type_id_idx" ON "Place"("type", "id");

-- CreateIndex
CREATE INDEX "Place_country_city_idx" ON "Place"("country", "city");

-- CreateIndex
CREATE INDEX "Place_name_idx" ON "Place"("name");
