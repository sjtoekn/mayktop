// Social REPLY moderation and ACCOUNT reports (patch-social-report-more, SOCIAL_TODO A8 + A9). It follows
// src/lib/social-review.ts (Social posts) step by step, with a reply instead of a post:
//  1. HIDE    an admin hides a visible reply with a SITE rule and a written reason. It leaves the page, nothing is erased,
//             the author gets an email, open reports become IN_REVIEW.
//  2. DECIDE  a DIFFERENT admin restores it or removes it, and writes why. Open reports become DISMISSED / ACTIONED.
//  3. DISMISS an admin closes the open reports of a reply that stays visible, with a written note.
// ACCOUNT reports: a report never hides or suspends anybody. An admin reads it (/admin/social), may use the people tools
// (/admin/people) to suspend or ban, and then CLOSES the reports with a written note: "dismiss" (nothing needed) or
// "handled" (something was done). Both are one audit-log row (target USER), in the same transaction as the change.
// The pure rules are in social-review-rules.ts and social-report-more-rules.ts. Same two-people idea: nobody acts on
// their own reply or on reports about themselves.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { appealConfig, siteConfig, reviewConfig } from "@/config/site";
import { socialAppealPath } from "@/lib/social-appeal-rules";
import { isLocale, t, type Locale } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { excerpt, isOverdue } from "@/lib/review-rules";
import { checkSocialDecide, checkSocialDismiss, checkSocialHide, type ReviewError } from "@/lib/social-review-rules";
import { checkAccountClose, type AccountCloseOutcome } from "@/lib/social-report-more-rules";
import { AuditAction, AuditTarget, ContentStatus, ReportStatus, Role, UserStatus } from "../../generated/prisma/client";

export type { ReviewError };
export type SocialMoreResult = { ok: true; auditId: number } | { error: ReviewError };

class Refused extends Error {
  constructor(public code: ReviewError) {
    super(code);
  }
}

async function loadReply(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return prisma.socialReply.findUnique({
    where: { id },
    select: { id: true, authorId: true, body: true, status: true, deletedAt: true, statusSiteRule: true, socialPostId: true },
  });
}

/** The acting person: an ACTIVE account. `isAdmin` decides everything (Social is admins only, PROJECT.md 8j.9). */
async function loadActor(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!u || u.status !== UserStatus.ACTIVE) return null;
  return { id: u.id, role: u.role, isAdmin: u.role === Role.ADMIN };
}

const siteUrl = (path: string) => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + path;

/** Email to the reply's author (never fails the action: it is already saved; in the author's own language). */
async function notifyAuthor(
  reply: { id: number; authorId: string; body: string; socialPostId: number },
  outcome: "hidden" | "removed" | "restored",
  p: { siteRule?: string; reason?: string; note?: string },
) {
  try {
    const a = await prisma.user.findUnique({
      where: { id: reply.authorId },
      select: { email: true, username: true, displayName: true, language: true, status: true },
    });
    if (!a || a.status === UserStatus.DELETED) return;
    const locale: Locale = isLocale(a.language) ? a.language : "en";
    const params = {
      site: siteConfig.name,
      name: a.displayName || a.username,
      excerpt: excerpt(reply.body, reviewConfig.excerptLength),
      rule: p.siteRule ? t(`siteRule.${p.siteRule}` as MessageKey, undefined, locale) : "",
      reason: p.reason ?? "",
      note: p.note ?? "",
      url: outcome === "removed" ? siteUrl("/social") : siteUrl(`/social/${reply.socialPostId}`),
    };
    await sendEmail({
      to: a.email,
      subject: t(`email.socialreply.${outcome}.subject` as MessageKey, params, locale),
      text:
        t(`email.socialreply.${outcome}.body` as MessageKey, params, locale) +
        (outcome === "removed"
          ? "\n\n" + t("email.socialappeal.line", { days: appealConfig.windowDays, url: siteUrl(socialAppealPath("reply", reply.id)) }, locale)
          : ""),
    });
  } catch (error) {
    console.error("social reply review email failed:", error);
  }
}

