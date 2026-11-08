// Bookmarks: the writes (SOCIAL_TODO B2, patch-social-bookmark). The server action calls `applySocialBookmark` inside a
// transaction; a test calls it too, so the rules live in ONE place. Rules (ACCOUNT_RULES.md 3.17):
//  - the person comes from the login cookie (the action does that and the rate limit first);
//  - SAVING needs a post that may be shown (visible, not deleted, author's account shown: same as Like) and that neither
//    person has blocked the other (the same "not found" as everywhere, it never says why). A MUTED person's post can be saved;
//  - a person can save their own posts;
//  - REMOVING a bookmark is always allowed, whatever the state of the post (so a person can always clean the list);
//  - doing the same thing twice changes nothing (no error, no second row);
//  - at most `maxTotal` bookmarks per person: when full, saving another one is refused ("full"), removing always works;
//  - a bookmark is private: no notification, no count for anybody else, never in a shared cache.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { isBlockedEitherWay } from "@/lib/social-block";
import { cleanBookmarkPostId } from "@/lib/social-bookmark-rules";

type Db = Prisma.TransactionClient;

export type SocialBookmarkResult =
  | { ok: true; bookmarked: boolean; changed: boolean }
  | { ok: false; reason: "error" | "notfound" | "full" };

export async function applySocialBookmark(
  db: Db,
  input: { userId: string; postId: unknown; bookmark: unknown },
  maxTotal: number,
): Promise<SocialBookmarkResult> {
  const postId = cleanBookmarkPostId(input.postId);
  if (postId === null || typeof input.bookmark !== "boolean" || !input.userId) return { ok: false, reason: "error" };

  const key = { userId_socialPostId: { userId: input.userId, socialPostId: postId } };
  const existing = await db.socialPostBookmark.findUnique({ where: key, select: { userId: true } });

  if (!input.bookmark) {
    // Always allowed.
    if (existing) await db.socialPostBookmark.delete({ where: key });
    return { ok: true, bookmarked: false, changed: Boolean(existing) };
  }

  const post = await db.socialPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true, status: true, deletedAt: true } });
  if (!post || post.status !== ContentStatus.VISIBLE || post.deletedAt !== null) return { ok: false, reason: "notfound" };
  const author = await db.user.findUnique({ where: { id: post.authorId }, select: { status: true, deletedAt: true } });
  if (!author || !isSocialAuthorShown(author)) return { ok: false, reason: "notfound" };
  if (await isBlockedEitherWay(db, input.userId, post.authorId)) return { ok: false, reason: "notfound" };

  if (existing) return { ok: true, bookmarked: true, changed: false };

  const total = await db.socialPostBookmark.count({ where: { userId: input.userId } });
  if (total >= maxTotal) return { ok: false, reason: "full" };

  await db.socialPostBookmark.create({ data: { userId: input.userId, socialPostId: postId } });
  return { ok: true, bookmarked: true, changed: true };
}

/**
 * Final erasure (ACCOUNT_RULES.md 3.7): deletes every bookmark the person made, and every bookmark that points to one of
 * the person's posts (those posts are erased too). Safe to run twice. Returns how many rows went.
 */
export async function eraseSocialBookmarks(db: Db, userId: string): Promise<number> {
  const result = await db.socialPostBookmark.deleteMany({
    where: { OR: [{ userId }, { socialPost: { authorId: userId } }] },
  });
  return result.count;
}
