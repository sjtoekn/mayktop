-- Edit history of Social posts (SOCIAL_TODO item 6): the text that an edit replaced, kept so people can see earlier versions.
-- CreateTable
CREATE TABLE "SocialPostEdit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "socialPostId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "writtenAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPostEdit_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SocialPostEdit_socialPostId_id_idx" ON "SocialPostEdit"("socialPostId", "id");