/** Step 1: hide a visible Social reply for review. `siteRule` is a key of staffConfig.siteRules (for example "SPAM"). */
export async function hideSocialReply(input: {
  actorId: string; replyId: number; siteRule: string; reason: string;
}): Promise<SocialMoreResult> {
  const reply = await loadReply(input.replyId);
  if (!reply) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const checked = checkSocialHide({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: reply.authorId, status: reply.status,
    erased: reply.deletedAt !== null, siteRule: input.siteRule, reason: input.reason,
  });
  if ("error" in checked) return checked;

  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const changed = await tx.socialReply.updateMany({
        where: { id: reply.id, status: ContentStatus.VISIBLE, deletedAt: null },
        data: {
          status: ContentStatus.HIDDEN_PENDING_REVIEW,
          statusSiteRule: checked.siteRule,
          statusNote: checked.reason,
          statusChangedAt: now,
        },
      });
      if (changed.count !== 1) throw new Refused("state");
      const open = await tx.report.findFirst({
        where: { socialReplyId: reply.id, status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      await tx.report.updateMany({
        where: { socialReplyId: reply.id, status: ReportStatus.OPEN },
        data: { status: ReportStatus.IN_REVIEW },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.CONTENT_HIDDEN,
          targetType: AuditTarget.SOCIAL_REPLY, targetId: String(reply.id),
          siteRule: checked.siteRule, reportId: open?.id ?? null, reason: checked.reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(reply, "hidden", { siteRule: checked.siteRule, reason: checked.reason });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Step 2: a DIFFERENT admin removes the hidden reply or restores it, and writes why. */
export async function decideSocialReplyReview(input: {
  actorId: string; replyId: number; decision: "remove" | "restore"; note: string;
}): Promise<SocialMoreResult> {
  const reply = await loadReply(input.replyId);
  if (!reply) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const hide = await prisma.auditLog.findFirst({
    where: { targetType: AuditTarget.SOCIAL_REPLY, targetId: String(reply.id), action: AuditAction.CONTENT_HIDDEN },
    orderBy: { id: "desc" },
    select: { actorId: true, siteRule: true, reason: true },
  });
  const checked = checkSocialDecide({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: reply.authorId,
    hiderId: hide?.actorId ?? null, status: reply.status, note: input.note,
  });
  if ("error" in checked) return checked;
  const siteRule = hide?.siteRule ?? reply.statusSiteRule;
  if (!siteRule) return { error: "rule" }; // a hidden reply always has a rule; refuse rather than guess

  const now = new Date();
  const remove = input.decision === "remove";
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const data = remove
        ? { status: ContentStatus.REMOVED, statusChangedAt: now }
        : { status: ContentStatus.VISIBLE, statusSiteRule: null, statusNote: null, statusChangedAt: now };
      const changed = await tx.socialReply.updateMany({
        where: { id: reply.id, status: ContentStatus.HIDDEN_PENDING_REVIEW },
        data,
      });
      if (changed.count !== 1) throw new Refused("state");
      const where = { socialReplyId: reply.id, status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } };
      const report = await tx.report.findFirst({ where, orderBy: { id: "asc" }, select: { id: true } });
      await tx.report.updateMany({
        where,
        data: {
          status: remove ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
          resolvedAt: now, resolvedById: actor.id, resolutionNote: checked.note,
        },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role,
          action: remove ? AuditAction.CONTENT_REMOVED : AuditAction.CONTENT_RESTORED,
          targetType: AuditTarget.SOCIAL_REPLY, targetId: String(reply.id),
          siteRule, reportId: report?.id ?? null, reason: checked.note,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(reply, remove ? "removed" : "restored", { siteRule, reason: hide?.reason ?? "", note: checked.note });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Close the open reports of a reply that stays visible ("no rule was broken"), with a written note. */
export async function dismissSocialReplyReports(input: {
  actorId: string; replyId: number; note: string;
}): Promise<SocialMoreResult> {
  const reply = await loadReply(input.replyId);
  if (!reply) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const checked = checkSocialDismiss({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: reply.authorId, status: reply.status, note: input.note,
  });
  if ("error" in checked) return checked;

  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const first = await tx.report.findFirst({
        where: { socialReplyId: reply.id, status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!first) throw new Refused("state"); // nothing open: somebody else already closed them
      await tx.report.updateMany({
        where: { socialReplyId: reply.id, status: ReportStatus.OPEN },
        data: { status: ReportStatus.DISMISSED, resolvedAt: now, resolvedById: actor.id, resolutionNote: checked.note },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.REPORT_DISMISSED,
          targetType: AuditTarget.SOCIAL_REPLY, targetId: String(reply.id), reportId: first.id, reason: checked.note,
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Close the open reports about an ACCOUNT: "dismiss" (nothing needed) or "handled" (something was done), with a written note. */
export async function closeAccountReports(input: {
  actorId: string; reportedId: string; outcome: AccountCloseOutcome; note: string;
}): Promise<SocialMoreResult> {
  if (typeof input.reportedId !== "string" || input.reportedId === "") return { error: "notfound" };
  const target = await prisma.user.findUnique({ where: { id: input.reportedId }, select: { id: true } });
  if (!target) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const checked = checkAccountClose({ actorId: actor.id, actorIsAdmin: actor.isAdmin, reportedId: target.id, note: input.note });
  if ("error" in checked) return checked;

  const now = new Date();
  const handled = input.outcome === "handled";
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const first = await tx.report.findFirst({
        where: { reportedUserId: target.id, status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!first) throw new Refused("state"); // nothing open: somebody else already closed them
      await tx.report.updateMany({
        where: { reportedUserId: target.id, status: ReportStatus.OPEN },
        data: {
          status: handled ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
          resolvedAt: now, resolvedById: actor.id, resolutionNote: checked.note,
        },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role,
          action: handled ? AuditAction.REPORT_ACTIONED : AuditAction.REPORT_DISMISSED,
          targetType: AuditTarget.USER, targetId: target.id, reportId: first.id, reason: checked.note,
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

// ---------------------------------------------------------------- the admin screen

export const SOCIAL_REPLY_PREVIEW_LENGTH = 240;

export type MoreReportRow = { reporter: string; siteRule: string; reason: string; createdAt: Date };
export type ReportedReplyItem = {
  id: number;
  postId: number;
  author: string;
  text: string;
  reports: MoreReportRow[];
  own: boolean; // THIS admin wrote the reply: cannot act on it
};
export type PendingReplyItem = {
  id: number;
  postId: number;
  author: string;
  text: string;
  hiddenBy: string | null;
  hiddenAt: Date | null;
  siteRule: string;
  reason: string;
  overdue: boolean;
  block: "self" | "same" | null; // why THIS admin cannot decide it
};
export type ReportedAccountItem = {
  id: string;
  username: string;
  status: string;
  reports: MoreReportRow[];
  own: boolean; // the reports are about THIS admin: cannot act on them
};

/** Open reports on replies still visible, hidden replies waiting for a second admin, and open reports on accounts. */
export async function loadSocialMoreQueue(meId: string): Promise<{
  replies: ReportedReplyItem[]; pending: PendingReplyItem[]; accounts: ReportedAccountItem[];
}> {
  const now = Date.now();
  const [replyReports, hiddenReplies, accountReports] = await Promise.all([
    prisma.report.findMany({
      where: { status: ReportStatus.OPEN, socialReplyId: { not: null }, socialReply: { status: ContentStatus.VISIBLE, deletedAt: null } },
      orderBy: { id: "asc" },
      select: {
        siteRule: true, reason: true, createdAt: true,
        reporter: { select: { username: true } },
        socialReply: { select: { id: true, body: true, authorId: true, socialPostId: true, author: { select: { username: true } } } },
      },
    }),
    prisma.socialReply.findMany({
      where: { status: ContentStatus.HIDDEN_PENDING_REVIEW },
      orderBy: { statusChangedAt: "asc" },
      select: {
        id: true, body: true, authorId: true, socialPostId: true, deletedAt: true, statusSiteRule: true, statusNote: true, statusChangedAt: true,
        author: { select: { username: true } },
      },
    }),
    prisma.report.findMany({
      where: { status: ReportStatus.OPEN, reportedUserId: { not: null } },
      orderBy: { id: "asc" },
      select: {
        siteRule: true, reason: true, createdAt: true,
        reporter: { select: { username: true } },
        reportedUser: { select: { id: true, username: true, status: true } },
      },
    }),
  ]);

  const byReply = new Map<number, ReportedReplyItem>();
  for (const r of replyReports) {
    const reply = r.socialReply;
    if (!reply) continue;
    const item = byReply.get(reply.id) ?? {
      id: reply.id, postId: reply.socialPostId, author: reply.author.username,
      text: excerpt(reply.body, SOCIAL_REPLY_PREVIEW_LENGTH), reports: [], own: reply.authorId === meId,
    };
    item.reports.push({ reporter: r.reporter.username, siteRule: r.siteRule ?? "", reason: r.reason, createdAt: r.createdAt });
    byReply.set(reply.id, item);
  }

  const hides = await prisma.auditLog.findMany({
    where: { action: AuditAction.CONTENT_HIDDEN, targetType: AuditTarget.SOCIAL_REPLY, targetId: { in: hiddenReplies.map((p) => String(p.id)) } },
    orderBy: { id: "desc" }, // newest first: the first row per reply is the hide that put it in the queue
    select: { targetId: true, actorId: true, actor: { select: { username: true } } },
  });
  const hideBy = new Map<string, { actorId: string; username: string }>();
  for (const h of hides) if (!hideBy.has(h.targetId)) hideBy.set(h.targetId, { actorId: h.actorId, username: h.actor.username });

  const pending: PendingReplyItem[] = hiddenReplies.map((p) => {
    const hide = hideBy.get(String(p.id)) ?? null;
    const block = p.authorId === meId ? "self" : hide && hide.actorId === meId ? "same" : null;
    return {
      id: p.id, postId: p.socialPostId, author: p.author.username,
      text: p.deletedAt ? "" : excerpt(p.body, SOCIAL_REPLY_PREVIEW_LENGTH),
      hiddenBy: hide?.username ?? null, hiddenAt: p.statusChangedAt,
      siteRule: p.statusSiteRule ?? "", reason: p.statusNote ?? "",
      overdue: isOverdue(p.statusChangedAt, now, reviewConfig.dueDays), block,
    };
  });

  const byAccount = new Map<string, ReportedAccountItem>();
  for (const r of accountReports) {
    const user = r.reportedUser;
    if (!user) continue;
    const item = byAccount.get(user.id) ?? { id: user.id, username: user.username, status: user.status, reports: [], own: user.id === meId };
    item.reports.push({ reporter: r.reporter.username, siteRule: r.siteRule ?? "", reason: r.reason, createdAt: r.createdAt });
    byAccount.set(user.id, item);
  }
  return { replies: [...byReply.values()], pending, accounts: [...byAccount.values()] };
}
