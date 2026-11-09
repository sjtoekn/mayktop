// FINAL ERASURE (TODO 36e, PROJECT.md 8c, ACCOUNT_RULES.md 3.1 / 3.4 / 3.6).
// `npm run purge` (scripts/purge.ts) calls runPurge(). It does three things, in this order:
//   1. WARN: an email to every person whose erase date is less than `purgeConfig.warnBeforeHours` away
//      (or already passed). No warning email sent = no erasure (no surprise erasure).
//   2. ERASE: accounts whose erase date has passed, that were warned at least `minWarningHours` ago, that have
//      no open appeal (an open appeal stops the clock), and that nobody recovered or lifted in the meantime.
//      Each erasure is ONE database transaction: everything or nothing.
//   3. SWEEP: safety records whose keep-until date has passed are deleted (unless a legal hold is set).
//
// What erasing an account means (the row stays as an anonymous shell, so replies, votes and the audit log keep working):
//   - gone: email, name, bio, picture, timezone, password and every login method, all login sessions, e-mail/reset
//     codes, community memberships, the title and text of every post and comment, the text and picture link of every
//     social post and quote repost, follows and notifications (src/lib/purge-social.ts), the text of appeals the person wrote,
//     the contact e-mail of ads the person booked;
//   - kept (anonymous): vote totals, reports the person made, the audit log, ads' statistics;
//   - ads: every ad that was still running or waiting is ENDED now (nothing is shown for a person who is gone);
//     a paid ad that is stopped early is listed in the report so the owner can refund it by hand (refunds: TODO 46);
//   - SAFETY RECORD (never public, admin only): only for a banned account, an account with an open report on its
//     content, or a legal hold. See safetyRecord in prisma/schema.prisma.
//
// AUDIT TRAIL (Part 9): every step that changes something leaves ONE audit-log row, written in the SAME database
// transaction as the change (no action without a record, like every other staff / moderation action), by the system
// actor (purge-rules.ts, SYSTEM_ACTOR_ID): ACCOUNT_ERASE_WARNED, ACCOUNT_ERASED (also when no safety record is kept),
// SAFETY_RECORD_SWEPT. Legal-hold changes already had theirs. The rows hold NO personal data (only the opaque account id,
// the kind, the record number). They are never deleted, so they prove that the person was warned, that the erasure
// happened and when, and that a sweep never touched a record under a legal hold, after the person and the record are gone.
//
// Nothing here runs by itself: an admin or a scheduled job runs `npm run purge -- --run`.
import { prisma } from "@/lib/prisma";
import { deleteAdFiles } from "@/lib/ad-storage";
import { sendEmail } from "@/lib/email";
import { purgeConfig, siteConfig, staffConfig } from "@/config/site";
import { t } from "@/i18n";
import { eraseSocial, socialPictureFiles, socialPostsForRecord } from "@/lib/purge-social";
import { deleteSocialImages } from "@/lib/social-image-storage";
import {
  announcedTime,
  appealHoldsBack,
  DAY_MS,
  emailHash,
  erasedEmail,
  erasedUsername,
  latestDecision,
  mayErase,
  recordReasons,
  erasureAuditReason,
  retentionDays,
  SYSTEM_ACTOR_ID,
  sweepAuditReason,
  warningAuditReason,
  warningIsDue,
  warningIsValid,
  type SafetyReason,
} from "@/lib/purge-rules";
import {
  AdPaymentStatus,
  AdStatus,
  AuditAction,
  AuditTarget,
  ContentStatus,
  MemberRole,
  ReportStatus,
  Role,
  SuspensionKind,
  UserStatus,
  type Prisma,
} from "../../generated/prisma/client";

type Db = Prisma.TransactionClient;

/**
 * One audit-log row written by the purge job itself. The system actor is an anonymous shell account (see purge-rules.ts);
 * it is created the first time it is needed and the upsert makes this safe to call again and again.
 * Call it INSIDE the transaction of the change it records, so the change and its record are saved together or not at all.
 */
