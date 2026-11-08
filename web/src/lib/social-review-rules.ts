// The small, plain rules of Social moderation and Report (SOCIAL_TODO 27 + 30, PROJECT.md 8j.9). No database and no
// "@/" imports here, so they are easy to read and to test (npm run test:social-review). The work is in
// src/lib/social-review.ts (hide, decide, dismiss) and src/lib/social-report.ts (Report).
// Social posts are moderated by ADMINS ONLY (8j.9) and with the SITE-WIDE rule keys (staffConfig.siteRules), not with
// community rules. The same two-people idea as community posts (8f): one admin hides, a DIFFERENT admin decides.
import { socialReportConfig, staffConfig } from "../config/site";
import { checkDecide, checkHide, cleanText, type ReviewError } from "./review-rules";

export type { ReviewError };
export type SocialStatus = "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED";

/** Is this one of the site-wide rule keys (HARASSMENT, HATE, ...)? */
export function isSiteRuleKey(key: unknown): key is string {
  return typeof key === "string" && staffConfig.siteRules.some((rule) => rule.key === key);
}

type Person = { actorId: string; actorIsAdmin: boolean };
const actorOf = (p: Person) => ({ id: p.actorId, isAdmin: p.actorIsAdmin, isCommunityModerator: false });

/** Step 1 (hide): may this person hide this post, with this rule and reason? */
export function checkSocialHide(
  p: Person & { authorId: string; status: SocialStatus; erased: boolean; siteRule: unknown; reason: string },
): { ok: true; siteRule: string; reason: string } | { error: ReviewError } {
  const reason = cleanText(p.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  const refused = checkHide({ actor: actorOf(p), authorId: p.authorId, status: p.status, erased: p.erased });
  if (refused) return { error: refused };
  if (!isSiteRuleKey(p.siteRule)) return { error: "rule" };
  return { ok: true, siteRule: p.siteRule, reason };
}

/** Step 2 (restore or remove): a DIFFERENT admin than the one who hid it, and not the author. */
export function checkSocialDecide(
  p: Person & { authorId: string; hiderId: string | null; status: SocialStatus; note: string },
): { ok: true; note: string } | { error: ReviewError } {
  const note = cleanText(p.note, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!note) return { error: "reason" };
  const refused = checkDecide({ actor: actorOf(p), authorId: p.authorId, hiderId: p.hiderId, status: p.status });
  if (refused) return { error: refused };
  return { ok: true, note };
}

/** Dismiss the open reports of a post that stays visible: an admin, not the author, a written note, post still visible. */
export function checkSocialDismiss(
  p: Person & { authorId: string; status: SocialStatus; note: string },
): { ok: true; note: string } | { error: ReviewError } {
  const note = cleanText(p.note, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!note) return { error: "reason" };
  if (!p.actorIsAdmin) return { error: "allowed" };
  if (p.actorId === p.authorId) return { error: "self" };
  if (p.status !== "VISIBLE") return { error: "state" };
  return { ok: true, note };
}

export type ReportRefusal = "invalid" | "self" | "notfound";

/** Report: may this person report this post, and is the form valid? A report is never a punishment: an admin reads it. */
export function checkSocialReport(p: {
  reporterId: string;
  authorId: string;
  status: SocialStatus;
  erased: boolean;
  authorShown: boolean; // the author's posts may be shown (social-visibility.ts)
  siteRule: unknown;
  reason: string;
}): { ok: true; siteRule: string; reason: string } | { error: ReportRefusal } {
  // The same visibility rule as the feeds: what a person cannot see, they cannot report.
  if (p.erased || p.status !== "VISIBLE" || !p.authorShown) return { error: "notfound" };
  if (p.reporterId === p.authorId) return { error: "self" };
  const reason = cleanText(p.reason, socialReportConfig.minReason, socialReportConfig.maxReason);
  if (!reason || !isSiteRuleKey(p.siteRule)) return { error: "invalid" };
  return { ok: true, siteRule: p.siteRule, reason };
}
