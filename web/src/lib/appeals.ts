// Appeals (TODO 40, PROJECT.md 8g). This is the ONE place these rules live. Today it is called by the appeal page
// (src/app/appeal) and by `npm run appeals` (scripts/appeals.ts); the Phase 4 moderator panel will call the same functions.
//
// Two kinds of appeal, one table (`Appeal`, always pointing at the audit-log row of the decision):
//  - content: the author of a REMOVED post / comment appeals the removal (filed on /appeal/post/<id> or /appeal/comment/<id>).
//  - account: a suspended / banned person appeals the staff decision (filed on /settings, TODO 36d, src/app/settings/appeal).
//  - ad: the advertiser of a REJECTED ad appeals the rejection (filed on /advertise/my/<id>/appeal, ADS_PLAN Session 4c; plain rules in
//    ad-appeal-rules.ts). Accepting makes the ad APPROVED again (it runs after it is paid); rejecting changes nothing but the record.
//
// Deciding (accept / reject) is done by a DIFFERENT person than the appellant and than everyone who decided the first
// time, and always needs a written note. The change and its audit-log row are saved in ONE transaction (no action
// without a record), and the appellant is emailed. Accepting a content appeal makes the post / comment visible again;
// accepting an account appeal lifts the suspension / ban. Rejecting changes nothing except the record.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { appealConfig, purgeConfig, siteConfig, staffConfig, type SiteRuleKey } from "@/config/site";
import { isLocale, t, type Locale } from "@/i18n";
import { excerpt } from "@/lib/review-rules";
import { AD_RULE_TEXT, isPolicyRule } from "@/lib/ad-review-rules";
import { adAppealState, checkFileAdAppeal, type AdAppealError, type AdAppealState } from "@/lib/ad-appeal-rules";
import { loadRemovedSocial, socialAuditTarget } from "@/lib/social-appeal";
import { socialAppealPath, socialViewPath, type SocialKind } from "@/lib/social-appeal-rules";
import {
  checkDecideAppeal,
  checkFileContentAppeal,
  cleanAppealText,
  isAppealOverdue,
  type AppealError,
  type AppealKind,
} from "@/lib/appeals-rules";
import {
  AdStatus,
  AppealStatus,
  AuditAction,
  AuditTarget,
  ContentStatus,
  MemberRole,
  Role,
  UserStatus,
} from "../../generated/prisma/client";

export type { AppealError, AppealKind };
export type ContentKind = "post" | "comment";

class Refused extends Error {
  constructor(public code: AppealError) {
    super(code);
  }
}

function siteUrl(path: string): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + path;
}

const contentTarget = (kind: ContentKind) => (kind === "post" ? AuditTarget.POST : AuditTarget.COMMENT);

// ---------------------------------------------------------------------------------------------------------------
// Filing an appeal against a REMOVED post / comment
// ---------------------------------------------------------------------------------------------------------------

type RemovedContent = {
  kind: ContentKind;
  id: number;
  authorId: string;
  communityId: number;
  communitySlug: string;
  postId: number;
  text: string; // post title / comment text (kept in the database after a removal; only the page shows it blank)
  status: ContentStatus;
  erased: boolean;
  removedAt: Date | null;
  rule: string; // "2. Be respectful" (the community rule named in the removal), "" when none
  reason: string; // the written reason of the first step (hide)
};

async function loadRemovedContent(kind: ContentKind, id: number): Promise<RemovedContent | null> {
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) return null;
  if (kind === "post") {
    const p = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true, authorId: true, communityId: true, title: true, status: true, deletedAt: true, statusChangedAt: true, statusNote: true,
        community: { select: { slug: true } }, statusRule: { select: { position: true, title: true } },
      },
    });
    if (!p) return null;
    return {
      kind, id: p.id, authorId: p.authorId, communityId: p.communityId, communitySlug: p.community.slug, postId: p.id,
      text: p.title, status: p.status, erased: p.deletedAt !== null, removedAt: p.statusChangedAt,
      rule: p.statusRule ? `${p.statusRule.position}. ${p.statusRule.title}` : "", reason: p.statusNote ?? "",
    };
  }
  const c = await prisma.comment.findUnique({
    where: { id },
    select: {
      id: true, authorId: true, postId: true, body: true, status: true, deletedAt: true, statusChangedAt: true, statusNote: true,
      post: { select: { communityId: true, community: { select: { slug: true } } } },
      statusRule: { select: { position: true, title: true } },
    },
  });
  if (!c) return null;
  return {
    kind, id: c.id, authorId: c.authorId, communityId: c.post.communityId, communitySlug: c.post.community.slug, postId: c.postId,
    text: c.body, status: c.status, erased: c.deletedAt !== null, removedAt: c.statusChangedAt,
    rule: c.statusRule ? `${c.statusRule.position}. ${c.statusRule.title}` : "", reason: c.statusNote ?? "",
  };
}

