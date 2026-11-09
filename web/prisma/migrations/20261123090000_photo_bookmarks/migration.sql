-- CreateTable
CREATE TABLE "PhotoBookmark" (
    "userId" TEXT NOT NULL,
    "photoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "photoId"),
    CONSTRAINT "PhotoBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PhotoBookmark_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PhotoBookmark_userId_createdAt_idx" ON "PhotoBookmark"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoBookmark_photoId_idx" ON "PhotoBookmark"("photoId");
