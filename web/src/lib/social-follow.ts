// Follow / unfollow a person (SOCIAL_TODO 15). The server action calls applySocialFollow() inside a transaction;
// a test calls it too, so the rules live in ONE place.
//
// Rules (ACCOUNT_RULES.md 3.9):
//  - the person who follows comes from the login cookie (getSessionUser: only an ACTIVE account, so a suspended /
//    banned / deleting person cannot follow or unfollow anybody: every write is refused);
//  - nobody follows themselves;
//  - FOLLOW needs a target whose posts may be shown (`isSocialAuthorShown`: ACTIVE or SUSPENDED / banned, not
//    DELETION_PENDING, not DELETED). An unknown or hidden target is "not found" (it does not say which);
//  - UNFOLLOW is always allowed, whatever the state of the other account: it is the person's own choice and data;
//  - following twice, or unfollowing someone you do not follow, changes nothing (no error, no second row);
//  - the person followed gets ONE `FOLLOW` notification per follower, ever: follow -> unfollow -> follow again (or a
//    script doing it in a loop) can never fill someone's notifications;
//  - nobody is told when somebody unfollows them.
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { isBlockedEitherWay } from "@/lib/social-block";

type Db = Prisma.TransactionClient;

export const FOLLOW_NOTIFICATION = "FOLLOW";
export const MAX_USERNAME_LENGTH = 64;

export type SocialFollowResult =
  | { ok: true; following: boolean; followers: number; changed: boolean; notified: boolean }
  | { ok: false; reason: "error" | "notfound" | "self" };

/** Usernames are saved in lower case; accept a little noise from the browser, refuse everything else. */
export function cleanFollowUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase();
  return name.length > 0 && name.length <= MAX_USERNAME_LENGTH ? name : null;
}

export async function applySocialFollow(
  db: Db,
  input: { followerId: string; username: unknown; follow: unknown },
): Promise<SocialFollowResult> {
  const username = cleanFollowUsername(input.username);
  if (username === null || typeof input.follow !== "boolean" || !input.followerId) return { ok: false, reason: "error" };

  const target = await db.user.findFirst({
    where: { username },
    select: { id: true, status: true, deletedAt: true },
  });
  if (!target) return { ok: false, reason: "notfound" };
  if (target.id === input.followerId) return { ok: false, reason: "self" };

  const key = { followerId_followingId: { followerId: input.followerId, followingId: target.id } };
  const existing = await db.follow.findUnique({ where: key, select: { followerId: true } });

  let changed = false;
  let notified = false;

  if (input.follow) {
    if (!existing) {
      if (!isSocialAuthorShown(target)) return { ok: false, reason: "notfound" };
      // Block (SOCIAL_TODO A7): either person blocked the other. The same "not found", it never says why.
      if (await isBlockedEitherWay(db, input.followerId, target.id)) return { ok: false, reason: "notfound" };
      await db.follow.create({ data: { followerId: input.followerId, followingId: target.id } });
      changed = true;

      const earlier = await db.notification.findFirst({
        where: { recipientId: target.id, actorId: input.followerId, type: FOLLOW_NOTIFICATION },
        select: { id: true },
      });
      if (!earlier) {
        await db.notification.create({
          data: { recipientId: target.id, actorId: input.followerId, type: FOLLOW_NOTIFICATION },
        });
        notified = true;
      }
    }
  } else if (existing) {
    await db.follow.delete({ where: key });
    changed = true;
  }

  const followers = await db.follow.count({ where: { followingId: target.id } });
  return { ok: true, following: input.follow, followers, changed, notified };
}
