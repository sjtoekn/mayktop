// Account state for server code (TODO 36a). See PROJECT.md 8c.
//
// loadAccount() reads the person from the database and, when a TEMPORARY suspension has run
// out, lifts it on the spot (no background job needed). Everything that asks "may this person
// act?" goes through here (src/lib/session.ts does).
//
// Own account deletion (TODO 36c): requestDeletion() starts the waiting time, cancelPendingDeletion()
// ends it. Nothing is erased here: the final erasure after the waiting time is TODO 36e.
import { prisma } from "@/lib/prisma";
import { accountConfig } from "@/config/site";
import { SuspensionKind, UserStatus } from "../../generated/prisma/client";

export type Account = {
  id: string;
  username: string;
  email: string;
  status: UserStatus;
  suspensionKind: SuspensionKind | null;
  suspendedUntil: Date | null;
  suspensionNote: string | null;
  eraseAt: Date | null;
  createdAt: Date;
};

const select = {
  id: true,
  username: true,
  email: true,
  status: true,
  suspensionKind: true,
  suspendedUntil: true,
  suspensionNote: true,
  eraseAt: true,
  createdAt: true,
} as const;

export async function loadAccount(id: string): Promise<Account | null> {
  const user = await prisma.user.findUnique({ where: { id }, select });
  if (!user) return null;

  const ended =
    user.status === UserStatus.SUSPENDED &&
    user.suspensionKind === SuspensionKind.TEMPORARY &&
    user.suspendedUntil !== null &&
    user.suspendedUntil <= new Date();
  if (!ended) return user;

  await prisma.user.update({
    where: { id },
    data: {
      status: UserStatus.ACTIVE,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionKind: null,
      suspensionNote: null,
    },
  });
  return { ...user, status: UserStatus.ACTIVE, suspensionKind: null, suspendedUntil: null, suspensionNote: null };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The person asked to delete their own account (PROJECT.md 8c, point 1).
 * Only an ACTIVE account can start it; the check and the change are ONE database statement, so two
 * clicks at once cannot both succeed. Returns the date the data will be erased, or null when the
 * account is not active (suspended, banned or already waiting).
 */
export async function requestDeletion(id: string): Promise<Date | null> {
  const eraseAt = new Date(Date.now() + accountConfig.deletionGraceDays * DAY_MS);
  const result = await prisma.user.updateMany({
    where: { id, status: UserStatus.ACTIVE },
    data: { status: UserStatus.DELETION_PENDING, eraseAt },
  });
  return result.count === 1 ? eraseAt : null;
}

/**
 * Logging in again (or pressing "Keep my account") cancels a pending deletion. Only a
 * DELETION_PENDING account changes: a banned or suspended account is never touched here.
 * Returns true when a deletion was cancelled.
 */
export async function cancelPendingDeletion(id: string): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id, status: UserStatus.DELETION_PENDING },
    data: { status: UserStatus.ACTIVE, eraseAt: null },
  });
  return result.count === 1;
}

/** Whole days from now until `until` (rounded up, never below 0). A plain function, so pages can show "Days left". */
export function daysLeft(until: Date): number {
  return Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY_MS));
}
