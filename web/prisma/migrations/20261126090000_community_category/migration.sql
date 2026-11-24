-- AlterTable
ALTER TABLE "Community" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

-- AlterTable
ALTER TABLE "CommunityRequest" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

-- The first communities of the site get their topic (a community with another address stays "other" until an admin sets it:
-- npm run community:category -- <slug> <topic>)
UPDATE "Community" SET "category" = 'education' WHERE "slug" = 'learning';
UPDATE "Community" SET "category" = 'technology' WHERE "slug" = 'technology';
UPDATE "Community" SET "category" = 'lifestyle' WHERE "slug" = 'everyday-life';
UPDATE "Community" SET "category" = 'health' WHERE "slug" = 'health-basics';
UPDATE "Community" SET "category" = 'news' WHERE "slug" = 'local-news';
