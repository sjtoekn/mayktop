-- CreateTable
CREATE TABLE "Short" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "processing" TEXT NOT NULL DEFAULT 'PROCESSING',
    "processingNote" TEXT,
    "durationMs" INTEGER,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "statusSiteRule" TEXT,
    "statusNote" TEXT,
    "statusChangedAt" DATETIME,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sharedSocialPostId" INTEGER,
    "readyAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Short_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortLike" (
    "userId" TEXT NOT NULL,
    "shortId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "shortId"),
    CONSTRAINT "ShortLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortLike_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortBookmark" (
    "userId" TEXT NOT NULL,
    "shortId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "shortId"),
    CONSTRAINT "ShortBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortBookmark_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shortId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" INTEGER,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VISIBLE',
    "statusSiteRule" TEXT,
    "statusNote" TEXT,
    "statusChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ShortComment_shortId_fkey" FOREIGN KEY ("shortId") REFERENCES "Short" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ShortComment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Short_file_key" ON "Short"("file");

-- CreateIndex
CREATE INDEX "Short_createdAt_id_idx" ON "Short"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Short_ownerId_createdAt_idx" ON "Short"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Short_processing_privacy_status_createdAt_idx" ON "Short"("processing", "privacy", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ShortLike_shortId_idx" ON "ShortLike"("shortId");

-- CreateIndex
CREATE INDEX "ShortBookmark_shortId_idx" ON "ShortBookmark"("shortId");

-- CreateIndex
CREATE INDEX "ShortComment_shortId_createdAt_idx" ON "ShortComment"("shortId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortComment_authorId_createdAt_idx" ON "ShortComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ShortComment_parentId_idx" ON "ShortComment"("parentId");
