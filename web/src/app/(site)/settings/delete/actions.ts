"use server";

// Delete your own account (TODO 36c, PROJECT.md 8c point 1).
//   1. The person types the password again (a stolen login cookie alone is not enough).
//   2. The account waits `accountConfig.deletionGraceDays` days as DELETION_PENDING; nothing is erased yet.
//   3. All other devices are logged out (the browser then logs this one out).
//   4. Logging in again, or "Keep my account", cancels it (cancelPendingDeletion, see also the
//      login hook in src/lib/auth.ts). The final erasure after the waiting time is TODO 36e.
// The browser is not trusted: who the person is comes from the login cookie only.
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { cancelPendingDeletion, loadAccount, requestDeletion } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { accountConfig } from "@/config/site";
import { getLocale } from "@/i18n";
import { MemberRole, UserStatus } from "../../../../../generated/prisma/client";

export type DeleteErrorCode =
  | "password" // the password is wrong
  | "tooMany" // too many wrong passwords lately
  | "moderator" // the person moderates a community (cannot leave it yet either)
  | "state" // the account is not active (suspended, banned, or already waiting)
  | "generic";

/** `when` is the erase date, already formatted (UTC, translated) for the "done" message. */
export type DeleteResult = { ok: true; when: string } | { error: DeleteErrorCode };
export type KeepResult = { ok: true } | { error: true };

// Wrong passwords per person, kept in server memory (same approach as src/lib/ad-guard.ts; a shared
// limiter for many servers is TODO 50). It only slows down someone who holds a stolen login.
const failures = new Map<string, number[]>();

function recentFailures(userId: string, now: number): number[] {
  const windowMs = accountConfig.deletePasswordWindowMinutes * 60 * 1000;
  const recent = (failures.get(userId) ?? []).filter((time) => now - time < windowMs);
  if (recent.length > 0) failures.set(userId, recent);
  else failures.delete(userId);
  return recent;
}

export async function requestAccountDeletion(input: { password: string }): Promise<DeleteResult> {
  if (typeof input?.password !== "string" || input.password.length === 0) return { error: "generic" };
  // Passwords are 8-128 characters (src/lib/auth.ts): anything longer cannot be right.
  if (input.password.length > 128) return { error: "password" };

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: "generic" };
    const userId = session.user.id;

    const account = await loadAccount(userId);
    if (!account || account.status !== UserStatus.ACTIVE) return { error: "state" };

    const now = Date.now();
    if (recentFailures(userId, now).length >= accountConfig.deletePasswordMaxFailures) {
      return { error: "tooMany" };
    }

    // A community needs its moderators; handing over comes with the Phase 3 tools. Same rule as
    // "Leave" (patch-41).
    const moderating = await prisma.membership.count({
      where: { userId, role: { not: MemberRole.MEMBER } },
    });
    if (moderating > 0) return { error: "moderator" };

    // Check the password against the stored hash with Better Auth's own verifier.
    // Today every login is email + password. When social login is added, a person without a
    // password will need another way to confirm (a link emailed to them); until then: generic error.
    const credential = await prisma.account.findFirst({
      where: { userId, providerId: "credential" },
      select: { password: true },
    });
    if (!credential?.password) return { error: "generic" };
    const context = await auth.$context;
    const correct = await context.password.verify({ hash: credential.password, password: input.password });
    if (!correct) {
      failures.set(userId, [...recentFailures(userId, now), now]);
      return { error: "password" };
    }
    failures.delete(userId);

    const eraseAt = await requestDeletion(userId);
    if (!eraseAt) return { error: "state" };

    // Log every other device out. This device is logged out by the browser right after (it calls
    // the normal log-out), so that nobody is left logged in on a deleted account by accident.
    try {
      await auth.api.revokeOtherSessions({ headers: await headers() });
    } catch (error) {
      console.error("requestAccountDeletion: revokeOtherSessions failed:", error);
    }

    const when =
      new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(eraseAt) +
      " UTC";
    return { ok: true, when };
  } catch (error) {
    console.error("requestAccountDeletion failed:", error);
    return { error: "generic" };
  }
}

/** "Keep my account": cancels a pending deletion for the logged-in person. */
export async function keepMyAccount(): Promise<KeepResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { error: true };
    await cancelPendingDeletion(session.user.id);
    return { ok: true };
  } catch (error) {
    console.error("keepMyAccount failed:", error);
    return { error: true };
  }
}
