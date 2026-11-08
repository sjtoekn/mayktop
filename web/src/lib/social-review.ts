// Social moderation (SOCIAL_TODO 27): hide -> a DIFFERENT admin decides, plus dismissing reports. This is the ONE
// place these rules run for Social posts; it follows src/lib/review.ts (community posts) step by step:
//  1. HIDE    an admin hides a visible Social post with a SITE rule and a written reason. It leaves the feeds, nothing
//             is erased, the author gets an email, open reports become IN_REVIEW.
//  2. DECIDE  a DIFFERENT admin restores it (visible again) or removes it (gone from the site, still in the database),
//             and writes why. Open reports become DISMISSED (restore) or ACTIONED (remove).
//  3. DISMISS an admin closes the open reports of a post that stays visible, with a written note.
// Every step writes ONE audit-log row in the SAME transaction as the change (no action without a record). Nobody acts on
// their own post. The pure rules are in social-review-rules.ts. Not here on purpose: appeals (item 29), the removal
// notice on /social/<id> (item 28), the public mod log for Social (decision needed), hiding a quote text (needs a
// status column on SocialRepost).
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { appealConfig, siteConfig, reviewConfig } from "@/config/site";
import { socialAppealPath } from "@/lib/social-appeal-rules";
import { isLocale, t, type Locale } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { excerpt, isOverdue } from "@/lib/review-rules";
import {
  checkSocialDecide,
  checkSocialDismiss,
  checkSocialHide,
  type ReviewError,
} from "@/lib/social-review-rules";
import { AuditAction, AuditTarget, ContentStatus, ReportStatus, Role, UserStatus } from "../../generated/prisma/client";

export type { ReviewError };
export type SocialReviewResult = { ok: true; auditId: number } | { error: ReviewError };

class Refused extends Error {
  constructor(public code: ReviewError) {
    super(code);
  }
}

async function loadPost(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return prisma.socialPost.findUnique({
    where: { id },
    select: { id: true, authorId: true, body: true, status: true, deletedAt: true, statusSiteRule: true },
  });
}

/** The acting person: an ACTIVE account. `isAdmin` decides everything (Social is admins only). */
async function loadActor(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!u || u.status !== UserStatus.ACTIVE) return null;
  return { id: u.id, role: u.role, isAdmin: u.role === Role.ADMIN };
}

const siteUrl = (path: string) => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + path;

/** Email to the author (never fails the action: it is already saved; in the author's own language). */
async function notifyAuthor(
  post: { id: number; authorId: string; body: string },
  outcome: "hidden" | "removed" | "restored",
  p: { siteRule?: string; reason?: string; note?: string },
) {
  try {
    const a = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { email: true, username: true, displayName: true, language: true, status: true },
    });
    if (!a || a.status === UserStatus.DELETED) return;
    const locale: Locale = isLocale(a.language) ? a.language : "en";
    const params = {
      site: siteConfig.name,
      name: a.displayName || a.username,
      excerpt: excerpt(post.body, reviewConfig.excerptLength),
      rule: p.siteRule ? t(`siteRule.${p.siteRule}` as MessageKey, undefined, locale) : "",
      reason: p.reason ?? "",
      note: p.note ?? "",
      url: outcome === "removed" ? siteUrl("/social") : siteUrl(`/social/${post.id}`),
    };
    await sendEmail({
      to: a.email,
      subject: t(`email.socialreview.${outcome}.subject` as MessageKey, params, locale),
      text:
        t(`email.socialreview.${outcome}.body` as MessageKey, params, locale) +
        (outcome === "removed"
          ? "\n\n" + t("email.socialappeal.line", { days: appealConfig.windowDays, url: siteUrl(socialAppealPath("post", post.id)) }, locale)
          : ""),
    });
  } catch (error) {
    console.error("social review email failed:", error);
  }
}