/** The decision that is appealed: the newest "removed" row of the audit log for this post / comment. */
async function removalRow(kind: ContentKind, id: number) {
  return prisma.auditLog.findFirst({
    where: { targetType: contentTarget(kind), targetId: String(id), action: AuditAction.CONTENT_REMOVED },
    orderBy: { id: "desc" },
    select: { id: true },
  });
}

export type AppealView = {
  content: { kind: ContentKind; id: number; community: string; excerpt: string; rule: string; reason: string; postId: number };
  appeal: { status: "OPEN" | "ACCEPTED" | "REJECTED"; note: string; createdAt: Date; decidedAt: Date | null } | null;
  /** null = the person can appeal now; otherwise why not (window / state). */
  blocked: AppealError | null;
};

/**
 * What the appeal page shows to the logged-in person. Returns null when there is nothing to show to THIS person
 * (no such item, or not their own): the page answers "not found" and never says whether somebody else's item exists.
 */
export async function getAppealView(userId: string, kind: ContentKind, id: number): Promise<AppealView | null> {
  const content = await loadRemovedContent(kind, id);
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
    : "state";
  return {
    content: {
      kind, id, community: content.communitySlug, excerpt: excerpt(content.text, appealConfig.excerptLength),
      rule: content.rule, reason: content.reason, postId: content.postId,
    },
    appeal: appeal ? { status: appeal.status, note: appeal.decisionNote ?? "", createdAt: appeal.createdAt, decidedAt: appeal.decidedAt } : null,
    blocked: refused === "exists" ? null : refused,
  };
}

