// Writes the ad totals. Server only. One row per ad per UTC day (AdDailyStat); nothing about the visitor.
import { prisma } from "@/lib/prisma";

/** UTC midnight of a day (the `date` value of AdDailyStat). */
export function utcMidnight(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Adds 1 to today's impressions or clicks of an ad. Never throws: a failed count must not break a page. */
export async function countAd(adId: number, kind: "impression" | "click"): Promise<void> {
  const date = utcMidnight();
  const field = kind === "impression" ? "impressions" : "clicks";
  try {
    await prisma.adDailyStat.upsert({
      where: { adId_date: { adId, date } },
      create: { adId, date, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch {
    try {
      // Two visitors created today's row at the same moment: the row exists now, so just add 1.
      await prisma.adDailyStat.update({
        where: { adId_date: { adId, date } },
        data: { [field]: { increment: 1 } },
      });
    } catch {
      /* give up silently; one missing count does not matter */
    }
  }
}
