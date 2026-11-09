// Staff actions on a person's ACCOUNT: temporary suspension, ban, lifting (TODO 36d, PROJECT.md 8c + 8d).
// This is the ONE place these rules live. Today it is called by `npm run staff` (scripts/staff.ts);
// the Phase 4 admin panel will call the same functions.
//
// Fairness rules enforced here (a staff member cannot skip them):
//  1. Only an ACTIVE ADMIN acts. Nobody acts on themselves, on other staff, or on an erased account.
//  2. A site rule (staffConfig.siteRules) AND a written reason (min. length) are mandatory.
//  3. Nothing is silent: one AuditLog row per action, and an email to the person with rule, reason,
//     dates and how to export data / appeal.
//  4. Ladder: a temporary suspension is 1-30 days. A BAN needs a "serious" rule, or an earlier
//     suspension of the same person within a year. Otherwise it is refused ("suspend first").
//  5. A ban gives the person 7 days (export, appeal) before erasure; erasing is TODO 36e.
//  6. A BAN needs TWO different admins (patch-36d2): one PROPOSES (rule + reason), another APPROVES
//     with a written note. Until then nothing happens to the person. A proposal lapses after 7 days.
// The action and its audit row are saved in ONE transaction: no action without a record.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { siteConfig, staffConfig, type SiteRuleKey } from "@/config/site";
import { t } from "@/i18n";
import {
  AuditAction,
  AuditTarget,
  BanProposalStatus,
  Role,
  SuspensionKind,
  UserStatus,
} from "../../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export type StaffError =
  | "actor" // the actor is not an active admin
  | "notfound" // no such person
  | "target" // the person cannot be acted on (staff, erased account)
  | "self"
  | "rule" // not one of the site rules
  | "reason" // missing or too short / too long
  | "days"
  | "state" // the account is in a state where this action does not apply
  | "ladder" // ban refused: not a serious rule and no earlier suspension
  | "pending" // this person already has an open ban proposal
  | "noproposal" // no such open proposal (wrong number, already decided, or lapsed)
  | "approver" // the proposer cannot approve their own proposal
  | "lastadmin" // the last active admin cannot lose admin rights
  | "superonly"; // only the SUPER admin can make or remove admins
export type StaffResult = { ok: true; auditId: number } | { error: StaffError };
export type ProposeResult = { ok: true; proposalId: number } | { error: StaffError };

class Refused extends Error {
  constructor(public code: StaffError) {
    super(code);
  }
}

type Input = { actor: string; target: string; reason: string };

function isRule(value: string): value is SiteRuleKey {
  return staffConfig.siteRules.some((r) => r.key === value);
}

export function cleanReason(reason: string): string | null {
  const text = reason.trim();
  return text.length >= staffConfig.minReasonLength && text.length <= staffConfig.maxReasonLength ? text : null;
}

export async function findActor(username: string) {
  const actor = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, role: true, status: true, isSuperAdmin: true },
  });
  return actor && actor.role === Role.ADMIN && actor.status === UserStatus.ACTIVE ? actor : null;
}

export async function findTarget(username: string) {
  return prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, username: true, email: true, displayName: true, role: true, status: true, suspensionKind: true, isSuperAdmin: true },
  });
}

function settingsUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + "/settings";
}

function when(date: Date): string {
  return (
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC"
  );
}

function notify(person: { email: string; displayName: string | null; username: string }, kind: "suspended" | "banned" | "lifted", params: Record<string, string>) {
  const common = { site: siteConfig.name, name: person.displayName || person.username, url: settingsUrl(), ...params };
  // Not awaited and never fails the action (same as the other emails): the action is already saved.
  void sendEmail({
    to: person.email,
    subject: t(`email.${kind}.subject`, common),
    text: t(`email.${kind}.body`, common),
  }).catch((error) => console.error("sendEmail failed:", error));
}

/** Temporary suspension: nothing is erased, the person returns by itself (loadAccount lifts it). */
export async function suspendUser(input: Input & { days: number; rule: string }): Promise<StaffResult> {
  const reason = cleanReason(input.reason);
  if (!isRule(input.rule)) return { error: "rule" };
  if (!reason) return { error: "reason" };
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > staffConfig.maxSuspensionDays) {
    return { error: "days" };
  }
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.role !== Role.USER || target.status === UserStatus.DELETED) return { error: "target" };
  if (target.status !== UserStatus.ACTIVE) return { error: "state" };

  const now = new Date();
  const until = new Date(now.getTime() + input.days * DAY_MS);
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: target.id, status: UserStatus.ACTIVE },
        data: {
          status: UserStatus.SUSPENDED,
          suspendedAt: now,
          suspendedUntil: until,
          suspensionKind: SuspensionKind.TEMPORARY,
          suspensionNote: reason,
          eraseAt: null,
        },
      });
      if (changed.count !== 1) throw new Refused("state");
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: AuditAction.USER_SUSPENDED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          siteRule: input.rule,
          reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    notify(target, "suspended", { rule: t(`siteRule.${input.rule}`), reason, time: when(until) });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

