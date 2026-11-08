// "Download my data", social part (SOCIAL_TODO 6). Used by src/app/(site)/settings/export/route.ts.
// What the person gets: their own social posts (also hidden / removed / deleted ones, with status), the
// posts they liked and reposted (post numbers only), who they follow (usernames), how many follow them,
// and the notifications they received. Never included: the TEXT of other people's posts, other people's emails.
import type { Prisma } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient; // the normal `prisma` client can be passed too

export async function getSocialExport(db: Db, userId: string) {
  const [posts, likes, reposts, following, followersCount, notifications, replies, blocks, mutes, bookmarks, pinned, optOuts, replyLikes] = await Promise.all([
    db.socialPost.findMany({
      where: { authorId: userId },
      orderBy: { id: "asc" },
      select: { id: true, body: true, mediaUrl: true, status: true, replyPolicy: true, createdAt: true, editedAt: true, deletedAt: true },
    }),
    db.socialPostLike.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { socialPostId: true, createdAt: true },
    }),
    db.socialRepost.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: { socialPostId: true, quoteText: true, createdAt: true },
    }),
    db.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, following: { select: { username: true } } },
    }),
    db.follow.count({ where: { followingId: userId } }),
    db.notification.findMany({
      where: { recipientId: userId },
      orderBy: { id: "asc" },
      select: { type: true, socialPostId: true, postId: true, readAt: true, createdAt: true, actor: { select: { username: true } } },
    }),
    db.socialReply.findMany({
      where: { authorId: userId },
      orderBy: { id: "asc" },
      select: { id: true, socialPostId: true, body: true, status: true, createdAt: true, deletedAt: true },
    }),
    // Block and Mute (SOCIAL_TODO A7): only the lists the person made, never who blocked or muted THEM.
    db.socialBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, blocked: { select: { username: true } } },
    }),
    db.socialMute.findMany({
      where: { muterId: userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, muted: { select: { username: true } } },
    }),
    // Bookmarks (SOCIAL_TODO B2): only the post numbers the person saved, and when. Never who saved THEIR posts.
    db.socialPostBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { socialPostId: true, createdAt: true },
    }),
    // Pinned post (SOCIAL_TODO B6): the number of the person's own pinned post, and when it was pinned.
    db.socialPinnedPost.findUnique({
      where: { userId },
      select: { socialPostId: true, createdAt: true },
    }),
    // Notification settings (SOCIAL_TODO B8): the types the person switched off.
    db.notificationOptOut.findMany({ where: { userId }, orderBy: { type: "asc" }, select: { type: true } }),
    // Likes on replies (SOCIAL_TODO B10): only the reply numbers the person liked, and when.
    db.socialReplyLike.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { socialReplyId: true, createdAt: true } }),
  ]);

  return {
    posts,
    likes,
    reposts,
    following: following.map((f) => ({ username: f.following.username, since: f.createdAt })),
    followersCount,
    replies,
    blocked: blocks.map((b) => ({ username: b.blocked.username, since: b.createdAt })),
    muted: mutes.map((m) => ({ username: m.muted.username, since: m.createdAt })),
    bookmarks: bookmarks.map((b) => ({ socialPostId: b.socialPostId, since: b.createdAt })),
    notificationsOff: optOuts.map((row) => row.type),
    replyLikes: replyLikes.map((l) => ({ socialReplyId: l.socialReplyId, since: l.createdAt })),
    pinnedPost: pinned ? { socialPostId: pinned.socialPostId, since: pinned.createdAt } : null,
    notifications: notifications.map(({ actor, ...n }) => ({ ...n, from: actor.username })),
  };
}
