// FINAL ERASURE, social part (SOCIAL_TODO 5). Called from eraseAccount() in purge.ts, inside the SAME transaction.
//
// The User row is never deleted (it becomes an anonymous shell), so the `onDelete: Restrict` links on the social
// tables can NOT make an erasure fail. What DID go wrong without this file: the text of the person's social posts
// stayed in the database. Rules (same as for community posts, ACCOUNT_RULES.md 3.1 / 3.7):
//   - social posts: text and picture link erased, `deletedAt` set, the row stays (replies, counts, audit log keep working);
//   - quote reposts: the quote text is erased, the repost row stays (anonymous);
//   - likes: kept, anonymous (same as votes: totals stay);
//   - follows (both directions) and notifications (received AND caused by the person): deleted;
//   - safety record (banned / reported / legal hold only): hidden or removed social posts are copied into it BEFORE the erasure.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/client";
import { eraseSocialTags } from "./social-tag-sync";
import { eraseSocialBlocks } from "./social-block";
import { eraseSocialBookmarks } from "./social-bookmark";
import { eraseSocialPins } from "./social-pin";
import { eraseNotificationSettings } from "./notification-settings";

type Db = Prisma.TransactionClient;

/** Non-visible (hidden / removed) social posts that are about to be erased: for the safety record only. */
export async function socialPostsForRecord(db: Db, userId: string) {
  return db.socialPost.findMany({
    where: { authorId: userId, deletedAt: null, status: { not: ContentStatus.VISIBLE } },
    orderBy: { id: "asc" },
    select: { id: true, body: true, mediaUrl: true, status: true, createdAt: true, editedAt: true },
  });
}

export type SocialErased = { posts: number; replies: number; reposts: number; follows: number; notifications: number };

/** Erase the social data of one person. Safe to run twice. */
export async function eraseSocial(db: Db, userId: string, now: Date): Promise<SocialErased> {
  const posts = await db.socialPost.updateMany({
    where: { authorId: userId, deletedAt: null },
    data: { body: "", mediaUrl: null, deletedAt: now },
  });
  // The earlier versions of those posts go too (SOCIAL_TODO item 6): the text is erased for good, in every version.
  await db.socialPostEdit.deleteMany({ where: { socialPost: { authorId: userId } } });
  const replies = await db.socialReply.updateMany({
    where: { authorId: userId, deletedAt: null },
    data: { body: "", deletedAt: now },
  });
  const reposts = await db.socialRepost.updateMany({
    where: { userId, quoteText: { not: null } },
    data: { quoteText: null },
  });
  const follows = await db.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } });
  const notifications = await db.notification.deleteMany({ where: { OR: [{ recipientId: userId }, { actorId: userId }] } });
  await eraseSocialTags(db, userId); // hashtags and mentions (SOCIAL_TODO 6)
  await eraseSocialBlocks(db, userId); // blocks and mutes made or received (SOCIAL_TODO A7)
  await eraseSocialBookmarks(db, userId); // bookmarks made, and bookmarks of the person's posts (SOCIAL_TODO B2)
  await eraseSocialPins(db, userId); // the pinned post (SOCIAL_TODO B6)
  await eraseNotificationSettings(db, userId); // the switched-off notification types (SOCIAL_TODO B8)
  return { posts: posts.count, replies: replies.count, reposts: reposts.count, follows: follows.count, notifications: notifications.count };
}

/**
 * The picture addresses of ALL the social posts of a person, read BEFORE `eraseSocial` clears them, so purge.ts can delete the
 * files from disk after the commit (patch-social-images). Pictures of posts that go into the safety record are deleted too:
 * the record keeps the text, not the picture (open question for the lawyer, ACCOUNT_RULES.md 3.15).
 */
export async function socialPictureFiles(db: Db, userId: string): Promise<string[]> {
  const rows = await db.socialPost.findMany({ where: { authorId: userId, mediaUrl: { not: null } }, select: { mediaUrl: true } });
  return rows.flatMap((row) => (row.mediaUrl ? [row.mediaUrl] : []));
}
