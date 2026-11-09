-- Photo categories (PHOTO_TODO 9): one category key per photo; photos uploaded before this get "other".
ALTER TABLE "Photo" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
CREATE INDEX "Photo_category_createdAt_idx" ON "Photo"("category", "createdAt");
