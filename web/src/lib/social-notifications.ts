// The notifications of one person (SOCIAL_TODO 21): the list for /notifications, the unread count for the bell, and
// "mark all as read". Notifications are created elsewhere (follow, like, repost, reply); this file only READS them,
// and marks them read.
// What is NOT shown (decided with the post rules, SOCIAL_TODO 7 / 13 / 27):
//  - a notification about a post that is no longer shown (deleted, hidden, removed, or its author's posts are not
//    shown) disappears with the post and comes back if the post is restored (the row is kept);
//  - a notification from a person whose account is not shown (deletion pending / erased);
//  - types this page does not know yet.
// It never reads other people's data beyond a username, and only the logged-in person's own rows.
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/queries";
import { isSocialAuthorShown, socialAuthorShown } from "@/lib/social-visibility";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { FOLLOW_NOTIFICATION } from "@/lib/social-follow";
import { REPLY_NOTIFICATION } from "@/lib/social-reply";
import { MENTION_NOTIFICATION } from "@/lib/social-tag-sync";
import { ContentStatus } from "../../generated/prisma/client";
import { enabledTypesFrom } from "@/lib/notification-settings-rules";

export const NOTIFICATION_TYPES = [FOLLOW_NOTIFICATION, "SOCIAL_POST_LIKE", "SOCIAL_POST_REPOST", REPLY_NOTIFICATION, MENTION_NOTIFICATION] as const;
export const NOTIFICATION_PAGE_SIZE = 50;
const READ_AHEAD = 150; // rows read before the "not shown" ones are dropped

export type NotificationItem = {
  id: number;
  type: (typeof NOTIFICATION_TYPES)[number];
  actor: string; // username
  actorName: string; // display name, or the username
  time: string;
  unread: boolean;
  href: string; // where it leads: the post, or the person for a follow
};

type Row = {
  id: number;
  type: string;
  socialPostId: number | null;
  readAt: Date | null;
  createdAt: Date;
  actor: { username: string; displayName: string | null; status: string; deletedAt: Date | null };
};

async function shownRows(userId: string, unreadOnly: boolean): Promise<Row[]> {
  // Notification settings (SOCIAL_TODO B8): types the person switched off are not shown and not counted (the rows are kept).
  const off = await prisma.notificationOptOut.findMany({ where: { userId }, select: { type: true } });
  const shownTypes = enabledTypesFrom(off.map((row) => row.type)).filter((type) => (NOTIFICATION_TYPES as readonly string[]).includes(type));
  if (shownTypes.length === 0) return [];
  const rows: Row[] = await prisma.notification.findMany({
    where: { recipientId: userId, type: { in: shownTypes }, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: READ_AHEAD,
    select: {
      id: true, type: true, socialPostId: true, readAt: true, createdAt: true,
      actor: { select: { username: true, displayName: true, status: true, deletedAt: true } },
    },
  });
  const postIds = [...new Set(rows.flatMap((row) => (row.socialPostId === null ? [] : [row.socialPostId])))];
  // The same rule as the feeds (queries.ts socialFeedWhere): keep these two equal.
  const shownPosts = postIds.length
    ? new Set(
        (
          await prisma.socialPost.findMany({
            where: { id: { in: postIds }, status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
            select: { id: true },
          })
        ).map((post) => post.id),
      )
    : new Set<number>();
  // Block and Mute (SOCIAL_TODO A7): nothing from a person the reader blocked, who blocked the reader, or whom the reader muted.
  const hidden = await loadHiddenAuthors(userId);
  return rows.filter(
    (row) =>
      isSocialAuthorShown(row.actor) &&
      !hidden.all.has(row.actor.username) &&
      (row.socialPostId === null || shownPosts.has(row.socialPostId)),
  );
}

export async function loadNotifications(userId: string): Promise<NotificationItem[]> {
  const rows = await shownRows(userId, false);
  return rows.slice(0, NOTIFICATION_PAGE_SIZE).map((row) => ({
    id: row.id,
    type: row.type as NotificationItem["type"],
    actor: row.actor.username,
    actorName: row.actor.displayName?.trim() || row.actor.username,
    time: timeAgo(row.createdAt),
    unread: row.readAt === null,
    href: row.socialPostId !== null ? `/social/${row.socialPostId}` : `/u/${row.actor.username}`,
  }));
}

/** Unread notifications that are shown (so the bell and the list always agree). Counts up to the read-ahead size. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  return (await shownRows(userId, true)).length;
}

/** Mark every unread notification of this person as read. Returns how many rows changed. */
export async function markAllNotificationsReadFor(userId: string, now: Date = new Date()): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: now },
  });
  return result.count;
}
