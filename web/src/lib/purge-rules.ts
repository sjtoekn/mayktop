// The small, plain rules of the final erasure (TODO 36e). No database here, so they are easy to read and to test.
// src/lib/purge.ts does the work; the numbers come from `purgeConfig` in src/config/site.ts.
import { createHmac } from "node:crypto";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export type PurgeNumbers = {
  warnBeforeHours: number;
  minWarningHours: number;
  afterAppealDays: number;
  recordDays: number;
  recordSeriousDays: number;
};

/**
 * Was the person properly WARNED about THIS erase date? (No surprise erasure, PROJECT.md 8c.)
 * A warning counts only when it was sent inside the last `warnBeforeHours` before the erase date (or later),
 * so a warning from an older deletion / ban that was cancelled does not count, and only when it is newer than
 * the last decided appeal (after an appeal is decided the person is told again).
 */
export function warningIsValid(
  p: { eraseAt: Date | null; eraseWarnedAt: Date | null; lastAppealDecidedAt: Date | null },
  n: PurgeNumbers,
): boolean {
  if (!p.eraseAt || !p.eraseWarnedAt) return false;
  if (p.eraseWarnedAt.getTime() < p.eraseAt.getTime() - n.warnBeforeHours * HOUR_MS) return false;
  if (p.lastAppealDecidedAt && p.eraseWarnedAt.getTime() < p.lastAppealDecidedAt.getTime()) return false;
  return true;
}

/** Warning is due when the erase date is at most `warnBeforeHours` away (or already passed). */
export function warningIsDue(eraseAt: Date, now: Date, n: PurgeNumbers): boolean {
  return eraseAt.getTime() - now.getTime() <= n.warnBeforeHours * HOUR_MS;
}

/** May the account be erased now? Date passed, a valid warning, and that warning is at least `minWarningHours` old. */
export function mayErase(
  p: { eraseAt: Date | null; eraseWarnedAt: Date | null; lastAppealDecidedAt: Date | null },
  now: Date,
  n: PurgeNumbers,
): boolean {
  if (!p.eraseAt || p.eraseAt.getTime() > now.getTime()) return false;
  if (!warningIsValid(p, n) || !p.eraseWarnedAt) return false;
  return now.getTime() - p.eraseWarnedAt.getTime() >= n.minWarningHours * HOUR_MS;
}

/**
 * The time to tell the person in the warning email: the erase date, or, when that date has already passed
 * (the purge did not run for a while), the earliest moment the erasure can still happen.
 */
export function announcedTime(eraseAt: Date, now: Date, n: PurgeNumbers): Date {
  return new Date(Math.max(eraseAt.getTime(), now.getTime() + n.minWarningHours * HOUR_MS));
}

/** When an appeal still holds the erasure back: it is open, or it was decided less than `afterAppealDays` ago. */
export function appealHoldsBack(
  appeals: { status: string; decidedAt: Date | null }[],
  now: Date,
  n: PurgeNumbers,
): string | null {
  if (appeals.some((a) => a.status === "OPEN")) return "an appeal is open";
  const last = latestDecision(appeals);
  if (last && now.getTime() - last.getTime() < n.afterAppealDays * DAY_MS) {
    return `an appeal was decided less than ${n.afterAppealDays} days ago`;
  }
  return null;
}

export function latestDecision(appeals: { decidedAt: Date | null }[]): Date | null {
  let last: Date | null = null;
  for (const a of appeals) if (a.decidedAt && (!last || a.decidedAt > last)) last = a.decidedAt;
  return last;
}

/** How many days the safety record is kept after the erasure (PROJECT.md 8c point 4). */
export function retentionDays(seriousBan: boolean, n: PurgeNumbers): number {
  return seriousBan ? n.recordSeriousDays : n.recordDays;
}

/**
 * One-way code of an email address: HMAC-SHA256 with a server secret, so nobody can find the address by guessing
 * (a plain hash of an email can be reversed by trying addresses). Same address -> same code, so a returning
 * banned person can still be recognised by an admin.
 */
export function emailHash(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

/** What an erased account keeps as its name / email: a unique placeholder (both columns are unique in the database). */
export function erasedUsername(id: string): string {
  return `deleted-${id}`;
}
export function erasedEmail(id: string): string {
  return `${id}@erased.invalid`;
}

export type SafetyReason = "BAN" | "OPEN_REPORT" | "LEGAL_HOLD";

/** Which reasons (if any) require a safety record. An empty list = nothing is kept. */
export function recordReasons(p: { banned: boolean; openReports: number; legalHold: boolean }): SafetyReason[] {
  const out: SafetyReason[] = [];
  if (p.banned) out.push("BAN");
  if (p.openReports > 0) out.push("OPEN_REPORT");
  if (p.legalHold) out.push("LEGAL_HOLD");
  return out;
}

// ------------------------------------------------------------------ audit rows written by the purge job (Part 9)
// The purge job is not a person, so its audit rows need an actor that cannot do anything else. It is ONE anonymous
// shell account (same look as an erased account: `deleted-system`, `system@erased.invalid`), role USER, status DELETED,
// no password and no login method: it cannot log in, and it is not an admin, so it can never be used as the "actor"
// of a staff command or count as the second admin of a ban. (Why not `actorId = null`? In SQLite that means rebuilding
// the AuditLog table that Appeal points to, and every reader of `row.actor` would change. The shell needs neither.)
//
// RULE for these three reasons: they are written to be kept, so they NEVER contain a name, an e-mail address, a
// username or any text the person wrote. Only: the kind (deletion / ban), the record number, the number of days.
export const SYSTEM_ACTOR_ID = "system";

export function isSystemActor(actorId: string): boolean {
  return actorId === SYSTEM_ACTOR_ID;
}

/** Reason of ACCOUNT_ERASE_WARNED. `time` is the moment announced in the e-mail. */
export function warningAuditReason(kind: "Ban" | "Deletion", time: Date): string {
  return `${kind.toLowerCase()} erasure warning e-mailed; erase on or after ${time.toISOString()}`;
}

/** Reason of ACCOUNT_ERASED. recordId = null means that no safety record was kept. */
export function erasureAuditReason(p: { kind: "deletion" | "ban"; reasons: SafetyReason[]; recordId: number | null; keepDays: number }): string {
  const record = p.recordId === null ? "no safety record kept" : `safety record #${p.recordId} (${p.reasons.join("+")}) kept ${p.keepDays} days`;
  return `account erased (${p.kind}); ${record}`;
}

/** Reason of SAFETY_RECORD_SWEPT. */
export function sweepAuditReason(recordId: number): string {
  return `safety record #${recordId} deleted: keep-until date passed and no legal hold`;
}
