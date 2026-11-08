-- AlterTable
ALTER TABLE "AdCampaign" ADD COLUMN "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "AdCampaign" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'TEXT';
