// The small, plain rules of the "your ad ends soon" email (ADS_PLAN Session 4c). No database here (npm run test:ad-appeal runs
// them). src/lib/ad-notices.ts does the work. The number of days is `adsConfig.endingSoonDays` (src/config/site.ts).
//
//  - Only a running (ACTIVE) or paused ad has an end date that is coming. (The days of the paid period keep counting while it is paused.)
//  - The email goes out ONCE per ad, when the end date is at most `days` days away and still in the future.
//  - An ad that already ended gets no "ending soon" email (it is too late for it to mean anything).
//  - Nothing is charged or renewed automatically: the email only says the period is ending and how to book a new ad.
const DAY_MS = 24 * 60 * 60 * 1000;

export function isEndingSoon(
  ad: { status: string; endDate: Date | null; endingSoonNoticeAt: Date | null },
  now: Date,
  days: number,
): boolean {
  if (ad.status !== "ACTIVE" && ad.status !== "PAUSED") return false;
  if (ad.endingSoonNoticeAt !== null) return false;
  if (ad.endDate === null) return false;
  const left = ad.endDate.getTime() - now.getTime();
  return left > 0 && left <= days * DAY_MS;
}

/** Whole days left, rounded up (a few hours left = "1"), never below 1. */
export function daysLeft(endDate: Date, now: Date): number {
  return Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS));
}