export async function writeSystemAudit(db: Db, action: AuditAction, targetId: string, reason: string): Promise<void> {
  await db.user.upsert({
    where: { id: SYSTEM_ACTOR_ID },
    update: {},
    create: {
      id: SYSTEM_ACTOR_ID,
      username: erasedUsername(SYSTEM_ACTOR_ID),
      email: erasedEmail(SYSTEM_ACTOR_ID),
      role: Role.USER, // never ADMIN: the system actor can not be named in a staff command or approve a ban
      status: UserStatus.DELETED,
      deletedAt: new Date(),
    },
    select: { id: true },
  });
  await db.auditLog.create({
    data: { actorId: SYSTEM_ACTOR_ID, actorRole: Role.USER, action, targetType: AuditTarget.USER, targetId, reason },
    select: { id: true },
  });
}

const dueSelect = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  createdAt: true,
  status: true,
  suspensionKind: true,
  eraseAt: true,
  eraseWarnedAt: true,
  legalHold: true,
  role: true,
  isSuperAdmin: true,
} as const;
type DueUser = Prisma.UserGetPayload<{ select: typeof dueSelect }>;

/** Only these two kinds of account are ever erased. */
function isErasable(u: { status: UserStatus; suspensionKind: SuspensionKind | null }): boolean {
  return (
    u.status === UserStatus.DELETION_PENDING ||
    (u.status === UserStatus.SUSPENDED && u.suspensionKind === SuspensionKind.BAN)
  );
}

/** Why one erasure did not happen. `code` is used only by the immediate erasure by an admin (eraseAccountNow). */
class Skip extends Error {
  constructor(
    message: string,
    public code: "state" | "hold" | "appeal" | "other" = "other",
  ) {
    super(message);
  }
}

/** Set only when a SUPER ADMIN erases an account at once (admin panel): who did it, and the written reason. */
type ErasedBy = { id: string; role: Role; reason: string };

function settingsUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + "/settings";
}

function when(date: Date): string {
  return (
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC"
  );
}

/** The secret for the one-way email code. Without it a safety record cannot be made, so the purge does not run. */
export function hashSecret(): string | null {
  return process.env.SAFETY_HASH_SECRET || process.env.BETTER_AUTH_SECRET || null;
}

// ------------------------------------------------------------------ facts about one person

async function gather(db: Db, user: DueUser) {
  const appeals = await db.appeal.findMany({
    where: { appellantId: user.id },
    orderBy: { id: "asc" },
    select: { id: true, auditLogId: true, message: true, status: true, createdAt: true, decidedAt: true, decisionNote: true },
  });
  const openReports = await db.report.findMany({
    where: {
      status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] },
      OR: [{ post: { authorId: user.id } }, { comment: { authorId: user.id } }],
    },
    orderBy: { id: "asc" },
    select: { id: true, postId: true, commentId: true, ruleId: true, reason: true, status: true, createdAt: true },
  });
  const banned = user.status === UserStatus.SUSPENDED && user.suspensionKind === SuspensionKind.BAN;
  const bannedRow = banned
    ? await db.auditLog.findFirst({
        where: { targetType: AuditTarget.USER, targetId: user.id, action: AuditAction.USER_BANNED },
        orderBy: { id: "desc" },
        select: { id: true, createdAt: true, siteRule: true, reason: true },
      })
    : null;
  const bannedRule: string | null = bannedRow?.siteRule ?? null;
  const seriousBan = banned && bannedRule !== null && staffConfig.siteRules.some((r) => r.key === bannedRule && r.serious);
  const reasons = recordReasons({ banned, openReports: openReports.length, legalHold: user.legalHold });
  const holdBack = appealHoldsBack(appeals, new Date(), purgeConfig);
  return { appeals, openReports, banned, bannedRow, seriousBan, reasons, holdBack, lastAppealDecidedAt: latestDecision(appeals) };
}

// ------------------------------------------------------------------ the report

export type PurgeLine = { who: string; what: string };
export type PurgeReport = {
  run: boolean;
  warned: PurgeLine[];
  erased: PurgeLine[];
  waiting: PurgeLine[];
  failed: PurgeLine[];
  notes: string[];
  recordsSwept: number[];
  notDueYet: number;
};

// ------------------------------------------------------------------ 1. warn

