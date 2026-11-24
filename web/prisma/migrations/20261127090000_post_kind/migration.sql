-- AlterTable: the kind of a post (question | article | video). Every older post is a "question" (SITE_PLAN A3).
ALTER TABLE "Post" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'question';

-- AlterTable: the link of a "video" post (a YouTube or Vimeo address); empty for the other kinds.
ALTER TABLE "Post" ADD COLUMN "videoUrl" TEXT;

-- CreateIndex: "show only the questions / articles / videos of a community"
CREATE INDEX "Post_communityId_kind_createdAt_idx" ON "Post"("communityId", "kind", "createdAt");
