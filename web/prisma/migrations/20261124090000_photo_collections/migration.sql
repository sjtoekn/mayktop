-- CreateTable
CREATE TABLE "PhotoCollection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhotoCollectionItem" (
    "collectionId" INTEGER NOT NULL,
    "photoId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("collectionId", "photoId"),
    CONSTRAINT "PhotoCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PhotoCollection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PhotoCollectionItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoCollection_ownerId_name_key" ON "PhotoCollection"("ownerId", "name");

-- CreateIndex
CREATE INDEX "PhotoCollectionItem_photoId_idx" ON "PhotoCollectionItem"("photoId");
