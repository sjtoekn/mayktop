// The small, plain rules of ad review (TODO 48 Part 8 + ADS_PLAN Sessions 5 and 6). No database here, so they are easy to
// read and to test (npm run test:ad-review). src/lib/ad-review.ts does the work; the numbers are in `adsConfig` (src/config/site.ts).
//
//  1. An ad is reviewed once: SUBMITTED -> APPROVED (runs after payment) or REJECTED (rule + written reason, always).
//  2. Nobody reviews, pays for or restores their OWN ad (the advertiser is never the judge).
//  3. Payment is marked by hand and only AFTER approval (money is never taken for an ad that may be rejected).
//     APPROVED + paid -> ACTIVE; the dates are set then (`runDates`).
//  4. Pause is allowed on a running ad; restore only on a paused ad that has not passed its end date.
import { adsConfig } from "../config/site";
import type { MessageKey } from "../i18n/messages/en";

export type AdError =
  | "actor" // the first name is not an active admin
  | "notfound" // no such ad
  | "self" // the admin is the advertiser
  | "state" // the ad is not in the state this step needs (or it changed while you looked)
  | "rule" // reject without an ad policy rule
  | "reason" // written reason missing, too short or too long
  | "expired"; // the end date has passed

export type AdPolicyRule = (typeof adsConfig.policyRules)[number];

/** Visible text of each ad policy rule (used in the reject form and in the email). */
export const AD_RULE_TEXT: Record<AdPolicyRule, MessageKey> = {
  MISLEADING: "adRule.MISLEADING",
  LOOKS_LIKE_POST: "adRule.LOOKS_LIKE_POST",
  HARMFUL_PRODUCT: "adRule.HARMFUL_PRODUCT",
  UNSAFE_LINK: "adRule.UNSAFE_LINK",
  HATE_OR_ADULT: "adRule.HATE_OR_ADULT",
  TRACKING: "adRule.TRACKING",
  TECHNICAL: "adRule.TECHNICAL",
};

export function isPolicyRule(key: string): key is AdPolicyRule {
  return (adsConfig.policyRules as readonly string[]).includes(key);
}

export type AdFacts = { status: string; paymentStatus: string; advertiserId: string; endDate: Date | null };

/** Approve: only a SUBMITTED ad, never your own. */
export function checkApprove(ad: AdFacts, actorId: string): AdError | null {
  if (ad.advertiserId === actorId) return "self";
  if (ad.status !== "SUBMITTED") return "state";
  return null;
}

/** Reject: same as approve, and one ad policy rule must be named. */
export function checkReject(ad: AdFacts, actorId: string, rule: string): AdError | null {
  const basic = checkApprove(ad, actorId);
  if (basic) return basic;
  return isPolicyRule(rule) ? null : "rule";
}

/** Pause: only a running ad. (Anyone may pause, even their own ad: stopping is always safe.) */
export function checkPause(ad: AdFacts): AdError | null {
  return ad.status === "ACTIVE" ? null : "state";
}

/** Restore: only a PAUSED ad, not your own, and not after its end date. */
export function checkRestore(ad: AdFacts, actorId: string, now: Date): AdError | null {
  if (ad.advertiserId === actorId) return "self";
  if (ad.status !== "PAUSED") return "state";
  if (ad.endDate && ad.endDate.getTime() < now.getTime()) return "expired";
  return null;
}

/** Mark as paid: only an APPROVED, still UNPAID ad, not your own, not after its end date. */
export function checkPaid(ad: AdFacts, actorId: string, now: Date): AdError | null {
  if (ad.advertiserId === actorId) return "self";
  if (ad.status !== "APPROVED" || ad.paymentStatus !== "UNPAID") return "state";
  if (ad.endDate && ad.endDate.getTime() < now.getTime()) return "expired";
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The dates an ad runs once it is paid: it starts now (or on the start date the advertiser asked for, if that is still in the
 * future) and runs `days` days (or until the end date the advertiser asked for, if that is later than the start).
 */
export function runDates(ad: { startDate: Date | null; endDate: Date | null }, now: Date, days: number): { startDate: Date; endDate: Date } {
  const startDate = ad.startDate && ad.startDate.getTime() > now.getTime() ? ad.startDate : now;
  const endDate = ad.endDate && ad.endDate.getTime() > startDate.getTime() ? ad.endDate : new Date(startDate.getTime() + days * DAY_MS);
  return { startDate, endDate };
}

/** Click-through rate as a text ("2.4%"), or "-" when nothing was shown yet. */
export function ctrText(impressions: number, clicks: number): string {
  if (impressions <= 0) return "-";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}