/** The author of a REMOVED post / comment writes an appeal. `userId` comes from the login, never from the browser. */
export async function fileContentAppeal(input: {
  userId: string; kind: ContentKind; id: number; message: string;
}): Promise<{ ok: true; appealId: number } | { error: AppealError }> {
  const message = cleanAppealText(input.message, staffConfig.minAppealLength, staffConfig.maxAppealLength);
  if (!message) return { error: "message" };
  const content = await loadRemovedContent(input.kind, input.id);
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

// ---------------------------------------------------------------------------------------------------------------
// Reading and deciding (moderators / admins)
// ---------------------------------------------------------------------------------------------------------------

type Case = {
  appealId: number;
  kind: AppealKind;
  contentKind: ContentKind | null;
  social: SocialKind | null; // a Social post / reply appeal (SOCIAL_TODO 29): then kind is "content" and contentKind is null
  appellantId: string;
  appellant: string; // username
  message: string;
  status: AppealStatus;
  createdAt: Date;
  auditId: number;
  communityId: number | null;
  community: string;
  targetId: string;
  firstAction: AuditAction;
  firstActor: string; // username of the person whose decision is appealed
  rule: string; // community rule ("2. Be respectful") or site rule text key
  reason: string; // the written reason of the decision that is appealed
  deciderIds: string[]; // everyone who decided the first time
  content?: { text: string; postId: number };
  ad?: AdSummary; // ad appeals only
};

/** The ad that is appealed (what a reviewer needs to see). */
export type AdSummary = {
  id: number;
  title: string;
  body: string;
  format: "TEXT" | "IMAGE" | "VIDEO";
  imageUrl: string | null;
  videoUrl: string | null;
  status: string;
};

async function loadCase(appealId: number): Promise<Case | null> {
  if (!Number.isInteger(appealId) || appealId < 1) return null;
  const a = await prisma.appeal.findUnique({
    where: { id: appealId },
    select: {
      id: true, appellantId: true, message: true, status: true, createdAt: true,
      appellant: { select: { username: true } },
      auditLog: {
        select: {
          id: true, action: true, targetType: true, targetId: true, communityId: true, reason: true, siteRule: true, actorId: true,
          actor: { select: { username: true } },
          community: { select: { slug: true } },
          rule: { select: { position: true, title: true } },
        },
      },
    },
  });
  if (!a) return null;
  const log = a.auditLog;
  const isAccount = log.targetType === AuditTarget.USER;
  const isAd = log.targetType === AuditTarget.AD;
  const contentKind: ContentKind | null = log.targetType === AuditTarget.POST ? "post" : log.targetType === AuditTarget.COMMENT ? "comment" : null;
  const social: SocialKind | null = log.targetType === AuditTarget.SOCIAL_POST ? "post" : log.targetType === AuditTarget.SOCIAL_REPLY ? "reply" : null;
  if (!isAccount && !isAd && !contentKind && !social) return null; // an appeal can only point at a content, a Social item, an account or an ad decision

  const deciderIds = new Set<string>([log.actorId]);
  let content: Case["content"];
  let ad: AdSummary | undefined;
  let adCommunity = "";
  if (isAd) {
    // Everyone who approved or rejected this ad before cannot decide the appeal.
    const rows = await prisma.auditLog.findMany({
      where: { targetType: AuditTarget.AD, targetId: log.targetId, action: { in: [AuditAction.AD_APPROVED, AuditAction.AD_REJECTED] } },
      select: { actorId: true },
    });
    for (const r of rows) deciderIds.add(r.actorId);
    const a = Number.isInteger(Number(log.targetId))
      ? await prisma.adCampaign.findUnique({
          where: { id: Number(log.targetId) },
          select: { id: true, title: true, body: true, format: true, imageUrl: true, videoUrl: true, status: true, community: { select: { slug: true } } },
        })
      : null;
    if (a) {
      ad = { id: a.id, title: a.title, body: a.body, format: a.format, imageUrl: a.imageUrl, videoUrl: a.videoUrl, status: a.status };
      adCommunity = a.community?.slug ?? "";
    }
  } else if (contentKind) {
    // The hider and the remover (and anyone who decided earlier on the same item).
    const rows = await prisma.auditLog.findMany({
      where: {
        targetType: log.targetType, targetId: log.targetId,
        action: { in: [AuditAction.CONTENT_HIDDEN, AuditAction.CONTENT_REMOVED, AuditAction.CONTENT_RESTORED] },
      },
      select: { actorId: true },
    });
    for (const r of rows) deciderIds.add(r.actorId);
    const loaded = await loadRemovedContent(contentKind, Number(log.targetId));
    if (loaded) content = { text: loaded.text, postId: loaded.postId };
  } else if (social) {
    // A Social post / reply (SOCIAL_TODO 29): everyone who hid, removed or restored it before cannot decide the appeal.
    // Social is admins only and has no community, so only an admin can decide it (checkDecideAppeal, kind "content").
    const rows = await prisma.auditLog.findMany({
      where: {
        targetType: log.targetType, targetId: log.targetId,
        action: { in: [AuditAction.CONTENT_HIDDEN, AuditAction.CONTENT_REMOVED, AuditAction.CONTENT_RESTORED] },
      },
      select: { actorId: true },
    });
    for (const r of rows) deciderIds.add(r.actorId);
    const loaded = await loadRemovedSocial(social, Number(log.targetId));
    if (loaded) content = { text: loaded.text, postId: loaded.postId };
  } else if (log.action === AuditAction.USER_BANNED) {
    // A ban needs two admins: the one who approved (the log row) and the one who proposed.
    const proposed = await prisma.auditLog.findFirst({
      where: { targetType: AuditTarget.USER, targetId: log.targetId, action: AuditAction.BAN_PROPOSED, id: { lt: log.id } },
      orderBy: { id: "desc" },
      select: { actorId: true },
    });
    if (proposed) deciderIds.add(proposed.actorId);
  }
  return {
    appealId: a.id, kind: isAccount ? "account" : isAd ? "ad" : "content", contentKind, social, appellantId: a.appellantId,
    appellant: a.appellant.username, message: a.message, status: a.status, createdAt: a.createdAt,
    auditId: log.id, communityId: log.communityId, community: isAd ? adCommunity : (log.community?.slug ?? ""), targetId: log.targetId,
    firstAction: log.action, firstActor: log.actor.username,
    rule: log.rule
      ? `${log.rule.position}. ${log.rule.title}`
      : log.siteRule && isAd && isPolicyRule(log.siteRule)
        ? t(AD_RULE_TEXT[log.siteRule])
        : log.siteRule && staffConfig.siteRules.some((r) => r.key === log.siteRule)
          ? t(`siteRule.${log.siteRule as SiteRuleKey}`)
          : "",
    reason: log.reason ?? "",
    deciderIds: [...deciderIds],
    content,
    ad,
  };
}

export type OpenAppeal = {
  id: number;
  kind: AppealKind;
  what: string; // "post #12 in c/photos" / "account of maya_r"
  appellant: string;
  createdAt: Date;
  overdue: boolean;
};

/** Every open appeal, oldest first. "Overdue" = waiting longer than appealConfig.dueDays. */
export async function listOpenAppeals(): Promise<OpenAppeal[]> {
  const rows = await prisma.appeal.findMany({
    where: { status: AppealStatus.OPEN },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  const now = Date.now();
  const out: OpenAppeal[] = [];
  for (const r of rows) {
    const c = await loadCase(r.id);
    if (!c) continue;
    out.push({
      id: c.appealId, kind: c.kind, appellant: c.appellant, createdAt: c.createdAt,
      what: c.kind === "account" ? `account of ${c.appellant}` : c.kind === "ad" ? `ad #${c.targetId}` : c.social ? `social ${c.social} #${c.targetId}` : `${c.contentKind} #${c.targetId} in c/${c.community}`,
      overdue: isAppealOverdue(c.createdAt, now, appealConfig.dueDays),
    });
  }
  return out;
}

export type AppealDetails = {
  appealId: number;
  kind: AppealKind;
  appellant: string;
  message: string;
  status: AppealStatus;
  createdAt: Date;
  community: string;
  targetId: string;
  contentKind: ContentKind | null;
  social: SocialKind | null; // a Social post / reply appeal
  firstAction: AuditAction;
  firstActor: string;
  rule: string;
  reason: string;
  content?: { text: string; postId: number };
  ad?: AdSummary;
};

/** Everything a reviewer needs to read before deciding (the appeal, the first decision, and the content itself). */
export async function showAppeal(appealId: number): Promise<AppealDetails | null> {
  const c = await loadCase(appealId);
  if (!c) return null;
  return {
    appealId: c.appealId, kind: c.kind, appellant: c.appellant, message: c.message, status: c.status, createdAt: c.createdAt,
    community: c.community, targetId: c.targetId, contentKind: c.contentKind, social: c.social, firstAction: c.firstAction, firstActor: c.firstActor,
    rule: c.rule, reason: c.reason, content: c.content, ad: c.ad,
  };
}

/** The reviewer: an ACTIVE account. `isCommunityModerator` is about the community of THIS case only. */
async function loadReviewer(username: string, communityId: number | null) {
  const u = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true },
  });
  if (!u || u.status !== UserStatus.ACTIVE) return null;
  const m =
    communityId === null
      ? null
      : await prisma.membership.findUnique({
          where: { userId_communityId: { userId: u.id, communityId } },
          select: { role: true },
        });
  return { id: u.id, role: u.role, isAdmin: u.role === Role.ADMIN, isCommunityModerator: m?.role === MemberRole.MODERATOR };
}