function proposalCutoff(): Date {
  return new Date(Date.now() - staffConfig.banProposalDays * DAY_MS);
}

type BanTarget = NonNullable<Awaited<ReturnType<typeof findTarget>>>;

/** Can this person be banned right now, and is the ladder satisfied? Used when proposing AND when approving. */
async function banCheck(target: BanTarget, ruleKey: string): Promise<StaffError | null> {
  const rule = staffConfig.siteRules.find((r) => r.key === ruleKey);
  if (!rule) return "rule";
  if (target.role !== Role.USER || target.status === UserStatus.DELETED) return "target";
  const banable =
    target.status === UserStatus.ACTIVE ||
    target.status === UserStatus.DELETION_PENDING || // deleting yourself must not be a way out of a ban
    (target.status === UserStatus.SUSPENDED && target.suspensionKind === SuspensionKind.TEMPORARY);
  if (!banable) return "state";
  if (!rule.serious) {
    const since = new Date(Date.now() - staffConfig.repeatWindowDays * DAY_MS);
    const earlier = await prisma.auditLog.count({
      where: { targetType: AuditTarget.USER, targetId: target.id, action: AuditAction.USER_SUSPENDED, createdAt: { gte: since } },
    });
    if (earlier === 0) return "ladder";
  }
  return null;
}

/**
 * Step 1 of a permanent ban: an admin PROPOSES it. Nothing happens to the person yet; the proposal is
 * written to the audit log (BAN_PROPOSED) and waits for a DIFFERENT admin (decideBan).
 */
export async function proposeBan(input: Input & { rule: string }): Promise<ProposeResult> {
  const reason = cleanReason(input.reason);
  if (!isRule(input.rule)) return { error: "rule" };
  if (!reason) return { error: "reason" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  const problem = await banCheck(target, input.rule);
  if (problem) return { error: problem };

  try {
    const proposalId = await prisma.$transaction(async (tx) => {
      const open = await tx.banProposal.count({
        where: { targetId: target.id, status: BanProposalStatus.PENDING, createdAt: { gte: proposalCutoff() } },
      });
      if (open > 0) throw new Refused("pending");
      const row = await tx.banProposal.create({
        data: { targetId: target.id, proposerId: actor.id, siteRule: input.rule, reason },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: AuditAction.BAN_PROPOSED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          siteRule: input.rule,
          reason,
        },
      });
      return row.id;
    });
    return { ok: true, proposalId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/**
 * Step 2: a DIFFERENT admin approves or rejects, with a written note. Approving re-checks everything
 * (the person may have changed state; the ladder must still hold) and then bans: the person is
 * emailed and has 7 days to export data and appeal. Rejecting only closes the proposal.
 */
export async function decideBan(input: { actor: string; proposalId: number; approve: boolean; note: string }): Promise<StaffResult> {
  const note = cleanReason(input.note);
  if (!note) return { error: "reason" };
  if (!Number.isInteger(input.proposalId) || input.proposalId < 1) return { error: "noproposal" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };

  const proposal = await prisma.banProposal.findFirst({
    where: { id: input.proposalId, status: BanProposalStatus.PENDING, createdAt: { gte: proposalCutoff() } },
  });
  if (!proposal) return { error: "noproposal" };
  const target = await prisma.user.findUnique({
    where: { id: proposal.targetId },
    select: { id: true, username: true, email: true, displayName: true, role: true, status: true, suspensionKind: true, isSuperAdmin: true },
  });
  if (!target) return { error: "notfound" };
  // Rejecting is allowed to anyone (the proposer can withdraw); APPROVING needs a second person.
  if (input.approve && proposal.proposerId === actor.id) return { error: "approver" };
  if (input.approve && target.id === actor.id) return { error: "self" };

  if (input.approve) {
    const problem = await banCheck(target, proposal.siteRule);
    if (problem) return { error: problem };
  }

  const now = new Date();
  const eraseAt = new Date(now.getTime() + staffConfig.banGraceDays * DAY_MS);
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const closed = await tx.banProposal.updateMany({
        where: { id: proposal.id, status: BanProposalStatus.PENDING },
        data: {
          status: input.approve ? BanProposalStatus.APPROVED : BanProposalStatus.REJECTED,
          decidedById: actor.id,
          decidedAt: now,
          decisionNote: note,
        },
      });
      if (closed.count !== 1) throw new Refused("noproposal");

      if (input.approve) {
        const changed = await tx.user.updateMany({
          where: {
            id: target.id,
            OR: [
              { status: { in: [UserStatus.ACTIVE, UserStatus.DELETION_PENDING] } },
              { status: UserStatus.SUSPENDED, suspensionKind: SuspensionKind.TEMPORARY },
            ],
          },
          data: {
            status: UserStatus.SUSPENDED,
            suspendedAt: now,
            suspendedUntil: null,
            suspensionKind: SuspensionKind.BAN,
            suspensionNote: proposal.reason,
            eraseAt,
          },
        });
        if (changed.count !== 1) throw new Refused("state");
      }
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: input.approve ? AuditAction.USER_BANNED : AuditAction.BAN_REJECTED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          siteRule: proposal.siteRule,
          reason: input.approve ? proposal.reason : note,
        },
        select: { id: true },
      });
      return row.id;
    });
    if (input.approve) {
      notify(target, "banned", { rule: t(`siteRule.${proposal.siteRule as SiteRuleKey}`), reason: proposal.reason, time: when(eraseAt) });
    }
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/** Open (not decided, not lapsed) ban proposals, oldest first. */
export async function listBanProposals() {
  const rows = await prisma.banProposal.findMany({
    where: { status: BanProposalStatus.PENDING, createdAt: { gte: proposalCutoff() } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      siteRule: true,
      reason: true,
      createdAt: true,
      target: { select: { username: true } },
      proposer: { select: { username: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    person: r.target.username,
    proposedBy: r.proposer.username,
    rule: r.siteRule,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
}

/** End a suspension or ban early (for example after a successful appeal). A written reason is required. */
export async function liftSuspension(input: Input): Promise<StaffResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.status !== UserStatus.SUSPENDED) return { error: "state" };

  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: target.id, status: UserStatus.SUSPENDED },
        data: {
          status: UserStatus.ACTIVE,
          suspendedAt: null,
          suspendedUntil: null,
          suspensionKind: null,
          suspensionNote: null,
          eraseAt: null,
        },
      });
      if (changed.count !== 1) throw new Refused("state");
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: AuditAction.USER_RESTORED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          reason,
        },
        select: { id: true },
      });
      return row.id;
    });
    notify(target, "lifted", { reason });
    return { ok: true, auditId };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    throw error;
  }
}