async function warn(user: DueUser, now: Date, run: boolean, report: PurgeReport): Promise<void> {
  const eraseAt = user.eraseAt as Date;
  const kind = user.status === UserStatus.SUSPENDED ? "Ban" : "Deletion";
  const time = announcedTime(eraseAt, now, purgeConfig);
  if (!run) {
    report.warned.push({ who: user.username, what: `would be warned (${kind.toLowerCase()}), erase on or after ${when(time)}` });
    return;
  }
  const params = { site: siteConfig.name, name: user.displayName || user.username, time: when(time), url: settingsUrl() };
  try {
    // Awaited ON PURPOSE: if the email cannot be sent, the person is NOT marked as warned and nothing is erased.
    await sendEmail({
      to: user.email,
      subject: t(`email.eraseWarning${kind}.subject`, params),
      text: t(`email.eraseWarning${kind}.body`, params),
    });
  } catch (error) {
    report.failed.push({ who: user.username, what: `warning email NOT sent, nothing will be erased: ${(error as Error).message}` });
    return;
  }
  // Only mark when the person is still in the same state with the same erase date.
  // The mark and its audit row are ONE transaction: a warning that is not in the audit log does not count as given.
  const marked = await prisma.$transaction(async (tx) => {
    const m = await tx.user.updateMany({
      where: { id: user.id, status: user.status, eraseAt },
      data: { eraseWarnedAt: now },
    });
    if (m.count === 1) await writeSystemAudit(tx, AuditAction.ACCOUNT_ERASE_WARNED, user.id, warningAuditReason(kind, time));
    return m.count;
  });
  report.warned.push({
    who: user.username,
    what: marked === 1 ? `warned (${kind.toLowerCase()}), erase on or after ${when(time)}` : "warned, but the account changed meanwhile",
  });
}

// ------------------------------------------------------------------ 2. erase

type Erased = { email: string; name: string; reasons: SafetyReason[]; keepDays: number; kind: "deletion" | "ban"; notes: string[] };