/**
 * Accept or reject an appeal, with a written note. `actor` = username of a moderator of that community / an admin
 * (content appeals) or an admin (account appeals), and never the appellant or anyone who decided the first time.
 */
export async function decideAppeal(input: {
  actor: string; appealId: number; accept: boolean; note: string;
}): Promise<{ ok: true; auditId: number } | { error: AppealError }> {
  const note = cleanAppealText(input.note, staffConfig.minReasonLength, staffConfig.maxReasonLength);
  if (!note) return { error: "message" };
  const c = await loadCase(input.appealId);
  if (!c) return { error: "notfound" };
  const reviewer = await loadReviewer(input.actor, c.communityId);
  if (!reviewer) return { error: "actor" };
  const refused = checkDecideAppeal({
    kind: c.kind, actor: reviewer, appellantId: c.appellantId, deciderIds: c.deciderIds, status: c.status,
  });
  if (refused) return { error: refused };

  const now = new Date();
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      // 1. Close the appeal (only if it is still open: two reviewers at once cannot both decide it).
      const closed = await tx.appeal.updateMany({
        where: { id: c.appealId, status: AppealStatus.OPEN },
        data: {
          status: input.accept ? AppealStatus.ACCEPTED : AppealStatus.REJECTED,
          decidedAt: now, decidedById: reviewer.id, decisionNote: note,
        },
      });
      if (closed.count !== 1) throw new Refused("state");

      // 2. Accepting reverses the first decision.
      if (input.accept && c.contentKind) {
        const data = { status: ContentStatus.VISIBLE, statusRuleId: null, statusNote: null, statusChangedAt: now };
        const id = Number(c.targetId);
        const changed =
          c.contentKind === "post"
            ? await tx.post.updateMany({ where: { id, status: ContentStatus.REMOVED, deletedAt: null }, data })
            : await tx.comment.updateMany({ where: { id, status: ContentStatus.REMOVED, deletedAt: null }, data });
        if (changed.count !== 1) throw new Refused("state"); // changed or erased in the meantime
      } else if (input.accept && c.social) {
        // A Social post / reply: the removal is reversed (visible again, the reason fields are cleared).
        const data = { status: ContentStatus.VISIBLE, statusSiteRule: null, statusNote: null, statusChangedAt: now };
        const id = Number(c.targetId);
        const changed =
          c.social === "post"
            ? await tx.socialPost.updateMany({ where: { id, status: ContentStatus.REMOVED, deletedAt: null }, data })
            : await tx.socialReply.updateMany({ where: { id, status: ContentStatus.REMOVED, deletedAt: null }, data });
        if (changed.count !== 1) throw new Refused("state"); // changed or erased in the meantime
      } else if (input.accept && c.kind === "ad") {
        // The rejection is reversed: the ad is APPROVED by this (different) reviewer and runs once it is paid.
        const changed = await tx.adCampaign.updateMany({
          where: { id: Number(c.targetId), status: AdStatus.REJECTED },
          data: { status: AdStatus.APPROVED, reviewedById: reviewer.id, reviewedAt: now, reviewRule: null, reviewNote: null },
        });
        if (changed.count !== 1) throw new Refused("state"); // sent again or ended in the meantime
      } else if (input.accept) {
        // Lift the suspension / ban. If the person was already restored by hand (`npm run staff -- lift`), nothing is left to lift.
        await tx.user.updateMany({
          where: { id: c.appellantId, status: UserStatus.SUSPENDED },
          data: { status: UserStatus.ACTIVE, suspendedAt: null, suspendedUntil: null, suspensionKind: null, suspensionNote: null, eraseAt: null },
        });
      }

      // 3. The record. Content appeals go to the public mod log (target = the post / comment, with its community and rule).
      const first = await tx.auditLog.findUniqueOrThrow({ where: { id: c.auditId }, select: { ruleId: true, siteRule: true } });
      const row = await tx.auditLog.create({
        data: {
          actorId: reviewer.id, actorRole: reviewer.role,
          action: input.accept ? AuditAction.APPEAL_ACCEPTED : AuditAction.APPEAL_REJECTED,
          targetType: c.contentKind ? contentTarget(c.contentKind) : c.social ? socialAuditTarget(c.social) : c.kind === "ad" ? AuditTarget.AD : AuditTarget.USER,
          targetId: c.targetId,
          communityId: c.communityId, ruleId: first.ruleId, siteRule: first.siteRule, reason: note,
        },
        select: { id: true },
      });
      return row.id;
    });
    await notifyAppellant(c, input.accept, note);
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Email to the appellant (never fails the decision: it is already saved; in the person's own language). */
async function notifyAppellant(c: Case, accepted: boolean, note: string) {
  try {
    const a = await prisma.user.findUnique({
      where: { id: c.appellantId },
      select: { email: true, username: true, displayName: true, language: true, status: true },
    });
    if (!a || a.status === UserStatus.DELETED) return;
    const locale: Locale = isLocale(a.language) ? a.language : "en";
    const params = {
      site: siteConfig.name,
      name: a.displayName || a.username,
      kind: c.contentKind ? t(c.contentKind === "post" ? "modlog.target.post" : "modlog.target.comment", undefined, locale) : "",
      excerpt: c.content ? excerpt(c.content.text, appealConfig.excerptLength) : "",
      title: c.ad?.title ?? "",
      community: c.community,
      rule: c.rule,
      reason: c.reason,
      note,
      days: purgeConfig.afterAppealDays,
      url:
        c.social && c.content
          ? siteUrl(accepted ? socialViewPath(c.content.postId) : socialAppealPath(c.social, Number(c.targetId)))
          : c.content ? siteUrl(`/post/${c.content.postId}`) : c.kind === "ad" ? siteUrl("/advertise/my") : siteUrl("/settings"),
    };
    const outcome = accepted ? "accepted" : "rejected";
    const body = `email.appeal.${c.social ? "social" : c.kind}.${outcome}.body` as const;
    await sendEmail({
      to: a.email,
      subject: t(`email.appeal.${outcome}.subject`, params, locale),
      text: t(body, params, locale),
    });
  } catch (error) {
    console.error("appeal email failed:", error);
  }
}

// Added by patch-admin6 (admin panel, Part 6): lets a screen tell who may NOT decide a case (the appellant and everyone
// who decided the first time) without repeating the rule. Read-only. decideAppeal still checks everything again.
export async function appealDeciders(appealId: number): Promise<{ appellantId: string; deciderIds: string[] } | null> {
  const c = await loadCase(appealId);
  return c ? { appellantId: c.appellantId, deciderIds: c.deciderIds } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Ad rejections (ADS_PLAN Session 4c): the advertiser reads and files an appeal. Deciding is decideAppeal above (admins only).
// ---------------------------------------------------------------------------------------------------------------

export type AdAppealInfo = {
  appeal: { status: "OPEN" | "ACCEPTED" | "REJECTED"; note: string; createdAt: Date; decidedAt: Date | null } | null;
  /** null = the advertiser can appeal now; otherwise why not (window, state, ...). */
  refused: AdAppealError | null;
  state: AdAppealState;
};

/**
 * For the advertiser's own ads: the appeal of the NEWEST rejection of each ad, and whether a new appeal is possible.
 * `ads` must be the person's own ads (the caller loaded them by advertiserId); a stranger's ad would simply say "notfound".
 */
export async function loadAdAppealInfo(
  userId: string,
  ads: { id: number; status: string; advertiserId: string }[],
): Promise<Map<number, AdAppealInfo>> {
  const out = new Map<number, AdAppealInfo>();
  const rejected = ads.filter((a) => a.status === "REJECTED");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  const active = user?.status === UserStatus.ACTIVE;
  const rows =
    ads.length === 0
      ? []
      : await prisma.auditLog.findMany({
          where: { targetType: AuditTarget.AD, targetId: { in: ads.map((a) => String(a.id)) }, action: AuditAction.AD_REJECTED },
          orderBy: { id: "desc" }, // newest first: the first row of each ad is the decision that counts
          select: { id: true, targetId: true, createdAt: true },
        });
  const newest = new Map<string, { id: number; createdAt: Date }>();
  for (const r of rows) if (!newest.has(r.targetId)) newest.set(r.targetId, r);
  const appeals =
    newest.size === 0
      ? []
      : await prisma.appeal.findMany({
          where: { appellantId: userId, auditLogId: { in: [...newest.values()].map((r) => r.id) } },
          select: { auditLogId: true, status: true, decisionNote: true, createdAt: true, decidedAt: true },
        });
  const byRow = new Map(appeals.map((a) => [a.auditLogId, a]));
  const now = Date.now();
  for (const ad of rejected) {
    const row = newest.get(String(ad.id));
    const found = row ? byRow.get(row.id) : undefined;
    const refused: AdAppealError | null = row
      ? checkFileAdAppeal({
          appellantId: userId, advertiserId: ad.advertiserId, appellantActive: active, status: ad.status,
          rejectedAt: row.createdAt, now, windowDays: appealConfig.windowDays, alreadyAppealed: found !== undefined,
        })
      : "state"; // rejected without a record (hand-made): nothing to point the appeal at
    const appeal = found
      ? { status: found.status, note: found.decisionNote ?? "", createdAt: found.createdAt, decidedAt: found.decidedAt }
      : null;
    out.set(ad.id, { appeal, refused, state: adAppealState(appeal, refused === "exists" ? null : refused) });
  }
  // Ads that are not rejected any more can still show how an old appeal ended (an accepted appeal makes the ad APPROVED).
  for (const ad of ads) {
    if (out.has(ad.id)) continue;
    const row = newest.get(String(ad.id));
    const found = row ? byRow.get(row.id) : undefined;
    if (!found) continue;
    const appeal = { status: found.status, note: found.decisionNote ?? "", createdAt: found.createdAt, decidedAt: found.decidedAt };
    out.set(ad.id, { appeal, refused: "state", state: adAppealState(appeal, "state") });
  }
  return out;
}

export type AdAppealView = {
  ad: { id: number; title: string; body: string; format: "TEXT" | "IMAGE" | "VIDEO"; imageUrl: string | null; videoUrl: string | null; rule: string; reason: string };
  info: AdAppealInfo;
};

/**
 * What the ad appeal page shows to the logged-in person. null when the ad does not exist or is not theirs:
 * the page then answers "not found" and never says whether somebody else's ad exists.
 */
export async function getAdAppealView(userId: string, adId: number): Promise<AdAppealView | null> {
  if (!Number.isInteger(adId) || adId < 1 || adId > 2_147_483_647) return null;
  const ad = await prisma.adCampaign.findUnique({
    where: { id: adId },
    select: { id: true, advertiserId: true, status: true, title: true, body: true, format: true, imageUrl: true, videoUrl: true, reviewRule: true, reviewNote: true },
  });
  if (!ad || ad.advertiserId !== userId) return null;
  const info = (await loadAdAppealInfo(userId, [ad])).get(ad.id);
  if (!info) return null; // not rejected and never appealed: nothing to show here
  return {
    ad: {
      id: ad.id, title: ad.title, body: ad.body, format: ad.format, imageUrl: ad.imageUrl, videoUrl: ad.videoUrl,
      rule: ad.reviewRule && isPolicyRule(ad.reviewRule) ? t(AD_RULE_TEXT[ad.reviewRule]) : (ad.reviewRule ?? ""),
      reason: ad.reviewNote ?? "",
    },
    info,
  };
}

/** The advertiser of a REJECTED ad writes an appeal. `userId` comes from the login, never from the browser. */
export async function fileAdAppeal(input: { userId: string; adId: number; message: string }): Promise<{ ok: true; appealId: number } | { error: AppealError }> {
  const message = cleanAppealText(input.message, staffConfig.minAppealLength, staffConfig.maxAppealLength);
  if (!message) return { error: "message" };
  if (!Number.isInteger(input.adId) || input.adId < 1 || input.adId > 2_147_483_647) return { error: "notfound" };
  const ad = await prisma.adCampaign.findUnique({ where: { id: input.adId }, select: { id: true, advertiserId: true, status: true } });
  if (!ad || ad.advertiserId !== input.userId) return { error: "notfound" };
  const row = await prisma.auditLog.findFirst({
    where: { targetType: AuditTarget.AD, targetId: String(ad.id), action: AuditAction.AD_REJECTED },
    orderBy: { id: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!row) return { error: "state" }; // rejected without a record (hand-made): nothing to point the appeal at
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { status: true } });
  const existing = await prisma.appeal.findUnique({
    where: { appellantId_auditLogId: { appellantId: input.userId, auditLogId: row.id } },
    select: { id: true },
  });
  const refused = checkFileAdAppeal({
    appellantId: input.userId, advertiserId: ad.advertiserId, appellantActive: user?.status === UserStatus.ACTIVE,
    status: ad.status, rejectedAt: row.createdAt, now: Date.now(), windowDays: appealConfig.windowDays, alreadyAppealed: existing !== null,
  });
  if (refused) return { error: refused };
  try {
    const created = await prisma.appeal.create({
      data: { appellantId: input.userId, auditLogId: row.id, message },
      select: { id: true },
    });
    return { ok: true, appealId: created.id };
  } catch (error) {
    // A second appeal for the same rejection breaks the unique key (P2002): the same answer as "exists".
    if ((error as { code?: string })?.code === "P2002") return { error: "exists" };
    throw error;
  }
}
