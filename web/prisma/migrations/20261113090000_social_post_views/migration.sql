-- AlterTable: one running total of views per Social post. No table of who looked at what.
ALTER TABLE "SocialPost" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
