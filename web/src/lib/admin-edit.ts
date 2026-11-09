// Admin panel, People: EDIT a person's profile (any active admin) and ERASE an account at once (the SUPER admin only).
// Like staff.ts, this is the ONE place these rules live; the buttons only call these functions.
//
// EDIT (display name, bio, username, email):
//  1. Only an ACTIVE ADMIN. Never on yourself (you have the settings page), never on other staff, never on an erased account.
//     (Staff are excluded on purpose: changing the email of an admin would let one admin take over another admin's account.)
//  2. A written reason (same length rule as every staff action) is mandatory. Nothing is silent:
//     one audit row (USER_EDITED: the NAMES of the changed fields, never the values) saved in the SAME transaction as the change,
//     and an email to the person (to the old address, and to the new one when the email changed) saying what changed and why.
//  3. Username: same rule as sign-up (username.ts) and unique. Email: valid and unique, lower case.
//  4. When the EMAIL changes the new address is NOT trusted: emailVerified becomes false, every login session of the person ends,
//     and the person must confirm the new address (logging in sends the link: sendOnSignIn in auth.ts) before they can log in again.
//
// ERASE NOW (super admin only): the same erasure as the scheduled one (purge.ts), without the 7 days and the warning.
//  The account row stays as an anonymous shell (replies, votes and the audit log keep working). Needs a written reason and the
//  username typed as confirmation. Refused: an account under a legal hold, one with an open appeal, any staff account,
//  an erased account. The audit row ACCOUNT_ERASED names the super admin who did it.
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { siteConfig, staffConfig } from "@/config/site";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { cleanReason, findActor, findTarget, type StaffError } from "@/lib/staff";
import { confirmMatches, editAuditReason, planEdit, type EditField, type ProfileInput } from "@/lib/admin-edit-rules";
import { eraseAccountNow } from "@/lib/purge";
import { erasedUsername } from "@/lib/purge-rules";
import { normalizeUsername } from "@/lib/username";
import { AuditAction, AuditTarget, Role, UserStatus } from "../../generated/prisma/client";

export type EditError = StaffError | "name" | "bio" | "username" | "usernametaken" | "email" | "emailtaken" | "nochange";
export type EraseError = StaffError | "confirm" | "hold" | "appeal" | "nosecret";
/** Every error code the person's page can show (texts: admin.err.<code>). */
export type AdminEditError = EditError | EraseError;

export type EditResult = { ok: true; auditId: number; changed: EditField[]; username: string } | { error: EditError };
export type EraseResult = { ok: true; notes: string[]; recordKept: boolean; erasedAs: string } | { error: EraseError };

class Refused extends Error {
  constructor(public code: EditError) {
    super(code);
  }
}

function settingsUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000") + "/settings";
}

// ------------------------------------------------------------------ edit

