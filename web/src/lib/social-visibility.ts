// Whose social posts may be shown (SOCIAL_TODO 7, ACCOUNT_RULES.md 3.8). ONE place, used by the feed, by Like and
// by Follow (SOCIAL_TODO 15).
// Decision 2026-11-07: a staff action on an ACCOUNT (suspend, ban) never hides the person's posts by itself:
// hiding a post needs a site rule number and a written reason (moderation, SOCIAL_TODO 27), the same as community
// posts. Only these are not shown: the posts of a person who asked to delete the account (DELETION_PENDING: they
// come back if the person keeps the account) and of an erased account (DELETED).
import type { Prisma } from "../../generated/prisma/client";
import { UserStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded

/** Account states whose Social posts are shown (and whose account can be followed). */
export const socialShownStatuses = [UserStatus.ACTIVE, UserStatus.SUSPENDED] as const;

/** Prisma `where` for the author of a social post that may be shown. */
export const socialAuthorShown: Prisma.UserWhereInput = {
  status: { in: [...socialShownStatuses] },
  deletedAt: null,
};

/** The same rule for an account you already loaded (used by Follow and by tests). Keep it equal to `socialAuthorShown`. */
export function isSocialAuthorShown(user: { status: string; deletedAt: Date | null }): boolean {
  return user.deletedAt === null && (socialShownStatuses as readonly string[]).includes(user.status);
}
