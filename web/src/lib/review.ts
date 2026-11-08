// Hidden pending review: how a post or comment leaves the site without being deleted in one step
// (TODO 38, PROJECT.md 3 rule 4 + 8f). This is the ONE place these rules live. Today it is called by
// `npm run review` (scripts/review.ts); the Phase 4 moderator panel will call the same functions.
//
// Two steps, two different people:
//  1. HIDE    a moderator of that community (or an admin) hides the post / comment: it shows "hidden for
//             review" with the rule and the reason, nothing is erased, the author gets an email.
//  2. DECIDE  a DIFFERENT moderator / admin reads the case and either RESTORES it (visible again) or
//             REMOVES it (gone from the site, still in the database and in the public mod log), and writes why.
// Every step needs a community rule and a written reason, writes ONE audit-log row in the same transaction
// as the change (no action without a record), and emails the author. Nobody can act on their own content.
// Open reports about the content follow along (IN_REVIEW -> ACTIONED / DISMISSED).
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { siteConfig, staffConfig, reviewConfig } from "@/config/site";
import { isLocale, t, type Locale } from "@/i18n";
import {
  checkDecide,
  checkHide,
  cleanText,
  excerpt,
  isOverdue,
  type Actor,
  type ReviewError,
} from "@/lib/review-rules";
import {
  AuditAction,
  AuditTarget,
  ContentStatus,
  MemberRole,
  ReportStatus,
  Role,
  UserStatus,
} from "../../generated/prisma/client";

export type ReviewKind = "post" | "comment";
export type ReviewResult = { ok: true; auditId: number } | { error: ReviewError };
export type { ReviewError };

class Refused extends Error {
  constructor(public code: ReviewError) {
    super(code);
  }
}

type Loaded = {
  id: number;
  kind: ReviewKind;
  authorId: string;
  communityId: number;
  communitySlug: string;
  postId: number; // the post to link to (for a comment: the post it belongs to)
  text: string; // post title / comment text, only for a short preview
  status: ContentStatus;
  erased: boolean;
  statusRuleId: number | null;
};

async function loadContent(kind: ReviewKind, id: number): Promise<Loaded | null> {
  if (kind === "post") {
    const p = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true, authorId: true, communityId: true, title: true, status: true, deletedAt: true, statusRuleId: true,
        community: { select: { slug: true } },
      },
    });
    if (!p) return null;
    return {
      id: p.id, kind, authorId: p.authorId, communityId: p.communityId, communitySlug: p.community.slug,
      postId: p.id, text: p.title, status: p.status, erased: p.deletedAt !== null, statusRuleId: p.statusRuleId,
    };
  }
  const c = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true, authorId: true, postId: true, body: true, status: true, deletedAt: true, statusRuleId: true,
      post: { select: { communityId: true, community: { select: { slug: true } } } },
    },
  });
  if (!c) return null;
  return {
    id: c.id, kind, authorId: c.authorId, communityId: c.post.communityId, communitySlug: c.post.community.slug,
    postId: c.postId, text: c.body, status: c.status, erased: c.deletedAt !== null, statusRuleId: c.statusRuleId,
  };
}

/** The acting person: must be an ACTIVE account. `isCommunityModerator` is about THIS community only. */
async function loadActor(username: string, communityId: number): Promise<Actor | null> {
  const u = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true },
  });
  if (!u || u.status !== UserStatus.ACTIVE) return null;
  const m = await prisma.membership.findUnique({
    where: { userId_communityId: { userId: u.id, communityId } },
    select: { role: true },
  });
  return { id: u.id, isAdmin: u.role === Role.ADMIN, isCommunityModerator: m?.role === MemberRole.MODERATOR };
}

async function actorRole(id: string): Promise<Role> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id }, select: { role: true } });
  return u.role;
}

const target = (kind: ReviewKind) => (kind === "post" ? AuditTarget.POST : AuditTarget.COMMENT);
const reportWhere = (kind: ReviewKind, id: number) => (kind === "post" ? { postId: id } : { commentId: id });

function siteUrl(path: string): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + path;
}

/** Email to the author (never fails the action: it is already saved; in the author's own language). */
async function notifyAuthor(
  c: Loaded,
  outcome: "hidden" | "removed" | "restored",
  p: { rule?: string; reason?: string; note?: string },
) {
  try {
    const a = await prisma.user.findUnique({
      where: { id: c.authorId },
      select: { email: true, username: true, displayName: true, language: true, status: true },
    });
    if (!a || a.status === UserStatus.DELETED) return;
    const locale: Locale = isLocale(a.language) ? a.language : "en";
    const params = {
      site: siteConfig.name,
      name: a.displayName || a.username,
      kind: t(c.kind === "post" ? "modlog.target.post" : "modlog.target.comment", undefined, locale),
      excerpt: excerpt(c.text, reviewConfig.excerptLength),
      community: c.communitySlug,
      rule: p.rule ?? "",
      reason: p.reason ?? "",
      note: p.note ?? "",
      url: outcome === "removed" ? siteUrl("/modlog") : siteUrl(`/post/${c.postId}`),
    };
    await sendEmail({
      to: a.email,
      subject: t(`email.review.${outcome}.subject`, params, locale),
      text: t(`email.review.${outcome}.body`, params, locale),
    });
  } catch (error) {
    console.error("review email failed:", error);
  }
}

