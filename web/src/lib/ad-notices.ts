// The "your ad ends soon" email (ADS_PLAN Session 4c). Server only. Rules: ad-notice-rules.ts (npm run test:ad-appeal).
//
// There is no background job in this project yet (TODO 50 / 56), so the check runs in two places:
//  - whenever the admin Ads screen is opened (like endExpiredAds), and
//  - `npm run ad:notices` (scripts/ad-notices.ts), which a hosting schedule (cron) can run once an hour.
// An ad is marked (AdCampaign.endingSoonNoticeAt) BEFORE the email is sent, so two runs at the same moment cannot both send it.
// If sending fails, the mark is removed again and the next run tries once more. Nothing is charged or renewed automatically.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { adsConfig, siteConfig } from "@/config/site";
import { isLocale, t, type Locale } from "@/i18n";
import { daysLeft, isEndingSoon } from "@/lib/ad-notice-rules";
import { AdStatus, UserStatus } from "../../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

function siteUrl(path: string): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + path;
}

export type NoticeResult = { sent: number; failed: number };

/** Emails the advertiser of every running / paused ad whose end date is close and who has not been told yet. */
export async function sendEndingSoonNotices(now: Date = new Date()): Promise<NoticeResult> {
  const result: NoticeResult = { sent: 0, failed: 0 };
  const horizon = new Date(now.getTime() + adsConfig.endingSoonDays * DAY_MS);
  const candidates = await prisma.adCampaign.findMany({
    where: { status: { in: [AdStatus.ACTIVE, AdStatus.PAUSED] }, endingSoonNoticeAt: null, endDate: { gt: now, lte: horizon } },
    orderBy: { endDate: "asc" },
    take: 200,
    select: {
      id: true, status: true, title: true, contactEmail: true, endDate: true, endingSoonNoticeAt: true,
      advertiser: { select: { username: true, displayName: true, language: true, status: true } },
    },
  });

  for (const ad of candidates) {
    if (!ad.endDate || !isEndingSoon(ad, now, adsConfig.endingSoonDays)) continue;
    // 1. Mark it first (only if nobody else did): this is what makes "once per ad" true.
    const claimed = await prisma.adCampaign.updateMany({ where: { id: ad.id, endingSoonNoticeAt: null }, data: { endingSoonNoticeAt: now } });
    if (claimed.count !== 1) continue;
    if (ad.advertiser.status === UserStatus.DELETED) continue; // erased account: nobody to tell
    // 2. Send it, in the advertiser's own language.
    try {
      const locale: Locale = isLocale(ad.advertiser.language) ? ad.advertiser.language : "en";
      const params = {
        site: siteConfig.name,
        name: ad.advertiser.displayName || ad.advertiser.username,
        title: ad.title,
        end: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(ad.endDate),
        left: daysLeft(ad.endDate, now),
        url: siteUrl("/advertise/new"),
        mine: siteUrl("/advertise/my"),
      };
      await sendEmail({
        to: ad.contactEmail,
        subject: t("email.ad.endingSoon.subject", params, locale),
        text: t("email.ad.endingSoon.body", params, locale),
      });
      result.sent++;
    } catch (error) {
      console.error("ad ending-soon email failed:", error);
      result.failed++;
      // Take the mark off again so the next run tries once more (only if it is still our mark).
      await prisma.adCampaign.updateMany({ where: { id: ad.id, endingSoonNoticeAt: now }, data: { endingSoonNoticeAt: null } });
    }
  }
  return result;
}
