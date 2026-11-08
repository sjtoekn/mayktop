// Filing an appeal against a REMOVED Social post / reply (SOCIAL_TODO 29). Deciding is decideAppeal in appeals.ts (the same
// function as for community posts, so the same fairness rules: a DIFFERENT person, a written note, one transaction with the
// audit-log row, an email). No database change: `Appeal` always points at the audit-log row of the removal
// (AuditTarget.SOCIAL_POST / SOCIAL_REPLY, action CONTENT_REMOVED), which already exists.
import { prisma } from "@/lib/prisma";
import { appealConfig, staffConfig, type SiteRuleKey } from "@/config/site";
import { t } from "@/i18n";
import { excerpt } from "@/lib/review-rules";
import { checkFileContentAppeal, cleanAppealText, type AppealError } from "@/lib/appeals-rules";
import type { SocialKind } from "@/lib/social-appeal-rules";
import { AuditAction, AuditTarget, ContentStatus, UserStatus } from "../../generated/prisma/client";

export const socialAuditTarget = (kind: SocialKind) => (kind === "post" ? AuditTarget.SOCIAL_POST : AuditTarget.SOCIAL_REPLY);

export type RemovedSocial = {
  kind: SocialKind;
  id: number;
  authorId: string;
  postId: number; // the Social post (for a reply: the post it was written under)
  text: string; // kept in the database after a removal; only the pages show it blank
  status: ContentStatus;
  erased: boolean;
  removedAt: Date | null;
  siteRule: string; // site rule key of the first step ("" when none)
  reason: string; // the written reason of the first step (hide)
};

export async function loadRemovedSocial(kind: SocialKind, id: number): Promise<RemovedSocial | null> {
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) return null;
  if (kind === "post") {
    const p = await prisma.socialPost.findUnique({
      where: { id },
      select: { id: true, authorId: true, body: true, status: true, deletedAt: true, statusChangedAt: true, statusSiteRule: true, statusNote: true },
    });
    if (!p) return null;
    return {
      kind, id: p.id, authorId: p.authorId, postId: p.id, text: p.body, status: p.status, erased: p.deletedAt !== null,
      removedAt: p.statusChangedAt, siteRule: p.statusSiteRule ?? "", reason: p.statusNote ?? "",
    };
  }
  const r = await prisma.socialReply.findUnique({
    where: { id },
    select: { id: true, authorId: true, socialPostId: true, body: true, status: true, deletedAt: true, statusChangedAt: true, statusSiteRule: true, statusNote: true },
  });
  if (!r) return null;
  return {
    kind, id: r.id, authorId: r.authorId, postId: r.socialPostId, text: r.body, status: r.status, erased: r.deletedAt !== null,
    removedAt: r.statusChangedAt, siteRule: r.statusSiteRule ?? "", reason: r.statusNote ?? "",
  };
}

/** The decision that is appealed: the newest "removed" row of the audit log for this Social post / reply. */
async function removalRow(kind: SocialKind, id: number) {
  return prisma.auditLog.findFirst({
    where: { targetType: socialAuditTarget(kind), targetId: String(id), action: AuditAction.CONTENT_REMOVED },
    orderBy: { id: "desc" },
    select: { id: true },
  });
}

export type SocialAppealView = {
  content: { kind: SocialKind; id: number; excerpt: string; rule: string; reason: string; postId: number };
  appeal: { status: "OPEN" | "ACCEPTED" | "REJECTED"; note: string; createdAt: Date; decidedAt: Date | null } | null;
  /** null = the person can appeal now; otherwise why not (window / state). */
  blocked: AppealError | null;
};

/**
 * What the appeal page shows to the logged-in person. null when there is nothing to show to THIS person (no such item, or
 * not their own): the page answers "not found" and never says whether somebody else's item exists.
 */
export async function getSocialAppealView(userId: string, kind: SocialKind, id: number): Promise<SocialAppealView | null> {
  const content = await loadRemovedSocial(kind, id);
  if (!content || content.authorId !== userId) return null;
  const row = await removalRow(kind, id);
  const appeal = row
    ? await prisma.appeal.findUnique({
        where: { appellantId_auditLogId: { appellantId: userId, auditLogId: row.id } },
        select: { status: true, decisionNote: true, createdAt: true, decidedAt: true },
      })
    : null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  const refused = row
    ? checkFileContentAppeal({
        appellantId: userId, authorId: content.authorId, appellantActive: user?.status === UserStatus.ACTIVE,
        status: content.status, erased: content.erased, removedAt: content.removedAt, now: Date.now(),
        windowDays: appealConfig.windowDays, alreadyAppealed: appeal !== null,
      })
    : "state"; // removed without a record (hand-made): nothing to point the appeal at
  return {
    content: {
      kind, id, excerpt: excerpt(content.text, appealConfig.excerptLength),
      rule: staffConfig.siteRules.some((r) => r.key === content.siteRule) ? t(`siteRule.${content.siteRule as SiteRuleKey}`) : "",
      reason: content.reason, postId: content.postId,
    },
    appeal: appeal ? { status: appeal.status, note: appeal.decisionNote ?? "", createdAt: appeal.createdAt, decidedAt: appeal.decidedAt } : null,
    blocked: refused === "exists" ? null : refused,
  };
}

/** The author of a REMOVED Social post / reply writes an appeal. `userId` comes from the login, never from the browser. */
export async function fileSocialAppeal(input: {
  userId: string; kind: SocialKind; id: number; message: string;
}): Promise<{ ok: true; appealId: number } | { error: AppealError }> {
  const message = cleanAppealText(input.message, staffConfig.minAppealLength, staffConfig.maxAppealLength);
  if (!message) return { error: "message" };
  const content = await loadRemovedSocial(input.kind, input.id);
  if (!content) return { error: "notfound" };
  const row = await removalRow(input.kind, input.id);
  if (!row) return { error: "state" }; // removed without a record (hand-made): nothing to point the appeal at
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { status: true } });
  const existing = await prisma.appeal.findUnique({
    where: { appellantId_auditLogId: { appellantId: input.userId, auditLogId: row.id } },
    select: { id: true },
  });
  const refused = checkFileContentAppeal({
    appellantId: input.userId, authorId: content.authorId, appellantActive: user?.status === UserStatus.ACTIVE,
    status: content.status, erased: content.erased, removedAt: content.removedAt, now: Date.now(),
    windowDays: appealConfig.windowDays, alreadyAppealed: existing !== null,
  });
  if (refused) return { error: refused };
  try {
    const created = await prisma.appeal.create({
      data: { appellantId: input.userId, auditLogId: row.id, message },
      select: { id: true },
    });
    return { ok: true, appealId: created.id };
  } catch (error) {
    // A second appeal for the same decision breaks the unique key (P2002): the same answer as "exists".
    if ((error as { code?: string })?.code === "P2002") return { error: "exists" };
    throw error;
  }
}