/** Step 1: hide a visible post / comment for review. `rule` is the community's rule NUMBER (1, 2, 3 ...). */
export async function hideForReview(input: {
  actor: string; kind: ReviewKind; id: number; rule: number; reason: string;
}): Promise<ReviewResult> {
  const reason = cleanText(input.reason, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!reason) return { error: "reason" };
  if (!Number.isInteger(input.id) || input.id < 1) return { error: "notfound" };
  const content = await loadContent(input.kind, input.id);
  if (!content) return { error: "notfound" };
  const actor = await loadActor(input.actor, content.communityId);
  if (!actor) return { error: "actor" };
  const refused = checkHide({ actor, authorId: content.authorId, status: content.status, erased: content.erased });
  if (refused) return { error: refused };
  const rule = Number.isInteger(input.rule)
    ? await prisma.rule.findUnique({
        where: { communityId_position: { communityId: content.communityId, position: input.rule } },
        select: { id: true, position: true, title: true, archivedAt: true },
      })
    : null;
  if (!rule || rule.archivedAt) return { error: "rule" };

  const role = await actorRole(actor.id);
  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const changed =
        content.kind === "post"
          ? await tx.post.updateMany({
              where: { id: content.id, status: ContentStatus.VISIBLE, deletedAt: null },
              data: { status: ContentStatus.HIDDEN_PENDING_REVIEW, statusRuleId: rule.id, statusNote: reason, statusChangedAt: now },
            })
          : await tx.comment.updateMany({
              where: { id: content.id, status: ContentStatus.VISIBLE, deletedAt: null },
              data: { status: ContentStatus.HIDDEN_PENDING_REVIEW, statusRuleId: rule.id, statusNote: reason, statusChangedAt: now },
            });
      if (changed.count !== 1) throw new Refused("state");
      const open = await tx.report.findFirst({
        where: { ...reportWhere(content.kind, content.id), status: ReportStatus.OPEN },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      await tx.report.updateMany({
        where: { ...reportWhere(content.kind, content.id), status: ReportStatus.OPEN },
        data: { status: ReportStatus.IN_REVIEW },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: role, action: AuditAction.CONTENT_HIDDEN,
          targetType: target(content.kind), targetId: String(content.id),
          communityId: content.communityId, ruleId: rule.id, reportId: open?.id ?? null, reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(content, "hidden", { rule: `${rule.position}. ${rule.title}`, reason });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Step 2: a DIFFERENT moderator / admin removes the hidden content or restores it, and writes why. */
export async function decideReview(input: {
  actor: string; kind: ReviewKind; id: number; decision: "remove" | "restore"; note: string;
}): Promise<ReviewResult> {
  const note = cleanText(input.note, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!note) return { error: "reason" };
  if (!Number.isInteger(input.id) || input.id < 1) return { error: "notfound" };
  const content = await loadContent(input.kind, input.id);
  if (!content) return { error: "notfound" };
  const actor = await loadActor(input.actor, content.communityId);
  if (!actor) return { error: "actor" };

  const hide = await prisma.auditLog.findFirst({
    where: { targetType: target(content.kind), targetId: String(content.id), action: AuditAction.CONTENT_HIDDEN },
    orderBy: { id: "desc" },
    select: { actorId: true, ruleId: true, reason: true },
  });
  const refused = checkDecide({
    actor, authorId: content.authorId, hiderId: hide?.actorId ?? null, status: content.status,
  });
  if (refused) return { error: refused };
  const ruleId = hide?.ruleId ?? content.statusRuleId;
  if (ruleId === null) return { error: "rule" }; // a hidden item always has a rule; refuse rather than guess
  const rule = await prisma.rule.findUnique({ where: { id: ruleId }, select: { position: true, title: true } });

  const role = await actorRole(actor.id);
  const now = new Date();
  const remove = input.decision === "remove";
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const data = remove
        ? { status: ContentStatus.REMOVED, statusChangedAt: now }
        : { status: ContentStatus.VISIBLE, statusRuleId: null, statusNote: null, statusChangedAt: now };
      const changed =
        content.kind === "post"
          ? await tx.post.updateMany({ where: { id: content.id, status: ContentStatus.HIDDEN_PENDING_REVIEW }, data })
          : await tx.comment.updateMany({ where: { id: content.id, status: ContentStatus.HIDDEN_PENDING_REVIEW }, data });
      if (changed.count !== 1) throw new Refused("state");
      const where = { ...reportWhere(content.kind, content.id), status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } };
      const report = await tx.report.findFirst({ where, orderBy: { id: "asc" }, select: { id: true } });
      await tx.report.updateMany({
        where,
        data: {
          status: remove ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
          resolvedAt: now, resolvedById: actor.id, resolutionNote: note,
        },
      });
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id, actorRole: role,
          action: remove ? AuditAction.CONTENT_REMOVED : AuditAction.CONTENT_RESTORED,
          targetType: target(content.kind), targetId: String(content.id),
          communityId: content.communityId, ruleId, reportId: report?.id ?? null, reason: note,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAuthor(content, remove ? "removed" : "restored", {
      rule: rule ? `${rule.position}. ${rule.title}` : "",
      reason: hide?.reason ?? "",
      note,
    });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

export type PendingItem = {
  kind: ReviewKind;
  id: number;
  community: string;
  hiddenAt: Date | null;
  rule: string;
  reason: string;
  overdue: boolean;
};

/** Everything that waits for a second person, oldest first. "Overdue" = waiting longer than reviewConfig.dueDays. */
export async function listPending(): Promise<PendingItem[]> {
  const now = Date.now();
  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: { status: ContentStatus.HIDDEN_PENDING_REVIEW },
      select: {
        id: true, statusNote: true, statusChangedAt: true,
        community: { select: { slug: true } }, statusRule: { select: { position: true, title: true } },
      },
    }),
    prisma.comment.findMany({
      where: { status: ContentStatus.HIDDEN_PENDING_REVIEW },
      select: {
        id: true, statusNote: true, statusChangedAt: true,
        post: { select: { community: { select: { slug: true } } } }, statusRule: { select: { position: true, title: true } },
      },
    }),
  ]);
  const items: PendingItem[] = [
    ...posts.map((p) => ({
      kind: "post" as const, id: p.id, community: p.community.slug, hiddenAt: p.statusChangedAt,
      rule: p.statusRule ? `${p.statusRule.position}. ${p.statusRule.title}` : "", reason: p.statusNote ?? "",
      overdue: isOverdue(p.statusChangedAt, now, reviewConfig.dueDays),
    })),
    ...comments.map((c) => ({
      kind: "comment" as const, id: c.id, community: c.post.community.slug, hiddenAt: c.statusChangedAt,
      rule: c.statusRule ? `${c.statusRule.position}. ${c.statusRule.title}` : "", reason: c.statusNote ?? "",
      overdue: isOverdue(c.statusChangedAt, now, reviewConfig.dueDays),
    })),
  ];
  return items.sort((a, b) => (a.hiddenAt?.getTime() ?? 0) - (b.hiddenAt?.getTime() ?? 0));
}

/** The open rules of one community (numbers are what `hide` expects). */
export async function communityRules(slug: string) {
  return prisma.rule.findMany({
    where: { archivedAt: null, community: { slug: slug.trim().toLowerCase() } },
    orderBy: { position: "asc" },
    select: { position: true, title: true },
  });
}

export type Incomplete = { kind: ReviewKind; id: number; status: string; missing: string[] };

/**
 * The check behind "a removal always has a rule and a reason" (TODO 39): lists every hidden / removed post or comment
 * that has no rule, no written reason, or no audit-log row (for example one made by hand in the database or by old
 * sample data). The code of `hideForReview` / `decideReview` cannot produce such a row; this finds the rest.
 */
export async function findIncomplete(): Promise<Incomplete[]> {
  const where = { status: { in: [ContentStatus.HIDDEN_PENDING_REVIEW, ContentStatus.REMOVED] }, deletedAt: null };
  const select = { id: true, status: true, statusRuleId: true, statusNote: true } as const;
  const [posts, comments] = await Promise.all([prisma.post.findMany({ where, select }), prisma.comment.findMany({ where, select })]);
  const logged = async (type: AuditTarget, ids: number[]) =>
    new Set(
      (
        await prisma.auditLog.findMany({
          where: { targetType: type, targetId: { in: ids.map(String) }, action: { in: [AuditAction.CONTENT_HIDDEN, AuditAction.CONTENT_REMOVED] } },
          select: { targetId: true },
        })
      ).map((r) => r.targetId),
    );
  const [postLog, commentLog] = await Promise.all([logged(AuditTarget.POST, posts.map((p) => p.id)), logged(AuditTarget.COMMENT, comments.map((c) => c.id))]);
  const check = (kind: ReviewKind, rows: typeof posts, log: Set<string>): Incomplete[] =>
    rows.flatMap((r) => {
      const missing: string[] = [];
      if (r.statusRuleId === null) missing.push("rule");
      if (!r.statusNote || r.statusNote.trim().length === 0) missing.push("reason");
      if (!log.has(String(r.id))) missing.push("audit row");
      return missing.length ? [{ kind, id: r.id, status: r.status, missing }] : [];
    });
  return [...check("post", posts, postLog), ...check("comment", comments, commentLog)];
}