async function eraseAccount(userId: string, now: Date, secret: string, by?: ErasedBy): Promise<Erased> {
  const adFiles: string[] = []; // picture / video files of the person's ads: deleted from disk AFTER the commit (Session 3b)
  const socialFiles: string[] = []; // picture files of the person's social posts: deleted from disk AFTER the commit (patch-social-images)
  const out = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: dueSelect });
      if (by) {
        // IMMEDIATE erasure by a super admin: no waiting time and no warning (the admin decided, with a written reason).
        // What stays the same: only a plain USER account, never an erased one, never one under a legal hold.
        if (!user || user.id === SYSTEM_ACTOR_ID || user.status === UserStatus.DELETED) throw new Skip("the account does not exist or is already erased", "state");
        if (user.role !== Role.USER || user.isSuperAdmin) throw new Skip("staff accounts are not erased this way", "state");
        if (user.legalHold) throw new Skip("a legal hold is set", "hold");
      } else if (!user || !user.eraseAt || user.eraseAt > now || !isErasable(user)) {
        throw new Skip("the account changed meanwhile (recovered, lifted or already erased)");
      }
      const facts = await gather(tx, user);
      if (by) {
        // An open appeal means the person is still being heard: it must be decided first.
        if (facts.appeals.some((a) => a.status === "OPEN")) throw new Skip("an appeal is open", "appeal");
      } else {
        if (facts.holdBack) throw new Skip(facts.holdBack);
        if (!mayErase({ eraseAt: user.eraseAt, eraseWarnedAt: user.eraseWarnedAt, lastAppealDecidedAt: facts.lastAppealDecidedAt }, now, purgeConfig)) {
          throw new Skip("not warned long enough yet");
        }
      }
      const notes: string[] = [];

      // ---- the safety record is written FIRST, from the content that is about to be erased
      const keepDays = retentionDays(facts.seriousBan, purgeConfig);
      let recordId: number | null = null;
      if (facts.reasons.length > 0) {
        const posts = await tx.post.findMany({
          where: {
            authorId: user.id,
            deletedAt: null,
            OR: [
              { status: { not: ContentStatus.VISIBLE } },
              { reports: { some: { status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW, ReportStatus.ACTIONED] } } } },
            ],
          },
          orderBy: { id: "asc" },
          select: {
            id: true, title: true, body: true, status: true, statusNote: true, createdAt: true, editedAt: true,
            community: { select: { slug: true } },
            reports: { select: { id: true, reason: true, status: true, ruleId: true, createdAt: true } },
          },
        });
        const comments = await tx.comment.findMany({
          where: {
            authorId: user.id,
            deletedAt: null,
            OR: [
              { status: { not: ContentStatus.VISIBLE } },
              { reports: { some: { status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW, ReportStatus.ACTIONED] } } } },
            ],
          },
          orderBy: { id: "asc" },
          select: {
            id: true, postId: true, parentId: true, body: true, status: true, statusNote: true, createdAt: true, editedAt: true,
            reports: { select: { id: true, reason: true, status: true, ruleId: true, createdAt: true } },
          },
        });
        const socialPosts = await socialPostsForRecord(tx, user.id);
        const myPosts = (await tx.post.findMany({ where: { authorId: user.id }, select: { id: true } })).map((p) => String(p.id));
        const myComments = (await tx.comment.findMany({ where: { authorId: user.id }, select: { id: true } })).map((c) => String(c.id));
        const auditRows = await tx.auditLog.findMany({
          where: {
            OR: [
              { targetType: AuditTarget.USER, targetId: user.id },
              ...(myPosts.length ? [{ targetType: AuditTarget.POST, targetId: { in: myPosts } }] : []),
              ...(myComments.length ? [{ targetType: AuditTarget.COMMENT, targetId: { in: myComments } }] : []),
            ],
          },
          orderBy: { id: "asc" },
          select: { id: true },
        });
        const record = await tx.safetyRecord.create({
          data: {
            userId: user.id,
            emailHash: emailHash(user.email, secret),
            accountCreatedAt: user.createdAt,
            reasons: facts.reasons.join(","),
            siteRule: facts.bannedRow?.siteRule ?? null,
            banReason: facts.bannedRow?.reason ?? null,
            bannedAt: facts.bannedRow?.createdAt ?? null,
            auditLogIds: JSON.stringify(auditRows.map((r) => r.id)),
            content: JSON.stringify({ posts, comments, socialPosts, openReports: facts.openReports }),
            appeals: JSON.stringify(facts.appeals),
            keepUntil: new Date(now.getTime() + keepDays * DAY_MS),
            legalHold: user.legalHold,
          },
          select: { id: true },
        });
        recordId = record.id;
      }

      // ---- content: the text is erased for good (same rule as when an author deletes a single post or comment)
      await tx.post.updateMany({ where: { authorId: user.id, deletedAt: null }, data: { title: "", body: "", deletedAt: now } });
      await tx.comment.updateMany({ where: { authorId: user.id, deletedAt: null }, data: { body: "", deletedAt: now } });
      await tx.appeal.updateMany({ where: { appellantId: user.id }, data: { message: "" } });
      socialFiles.push(...(await socialPictureFiles(tx, user.id))); // read BEFORE the erasure clears the addresses
      await eraseSocial(tx, user.id, now); // social posts, quote texts, follows, notifications (SOCIAL_TODO 5)

      // ---- ways to log in, and everything that identifies the person
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.account.deleteMany({ where: { userId: user.id } });
      await tx.verification.deleteMany({ where: { OR: [{ identifier: user.email }, { value: user.id }] } });
      const moderated = await tx.membership.findMany({
        where: { userId: user.id, role: MemberRole.MODERATOR },
        select: { community: { select: { slug: true } } },
      });
      for (const m of moderated) notes.push(`${user.username} was a moderator of c/${m.community.slug}: that community may need a new moderator`);
      await tx.membership.deleteMany({ where: { userId: user.id } });

      // ---- ads the person booked: stopped, contact email erased
      const ads = await tx.adCampaign.findMany({
        where: { advertiserId: user.id },
        select: { id: true, status: true, paymentStatus: true, endDate: true, imageUrl: true, videoUrl: true },
      });
      for (const ad of ads) {
        if (ad.imageUrl) adFiles.push(ad.imageUrl);
        if (ad.videoUrl) adFiles.push(ad.videoUrl);
        const running = ad.status !== AdStatus.ENDED && ad.status !== AdStatus.REJECTED;
        await tx.adCampaign.update({
          where: { id: ad.id },
          data: running
            ? { contactEmail: "", imageUrl: null, videoUrl: null, status: AdStatus.ENDED, endDate: ad.endDate && ad.endDate < now ? ad.endDate : now }
            : { contactEmail: "", imageUrl: null, videoUrl: null },
        });
        if (running && ad.paymentStatus === AdPaymentStatus.PAID && ad.endDate && ad.endDate > now) {
          const days = Math.ceil((ad.endDate.getTime() - now.getTime()) / DAY_MS);
          notes.push(`ad #${ad.id} of ${user.username} was paid and is stopped ${days} day(s) early: refund by hand (TODO 46)`);
        }
      }

      // ---- the account itself becomes an anonymous shell. The check and the change are ONE statement.
      const changed = await tx.user.updateMany({
        where: by ? { id: user.id, status: user.status } : { id: user.id, status: user.status, eraseAt: { lte: now } },
        data: {
          status: UserStatus.DELETED,
          deletedAt: now,
          username: erasedUsername(user.id),
          email: erasedEmail(user.id),
          displayName: null,
          bio: null,
          image: null,
          timezone: null,
          language: "en",
          emailVerified: false,
          suspendedAt: null,
          suspendedUntil: null,
          suspensionKind: null,
          suspensionNote: null,
          eraseAt: null,
          eraseWarnedAt: null,
          legalHold: false,
        },
      });
      if (changed.count !== 1) throw new Skip("the account changed meanwhile");

      // ---- the audit row of the erasure itself, in the SAME transaction: no erasure without a record. No personal data in it.
      const erasedReason = erasureAuditReason({ kind: facts.banned ? "ban" : "deletion", reasons: facts.reasons, recordId, keepDays });
      if (by) {
        // Done by a person, so the row names that person (and keeps the reason they wrote). The reason is theirs: it may
        // hold personal details they typed (ACCOUNT_RULES.md, open questions for the lawyer).
        await tx.auditLog.create({
          data: {
            actorId: by.id,
            actorRole: by.role,
            action: AuditAction.ACCOUNT_ERASED,
            targetType: AuditTarget.USER,
            targetId: user.id,
            reason: `Erased at once by an admin: ${by.reason} | ${erasedReason}`,
          },
          select: { id: true },
        });
      } else {
        await writeSystemAudit(tx, AuditAction.ACCOUNT_ERASED, user.id, erasedReason);
      }

      return {
        email: user.email,
        name: user.displayName || user.username,
        reasons: facts.reasons,
        keepDays,
        kind: facts.banned ? ("ban" as const) : ("deletion" as const),
        notes,
      };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  // After the commit: the ad files of the erased person leave the disk (never throws; a leftover file is harmless, nothing points to it).
  await deleteAdFiles(adFiles);
  await deleteSocialImages(socialFiles); // same for the social picture files (never throws)

  // After the commit. Never undoes the erasure; a failed email is only logged.
  const params = { site: siteConfig.name, name: out.name, days: out.keepDays };
  const key = by ? "erasedByAdmin" : out.reasons.length > 0 ? "erasedRecord" : "erasedPlain";
  void sendEmail({ to: out.email, subject: t(`email.${key}.subject`, params), text: t(`email.${key}.body`, params) }).catch((error) =>
    console.error("sendEmail (erased notice) failed:", error),
  );
  return out;
}

