"use server";

// "Appeal this decision" for a suspended or banned person (TODO 36d, PROJECT.md 8c point 3).
// The appeal points to the audit-log row of the staff decision. One appeal per decision (the database
// refuses a second one). Reviewing appeals is Phase 3; while an appeal is open, the erase step (36e)
// must not erase the account. The browser is not trusted: the person comes from the login cookie.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { staffConfig } from "@/config/site";
import { AuditAction, AuditTarget, UserStatus } from "../../../../../generated/prisma/client";

export type AppealResult = { ok: true } | { error: "short" | "generic" };

export async function submitAppeal(input: { message: string }): Promise<AppealResult> {
  if (typeof input?.message !== "string") return { error: "generic" };
  const message = input.message.trim();
  if (message.length < staffConfig.minAppealLength) return { error: "short" };
  if (message.length > staffConfig.maxAppealLength) return { error: "generic" };

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "generic" };
    const account = await loadAccount(session.user.id);
    if (!account || account.status !== UserStatus.SUSPENDED) return { error: "generic" };

    // The decision being appealed: the newest staff action on this person.
    const decision = await prisma.auditLog.findFirst({
      where: {
        targetType: AuditTarget.USER,
        targetId: account.id,
        action: { in: [AuditAction.USER_SUSPENDED, AuditAction.USER_BANNED] },
      },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    if (!decision) return { error: "generic" };

    await prisma.appeal.create({ data: { appellantId: account.id, auditLogId: decision.id, message } });
    return { ok: true };
  } catch (error) {
    // A second appeal for the same decision breaks the unique key (P2002): shown as the generic error.
    if ((error as { code?: string })?.code !== "P2002") console.error("submitAppeal failed:", error);
    return { error: "generic" };
  }
}
