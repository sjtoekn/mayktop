// Pin a post to your profile: the writes (SOCIAL_TODO B6, patch-social-pin). The server action calls `applySocialPin` inside a
// transaction; a test calls it too, so the rules live in ONE place. Rules (ACCOUNT_RULES.md 3.18):
//  - the person comes from the login cookie (the action does that and the rate limit first);
//  - ONE pinned post per person (`userId` is the table key). Pinning another post REPLACES the old pin, no error;
//  - only YOUR OWN post can be pinned, and only while it is visible and not deleted (anything else: the same "not found");
//  - UNPINNING is always allowed, whatever the state of the post;
//  - doing the same thing twice changes nothing;
//  - a pin is public (it is on the profile), so it is shown only while the post may be shown (feeds' rules, queries.ts).
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isSocialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export type SocialPinResult =
  | { ok: true; pinned: boolean; changed: boolean }
  | { ok: false; reason: "error" | "notfound" };

/** A post number from the browser: a whole number of 1 or more, or null. */
export function cleanPinPostId(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
}

export async function applySocialPin(
  db: Db,
  input: { userId: string; postId: unknown; pin: unknown },
): Promise<SocialPinResult> {
  const postId = cleanPinPostId(input.postId);
  if (postId === null || typeof input.pin !== "boolean" || !input.userId) return { ok: false, reason: "error" };

  const current = await db.socialPinnedPost.findUnique({ where: { userId: input.userId }, select: { socialPostId: true } });

  if (!input.pin) {
    // Always allowed. Only removes the pin if it is THIS post (a stale tab must not remove a newer pin).
    if (current && current.socialPostId === postId) {
      await db.socialPinnedPost.delete({ where: { userId: input.userId } });
      return { ok: true, pinned: false, changed: true };
    }
    return { ok: true, pinned: false, changed: false };
  }

  const post = await db.socialPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true, status: true, deletedAt: true } });
  if (!post || post.authorId !== input.userId || post.status !== ContentStatus.VISIBLE || post.deletedAt !== null) {
    return { ok: false, reason: "notfound" };
  }
  const author = await db.user.findUnique({ where: { id: input.userId }, select: { status: true, deletedAt: true } });
  if (!author || !isSocialAuthorShown(author)) return { ok: false, reason: "notfound" };

  if (current && current.socialPostId === postId) return { ok: true, pinned: true, changed: false };

  await db.socialPinnedPost.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, socialPostId: postId },
    update: { socialPostId: postId, createdAt: new Date() },
  });
  return { ok: true, pinned: true, changed: true };
}

/** When the author deletes the post, its pin goes too (a deleted post is never shown again). Safe to run twice. */
export async function removeSocialPinOfPost(db: Db, postId: number): Promise<number> {
  const result = await db.socialPinnedPost.deleteMany({ where: { socialPostId: postId } });
  return result.count;
}

/** Final erasure (ACCOUNT_RULES.md 3.7): the person's pin, and any pin that points to one of the person's posts. Safe to run twice. */
export async function eraseSocialPins(db: Db, userId: string): Promise<number> {
  const result = await db.socialPinnedPost.deleteMany({
    where: { OR: [{ userId }, { socialPost: { authorId: userId } }] },
  });
  return result.count;
}
