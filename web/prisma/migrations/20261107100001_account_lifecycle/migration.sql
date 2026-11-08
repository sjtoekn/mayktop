-- AlterTable
ALTER TABLE "User" ADD COLUMN "suspendedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "suspendedUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "suspensionKind" TEXT;
ALTER TABLE "User" ADD COLUMN "suspensionNote" TEXT;
ALTER TABLE "User" ADD COLUMN "eraseAt" DATETIME;
