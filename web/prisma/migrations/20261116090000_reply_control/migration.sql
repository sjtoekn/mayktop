-- Reply control (SOCIAL_TODO B9): who may reply to a post, and replies hidden by the author of the post.
-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN "replyPolicy" TEXT NOT NULL DEFAULT 'EVERYONE';

-- AlterTable
ALTER TABLE "SocialReply" ADD COLUMN "hiddenByAuthorAt" DATETIME;