// ------------------------------------------------------------------ erase ONE account at once (admin panel)

export type EraseNowResult =
  | { ok: true; notes: string[]; recordKept: boolean }
  | { error: "state" | "hold" | "appeal" | "nosecret" };

/**
 * A SUPER ADMIN erases one account right now (admin panel, /admin/people/<name>). The rules about WHO may do it and the written
 * reason are checked by the caller (admin-edit.ts); this function does the erasure itself, exactly like the scheduled one
 * (same transaction, same safety record for a ban / open report, same anonymous shell), without the waiting time and warning.
 * It refuses: an account under a legal hold, one with an open appeal, one already erased, any staff account.
 */
export async function eraseAccountNow(userId: string, by: ErasedBy): Promise<EraseNowResult> {
  const secret = hashSecret();
  if (!secret) return { error: "nosecret" };
  try {
    const out = await eraseAccount(userId, new Date(), secret, by);
    return { ok: true, notes: out.notes, recordKept: out.reasons.length > 0 };
  } catch (error) {
    if (error instanceof Skip) return { error: error.code === "other" ? "state" : error.code };
    throw error;
  }
}

// ------------------------------------------------------------------ the whole run

/**
 * `run: false` = PREVIEW: reads only, sends nothing, changes nothing. `run: true` = does it.
 * One person failing never stops the others.
 */