export async function editUser(input: { actor: string; target: string; reason: string } & ProfileInput): Promise<EditResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  const target = await prisma.user.findUnique({
    where: { username: normalizeUsername(input.target) },
    select: { id: true, username: true, email: true, displayName: true, bio: true, role: true, status: true },
  });
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.role !== Role.USER || target.status === UserStatus.DELETED) return { error: "target" };

  const plan = planEdit(
    { displayName: target.displayName, bio: target.bio, username: target.username, email: target.email },
    { displayName: String(input.displayName ?? ""), bio: String(input.bio ?? ""), username: String(input.username ?? ""), email: String(input.email ?? "") },
    { maxName: staffConfig.maxDisplayNameLength, maxBio: staffConfig.maxBioLength },
  );
  if (plan.problem !== null) return { error: plan.problem };
  const { data, changed } = plan;
  const emailChanged = changed.includes("email");

  try {
    const auditId = await prisma.$transaction(async (tx) => {
      if (data.username !== undefined) {
        const taken = await tx.user.findUnique({ where: { username: data.username }, select: { id: true } });
        if (taken && taken.id !== target.id) throw new Refused("usernametaken");
      }
      if (data.email !== undefined) {
        const taken = await tx.user.findUnique({ where: { email: data.email }, select: { id: true } });
        if (taken && taken.id !== target.id) throw new Refused("emailtaken");
      }
      // The change and the check "still the same person, still a plain user" are ONE statement.
      const done = await tx.user.updateMany({
        where: { id: target.id, role: Role.USER, status: { not: UserStatus.DELETED }, username: target.username, email: target.email },
        data: { ...data, ...(emailChanged ? { emailVerified: false } : {}) },
      });
      if (done.count !== 1) throw new Refused("state");
      if (emailChanged) {
        // The new address is not trusted yet: end every login and every open e-mail / reset code of the old address.
        await tx.session.deleteMany({ where: { userId: target.id } });
        await tx.verification.deleteMany({ where: { OR: [{ identifier: target.email }, { value: target.id }] } });
      }
      const row = await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action: AuditAction.USER_EDITED,
          targetType: AuditTarget.USER,
          targetId: target.id,
          reason: editAuditReason(changed, reason),
        },
        select: { id: true },
      });
      return row.id;
    });

    notifyEdited(target, data, changed, reason);
    return { ok: true, auditId, changed, username: data.username ?? target.username };
  } catch (error) {
    if (error instanceof Refused) return { error: error.code };
    // Two admins saving the same new username / email at the same moment: the database refuses the second one.
    if ((error as { code?: string }).code === "P2002") {
      const where = JSON.stringify((error as { meta?: unknown }).meta ?? "");
      return { error: where.includes("email") ? "emailtaken" : "usernametaken" };
    }
    throw error;
  }
}

function notifyEdited(
  before: { username: string; email: string; displayName: string | null },
  data: { username?: string; email?: string; displayName?: string | null },
  changed: EditField[],
  reason: string,
): void {
  const label = (field: EditField) => t(`admin.act.f.${field}` as MessageKey);
  const lines = changed.map((field) => {
    if (field === "username") return `${label(field)}: @${before.username} → @${data.username}`;
    if (field === "email") return `${label(field)}: ${before.email} → ${data.email}`;
    return label(field);
  });
  if (changed.includes("email")) lines.push("", t("email.edited.verifyNote"));
  const params = {
    site: siteConfig.name,
    name: (data.displayName !== undefined ? data.displayName : before.displayName) || data.username || before.username,
    fields: changed.map(label).join(", "),
    changes: lines.join("\n"),
    reason,
    url: settingsUrl(),
  };
  // Never awaited, never fails the edit (it is saved already): same as every other staff email.
  const to = changed.includes("email") && data.email ? [before.email, data.email] : [before.email];
  for (const address of to) {
    void sendEmail({ to: address, subject: t("email.edited.subject", params), text: t("email.edited.body", params) }).catch((error) =>
      console.error("sendEmail (profile edited) failed:", error),
    );
  }
}

// ------------------------------------------------------------------ erase now

export async function eraseNow(input: { actor: string; target: string; reason: string; confirm: string }): Promise<EraseResult> {
  const reason = cleanReason(input.reason);
  if (!reason) return { error: "reason" };
  const actor = await findActor(input.actor);
  if (!actor) return { error: "actor" };
  if (!actor.isSuperAdmin) return { error: "superonly" };
  const target = await findTarget(input.target);
  if (!target) return { error: "notfound" };
  if (target.id === actor.id) return { error: "self" };
  if (target.role !== Role.USER || target.isSuperAdmin || target.status === UserStatus.DELETED) return { error: "target" };
  if (!confirmMatches(String(input.confirm ?? ""), target.username)) return { error: "confirm" };

  const result = await eraseAccountNow(target.id, { id: actor.id, role: actor.role, reason });
  if ("error" in result) return { error: result.error };
  return { ok: true, notes: result.notes, recordKept: result.recordKept, erasedAs: erasedUsername(target.id) };
}
