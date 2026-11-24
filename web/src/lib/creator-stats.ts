// Writes the per-page ad totals (ContentAdStat). Server only. One row per ad per page per UTC day; nothing about the visitor.
import { prisma } from "@/lib/prisma";
import { creatorsConfig } from "@/config/site";
import { utcMidnight } from "@/lib/ad-stats";

/**
 * Adds 1 to today's impressions of one ad on one page, unless that row has reached the daily cap.
 * Never throws: a failed count must not break a page (one missing count does not matter).
 * Returns true when a count was added.
 */
export async function countAdOnContent(adId: number, contentType: string, contentId: number): Promise<boolean> {
  const date = utcMidnight();
  const key = { date, contentType, contentId, adId };
  const cap = creatorsConfig.maxImpressionsPerContentPerDay;
  try {
    const bumped = await prisma.contentAdStat.updateMany({ where: { ...key, impressions: { lt: cap } }, data: { impressions: { increment: 1 } } });
    if (bumped.count > 0) return true;
    const row = await prisma.contentAdStat.findUnique({ where: { date_contentType_contentId_adId: key }, select: { impressions: true } });
    if (row) return false; // the row exists and is at the cap
    try {
      await prisma.contentAdStat.create({ data: { ...key, impressions: 1 } });
      return true;
    } catch {
      // Two visitors created today's row at the same moment: it exists now, so just add 1 (still under the cap).
      const again = await prisma.contentAdStat.updateMany({ where: { ...key, impressions: { lt: cap } }, data: { impressions: { increment: 1 } } });
      return again.count > 0;
    }
  } catch {
    return false;
  }
}