/** Step 1: hide a visible Social post for review. `siteRule` is a key of staffConfig.siteRules (for example "SPAM"). */
export async function hideSocialPost(input: {
  actorId: string; postId: number; siteRule: string; reason: string;
}): Promise<SocialReviewResult> {
  const post = await loadPost(input.postId);
  if (!post) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const checked = checkSocialHide({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: post.authorId, status: post.status,
    erased: post.deletedAt !== null, siteRule: input.siteRule, reason: input.reason,
  });
  if ("error" in checked) return checked;

  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const changed = await tx.socialPost.updateMany({
        where: { id: post.id, status: ContentStatus.VISIBLE, deletedAt: null },
        data: {
          status: ContentStatus.HIDDEN_PENDING_REVIEW,
          statusSiteRule: checked.siteRule,
          statusNote: checked.reason,
          statusChangedAt: now,
        },
      });
      if (changed.count !== 1) throw new Refused("state");
      const open = await tx.report.findFirst({
        where: { socialPostId: post.id, status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      await tx.report.updateMany({
        where: { socialPostId: post.id, status: ReportStatus.OPEN },
        data: { status: ReportStatus.IN_REVIEW },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.CONTENT_HIDDEN,
          targetType: AuditTarget.SOCIAL_POST, targetId: String(post.id),
          siteRule: checked.siteRule, reportId: open?.id ?? null, reason: checked.reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(post, "hidden", { siteRule: checked.siteRule, reason: checked.reason });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Step 2: a DIFFERENT admin removes the hidden post or restores it, and writes why. */
export async function decideSocialReview(input: {
  actorId: string; postId: number; decision: "remove" | "restore"; note: string;
}): Promise<SocialReviewResult> {
  const post = await loadPost(input.postId);
  if (!post) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const hide = await prisma.auditLog.findFirst({
    where: { targetType: AuditTarget.SOCIAL_POST, targetId: String(post.id), action: AuditAction.CONTENT_HIDDEN },
    orderBy: { id: "desc" },
    select: { actorId: true, siteRule: true, reason: true },
  });
  const checked = checkSocialDecide({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: post.authorId,
    hiderId: hide?.actorId ?? null, status: post.status, note: input.note,
  });
  if ("error" in checked) return checked;
  const siteRule = hide?.siteRule ?? post.statusSiteRule;
  if (!siteRule) return { error: "rule" }; // a hidden post always has a rule; refuse rather than guess

  const now = new Date();
  const remove = input.decision === "remove";
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const data = remove
        ? { status: ContentStatus.REMOVED, statusChangedAt: now }
        : { status: ContentStatus.VISIBLE, statusSiteRule: null, statusNote: null, statusChangedAt: now };
      const changed = await tx.socialPost.updateMany({
        where: { id: post.id, status: ContentStatus.HIDDEN_PENDING_REVIEW },
        data,
      });
      if (changed.count !== 1) throw new Refused("state");
      const where = { socialPostId: post.id, status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } };
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
          targetType: AuditTarget.SOCIAL_POST, targetId: String(post.id),
          siteRule, reportId: report?.id ?? null, reason: checked.note,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(post, remove ? "removed" : "restored", {
      siteRule, reason: hide?.reason ?? "", note: checked.note,
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Close the open reports of a post that stays visible ("no rule was broken"), with a written note. */
export async function dismissSocialReports(input: {
  actorId: string; postId: number; note: string;
}): Promise<SocialReviewResult> {
  const post = await loadPost(input.postId);
  if (!post) return { error: "notfound" };
  const actor = await loadActor(input.actorId);
  if (!actor) return { error: "actor" };
  const checked = checkSocialDismiss({
    actorId: actor.id, actorIsAdmin: actor.isAdmin, authorId: post.authorId, status: post.status, note: input.note,
  });
  if ("error" in checked) return checked;

  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const first = await tx.report.findFirst({
        where: { socialPostId: post.id, status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!first) throw new Refused("state"); // nothing open: somebody else already closed them
      await tx.report.updateMany({
        where: { socialPostId: post.id, status: ReportStatus.OPEN },
        data: { status: ReportStatus.DISMISSED, resolvedAt: now, resolvedById: actor.id, resolutionNote: checked.note },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: actor.role, action: AuditAction.REPORT_DISMISSED,
          targetType: AuditTarget.SOCIAL_POST, targetId: String(post.id), reportId: first.id, reason: checked.note,
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

export const SOCIAL_PREVIEW_LENGTH = 240;

export type SocialReportRow = { reporter: string; siteRule: string; reason: string; createdAt: Date };
export type SocialReportedItem = {
  id: number;
  author: string;
  text: string;
  image: string | null; // address of the post's picture (patch-social-images); the picture route lets admins see it
  reports: SocialReportRow[];
  own: boolean; // THIS admin wrote the post: cannot act on it
};
export type SocialPendingItem = {
  id: number;
  author: string;
  text: string;
  image: string | null;
  hiddenBy: string | null;
  hiddenAt: Date | null;
  siteRule: string;
  reason: string;
  overdue: boolean;
  block: "self" | "same" | null; // why THIS admin cannot decide it
};

/** Open reports on posts that are still visible, and hidden posts that wait for a second admin (oldest first). */
export async function loadSocialQueue(meId: string): Promise<{ reported: SocialReportedItem[]; pending: SocialPendingItem[] }> {
  const now = Date.now();
  const [openReports, hiddenPosts] = await Promise.all([
    prisma.report.findMany({
      where: { status: ReportStatus.OPEN, socialPostId: { not: null }, socialPost: { status: ContentStatus.VISIBLE, deletedAt: null } },
      orderBy: { id: "asc" },
      select: {
        siteRule: true, reason: true, createdAt: true, socialPostId: true,
        reporter: { select: { username: true } },
        socialPost: { select: { id: true, body: true, mediaUrl: true, authorId: true, author: { select: { username: true } } } },
      },
    }),
    prisma.socialPost.findMany({
      where: { status: ContentStatus.HIDDEN_PENDING_REVIEW },
      orderBy: { statusChangedAt: "asc" },
      select: {
        id: true, body: true, mediaUrl: true, authorId: true, deletedAt: true, statusSiteRule: true, statusNote: true, statusChangedAt: true,
        author: { select: { username: true } },
      },
    }),
  ]);

  const byPost = new Map<number, SocialReportedItem>();
  for (const r of openReports) {
    const post = r.socialPost;
    if (!post) continue;
    const item = byPost.get(post.id) ?? {
      id: post.id, author: post.author.username, text: excerpt(post.body, SOCIAL_PREVIEW_LENGTH), image: post.mediaUrl, reports: [], own: post.authorId === meId,
    };
    item.reports.push({ reporter: r.reporter.username, siteRule: r.siteRule ?? "", reason: r.reason, createdAt: r.createdAt });
    byPost.set(post.id, item);
  }

  const hides = await prisma.auditLog.findMany({
    where: { action: AuditAction.CONTENT_HIDDEN, targetType: AuditTarget.SOCIAL_POST, targetId: { in: hiddenPosts.map((p) => String(p.id)) } },
    orderBy: { id: "desc" }, // newest first: the first row per post is the hide that put it in the queue
    select: { targetId: true, actorId: true, actor: { select: { username: true } } },
  });
  const hideBy = new Map<string, { actorId: string; username: string }>();
  for (const h of hides) if (!hideBy.has(h.targetId)) hideBy.set(h.targetId, { actorId: h.actorId, username: h.actor.username });

  const pending: SocialPendingItem[] = hiddenPosts.map((p) => {
    const hide = hideBy.get(String(p.id)) ?? null;
    const block = p.authorId === meId ? "self" : hide && hide.actorId === meId ? "same" : null;
    return {
      id: p.id, author: p.author.username,
      text: p.deletedAt ? "" : excerpt(p.body, SOCIAL_PREVIEW_LENGTH),
      image: p.deletedAt ? null : p.mediaUrl,
      hiddenBy: hide?.username ?? null, hiddenAt: p.statusChangedAt,
      siteRule: p.statusSiteRule ?? "", reason: p.statusNote ?? "",
      overdue: isOverdue(p.statusChangedAt, now, reviewConfig.dueDays), block,
    };
  });
  return { reported: [...byPost.values()], pending };
}