/**
 * Bootstrap: the SUPER admin. Allowed ONLY while no super admin exists (run once from the terminal; after that
 * the super admin makes and removes every other admin from the admin panel, /admin/team). The person also gets
 * the ADMIN role. Written to the audit log like everything else.
 */
export async function makeFirstSuperAdmin(username: string): Promise<"ok" | "notfound" | "exists"> {
  const person = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    select: { id: true },
  });
  if (!person) return "notfound";
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.user.count({ where: { isSuperAdmin: true } })) > 0) throw new Refused("actor");
      await tx.user.update({ where: { id: person.id }, data: { role: Role.ADMIN, isSuperAdmin: true } });
      await tx.auditLog.create({
        data: {
          actorId: person.id,
          actorRole: Role.ADMIN,
          action: AuditAction.ROLE_CHANGED,
          targetType: AuditTarget.USER,
          targetId: person.id,
          reason: "Super admin (bootstrap, no super admin existed)",
        },
      });
    });
    return "ok";
  } catch (error) {
    if (error instanceof Refused) return "exists";
    throw error;
  }
}

/**
 * The SUPER admin makes another ACTIVE person an admin (a ban needs two admins, so there must be a way to
 * get a second one). Ordinary admins can not do this. Audited (ROLE_CHANGED). Removing admin rights: removeAdmin() below.
 */
export async function makeAdmin(input: { actor: string; target: string }): Promise<StaffResult> {
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  if (!actor.isSuperAdmin) return { error: "superonly" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.status !== UserStatus.ACTIVE || target.role !== Role.USER) return { error: "target" };
  const auditId = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { role: Role.ADMIN } });
    const row = await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        action: AuditAction.ROLE_CHANGED,
        targetType: AuditTarget.USER,
        targetId: target.id,
        reason: "Made admin by " + input.actor.trim().toLowerCase(),
      },
      select: { id: true },
    });
    return row.id;
  });
  return { ok: true, auditId };
}

/**
 * The SUPER admin takes admin rights away from another admin (never from a super admin). Rules: a written reason
 * is required; nobody does it to themselves; the LAST active admin can never be removed (the check and the
 * change happen in ONE transaction, so two admins cannot remove each other at the same moment). Audited (ROLE_CHANGED).
 */
export async function removeAdmin(input: Input): Promise<StaffResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  if (!actor.isSuperAdmin) return { error: "superonly" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.role !== Role.ADMIN || target.isSuperAdmin) return { error: "target" };
  try {
    const auditId = await prisma.$transaction(async (tx) => {
      const others = await tx.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, id: { not: target.id } },
      });
      if (others < 1) throw new Refused("lastadmin");
      const changed = await tx.user.updateMany({ where: { id: target.id, role: Role.ADMIN }, data: { role: Role.USER } });
      if (changed.count !== 1) throw new Refused("target");
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: AuditAction.ROLE_CHANGED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          reason: "Admin rights removed: " + reason,
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
