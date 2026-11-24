-- Professional profile (SITE_PLAN C7/C8): profession, qualifications, website, social links and the "verified" badge.
-- Two new AuditAction values (USER_VERIFIED, USER_UNVERIFIED) and the VerifyMethod enum need no table change:
-- SQLite keeps enums as plain text.
ALTER TABLE "User" ADD COLUMN "profession" TEXT;
ALTER TABLE "User" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "User" ADD COLUMN "website" TEXT;
ALTER TABLE "User" ADD COLUMN "socialLinks" TEXT;
ALTER TABLE "User" ADD COLUMN "verifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "verifiedMethod" TEXT;