export async function runPurge(opts: { run: boolean }): Promise<PurgeReport> {
  const now = new Date();
  const report: PurgeReport = { run: opts.run, warned: [], erased: [], waiting: [], failed: [], notes: [], recordsSwept: [], notDueYet: 0 };
  const secret = hashSecret();
  if (opts.run && !secret) {
    throw new Error("SAFETY_HASH_SECRET (or BETTER_AUTH_SECRET) is not set in web/.env: a safety record cannot be made without it.");
  }

  const horizon = new Date(now.getTime() + purgeConfig.warnBeforeHours * 3_600_000);
  const people = await prisma.user.findMany({
    where: {
      eraseAt: { lte: horizon },
      OR: [{ status: UserStatus.DELETION_PENDING }, { status: UserStatus.SUSPENDED, suspensionKind: SuspensionKind.BAN }],
    },
    orderBy: { eraseAt: "asc" },
    select: dueSelect,
  });
  report.notDueYet = await prisma.user.count({
    where: {
      eraseAt: { gt: horizon },
      OR: [{ status: UserStatus.DELETION_PENDING }, { status: UserStatus.SUSPENDED, suspensionKind: SuspensionKind.BAN }],
    },
  });

  for (const user of people) {
    try {
      if (!user.eraseAt) continue;
      const facts = await gather(prisma, user);
      if (facts.holdBack) {
        report.waiting.push({ who: user.username, what: facts.holdBack + ": waiting" });
        continue;
      }
      const state = { eraseAt: user.eraseAt, eraseWarnedAt: user.eraseWarnedAt, lastAppealDecidedAt: facts.lastAppealDecidedAt };
      if (user.eraseAt > now) {
        // Not due yet; inside the warning window.
        if (warningIsDue(user.eraseAt, now, purgeConfig) && !warningIsValid(state, purgeConfig)) await warn(user, now, opts.run, report);
        else report.waiting.push({ who: user.username, what: `warned already, erase date ${when(user.eraseAt)}` });
        continue;
      }
      // The erase date has passed.
      if (!mayErase(state, now, purgeConfig)) {
        if (!warningIsValid(state, purgeConfig)) await warn(user, now, opts.run, report);
        else report.waiting.push({ who: user.username, what: "warned less than " + purgeConfig.minWarningHours + " hours ago: erased on a later run" });
        continue;
      }
      const kind = facts.banned ? "ban" : "deletion";
      const record = facts.reasons.length ? `, safety record kept ${retentionDays(facts.seriousBan, purgeConfig)} days (${facts.reasons.join("+")})` : ", no record kept";
      if (!opts.run) {
        report.erased.push({ who: user.username, what: `would be ERASED (${kind}${record})` });
        continue;
      }
      const done = await eraseAccount(user.id, now, secret as string);
      report.erased.push({ who: user.username, what: `ERASED (${kind}${record})` });
      report.notes.push(...done.notes);
    } catch (error) {
      if (error instanceof Skip) report.waiting.push({ who: user.username, what: error.message });
      else report.failed.push({ who: user.username, what: `FAILED, nothing was changed for this person: ${(error as Error).message}` });
    }
  }

  // ---- 3. safety records that ran out (never while a legal hold is set)
  const old = await prisma.safetyRecord.findMany({
    where: { legalHold: false, keepUntil: { lte: now } },
    orderBy: { id: "asc" },
    select: { id: true, userId: true },
  });
  if (!opts.run) {
    report.recordsSwept = old.map((r) => r.id);
    return report;
  }
  // One record = one transaction (the delete and its audit row). The delete re-checks the legal hold and the date itself,
  // so a hold set a moment ago wins, and then nothing is deleted and nothing is written. The audit row names the account
  // (an opaque id) and the record number, never what was in the record.
  for (const rec of old) {
    try {
      const gone = await prisma.$transaction(async (tx) => {
        const del = await tx.safetyRecord.deleteMany({ where: { id: rec.id, legalHold: false, keepUntil: { lte: now } } });
        if (del.count === 1) await writeSystemAudit(tx, AuditAction.SAFETY_RECORD_SWEPT, rec.userId, sweepAuditReason(rec.id));
        return del.count === 1;
      });
      if (gone) report.recordsSwept.push(rec.id);
    } catch (error) {
      report.failed.push({ who: `safety record #${rec.id}`, what: `FAILED, nothing was changed for this record: ${(error as Error).message}` });
    }
  }
  return report;
}

