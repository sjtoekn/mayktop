-- AlterTable
ALTER TABLE "Post" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "deletedAt" DATETIME;
