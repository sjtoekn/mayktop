// The small, plain rules for reporting a Social REPLY and a Social ACCOUNT, and for closing reports about an account
// (patch-social-report-more, SOCIAL_TODO A8 + A9). No database and no "@/" imports, so they are easy to read and to
// test (npm run test:social-report-more). The work is in social-report-more.ts (Report) and social-reply-review.ts
// (hide / decide / dismiss a reply, close account reports). A reply is judged by the SAME rules as a post (see
// social-review-rules.ts); an account is never hidden by a report, an admin reads it and writes what was done.
import { socialReportConfig, staffConfig } from "../config/site";
import { cleanText, type ReviewError } from "./review-rules";
import { checkSocialReport, isSiteRuleKey, type ReportRefusal, type SocialStatus } from "./social-review-rules";

/** Report a reply: the reply itself AND the post it is under must be something the reporter may see. */
export function checkSocialReplyReport(p: {
  reporterId: string;
  authorId: string;
  status: SocialStatus;
  erased: boolean;
  authorShown: boolean; // the reply author's content may be shown (social-visibility.ts)
  parentShown: boolean; // the post under which the reply stands may be shown
  siteRule: unknown;
  reason: string;
}): { ok: true; siteRule: string; reason: string } | { error: ReportRefusal } {
  if (!p.parentShown) return { error: "notfound" };
  return checkSocialReport({
    reporterId: p.reporterId,
    authorId: p.authorId,
    status: p.status,
    erased: p.erased,
    authorShown: p.authorShown,
    siteRule: p.siteRule,
    reason: p.reason,
  });
}

/** Report an account: not yourself, an account whose content may be shown, a site rule and a reason of the right length. */
export function checkSocialAccountReport(p: {
  reporterId: string;
  reportedId: string;
  shown: boolean; // the account may be shown (social-visibility.ts)
  siteRule: unknown;
  reason: string;
}): { ok: true; siteRule: string; reason: string } | { error: ReportRefusal } {
  if (!p.shown) return { error: "notfound" };
  if (p.reporterId === p.reportedId) return { error: "self" };
  const reason = cleanText(p.reason, socialReportConfig.minReason, socialReportConfig.maxReason);
  if (!reason || !isSiteRuleKey(p.siteRule)) return { error: "invalid" };
  return { ok: true, siteRule: p.siteRule, reason };
}

export type AccountCloseOutcome = "dismiss" | "handled";

/** Closing the open reports about an account: an admin, not the reported person, a written note. */
export function checkAccountClose(p: {
  actorId: string;
  actorIsAdmin: boolean;
  reportedId: string;
  note: string;
}): { ok: true; note: string } | { error: ReviewError } {
  const note = cleanText(p.note, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!note) return { error: "reason" };
  if (!p.actorIsAdmin) return { error: "allowed" };
  if (p.actorId === p.reportedId) return { error: "self" };
  return { ok: true, note };
}