// ------------------------------------------------------------------ legal hold (PROJECT.md 8c point 4)
// A legal request or hold keeps a safety record longer than the normal time. Only an ACTIVE admin can set or release it;
// every change is one audit-log row (LEGAL_HOLD_SET / LEGAL_HOLD_RELEASED) with a written reason.

export type HoldError = "actor" | "notfound" | "reason" | "state";
export type HoldResult = { ok: true; auditId: number } | { error: HoldError };

async function activeAdmin(username: string) {
  const actor = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true },
  });
  return actor && actor.role === Role.ADMIN && actor.status === UserStatus.ACTIVE ? actor : null;
}

function cleanReason(reason: string): string | null {
  const text = reason.trim();
  return text.length >= staffConfig.minReasonLength && text.length <= staffConfig.maxReasonLength ? text : null;
}

/** Hold (or release) a person who is NOT erased yet: when the erase date comes, a record is kept and is not swept. */
export async function setPersonHold(input: { actor: string; person: string; hold: boolean; reason: string }): Promise<HoldResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await activeAdmin(input.actor);
  if (!actor) return { error: "actor" };
  const person = await prisma.user.findUnique({
    where: { username: input.person.trim().toLowerCase() },
    select: { id: true, status: true, legalHold: true },
  });
  if (!person) return { error: "notfound" };
  if (person.status === UserStatus.DELETED || person.legalHold === input.hold) return { error: "state" };
  const auditId = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: person.id }, data: { legalHold: input.hold } });
    const row = await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: input.hold ? AuditAction.LEGAL_HOLD_SET : AuditAction.LEGAL_HOLD_RELEASED,
        targetType: AuditTarget.USER,
        targetId: person.id,
        reason,
      },
      select: { id: true },
    });
    return row.id;
  });
  return { ok: true, auditId };
}

/** Hold (or release) a safety record that already exists (the person is already erased). */
export async function setRecordHold(input: { actor: string; recordId: number; hold: boolean; reason: string }): Promise<HoldResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await activeAdmin(input.actor);
  if (!actor) return { error: "actor" };
  if (!Number.isInteger(input.recordId) || input.recordId < 1) return { error: "notfound" };
  const record = await prisma.safetyRecord.findUnique({ where: { id: input.recordId }, select: { id: true, userId: true, legalHold: true } });
  if (!record) return { error: "notfound" };
  if (record.legalHold === input.hold) return { error: "state" };
  const auditId = await prisma.$transaction(async (tx) => {
    await tx.safetyRecord.update({ where: { id: record.id }, data: { legalHold: input.hold } });
    const row = await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: input.hold ? AuditAction.LEGAL_HOLD_SET : AuditAction.LEGAL_HOLD_RELEASED,
        targetType: AuditTarget.USER,
        targetId: record.userId,
        reason: `Safety record #${record.id}: ${reason}`,
      },
      select: { id: true },
    });
    return row.id;
  });
  return { ok: true, auditId };
}

/** The safety records (list only; the full content stays in the database for admins). */
export async function listSafetyRecords() {
  return prisma.safetyRecord.findMany({
    orderBy: { id: "asc" },
    select: { id: true, userId: true, reasons: true, siteRule: true, erasedAt: true, keepUntil: true, legalHold: true },
  });
}
