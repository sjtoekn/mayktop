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
import { COMMUNITY_NOTIFICATIONS } from "@/lib/community-request-rules";
import { crNotificationText } from "@/lib/community-request-text";
import { ANSWER_ACCEPTED_NOTIFICATION } from "@/lib/reputation-rules";
import { formatNumber, t } from "@/i18n";

export const NOTIFICATION_TYPES = [FOLLOW_NOTIFICATION, "SOCIAL_POST_LIKE", "SOCIAL_POST_REPOST", REPLY_NOTIFICATION, MENTION_NOTIFICATION, ...COMMUNITY_NOTIFICATIONS, ANSWER_ACCEPTED_NOTIFICATION] as const;
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
  text?: string; // a ready-made sentence (community decisions); the other types use the translated text of their type
};

type Row = {
  id: number;
  type: string;
  socialPostId: number | null;
  postId: number | null;
  communityRequestId: number | null;
  readAt: Date | null;
  createdAt: Date;
  actor: { username: string; displayName: string | null; status: string; deletedAt: Date | null };
};

async function shownRows(userId: string, unreadOnly: boolean): Promise<Row[]> {
  // Notification settings (SOCIAL_TODO B8): types the person switched off are not shown and not counted (the rows are kept).
  const off = await prisma.notificationOptOut.findMany({ where: { userId }, select: { type: true } });
  const switchableTypes = enabledTypesFrom(off.map((row) => row.type)).filter((type) => (NOTIFICATION_TYPES as readonly string[]).includes(type));
  // The decisions on the person's OWN community request, and "your answer was accepted", have no switch: they are always shown.
  const shownTypes: string[] = [...switchableTypes, ...COMMUNITY_NOTIFICATIONS, ANSWER_ACCEPTED_NOTIFICATION];
  const rows: Row[] = await prisma.notification.findMany({
    where: { recipientId: userId, type: { in: shownTypes }, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: READ_AHEAD,
    select: {
      id: true, type: true, socialPostId: true, postId: true, communityRequestId: true, readAt: true, createdAt: true,
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
  const isCommunityType = (type: string) => (COMMUNITY_NOTIFICATIONS as readonly string[]).includes(type) || type === ANSWER_ACCEPTED_NOTIFICATION;
  return rows.filter(
    (row) =>
      isCommunityType(row.type) || // an admin's decision on the person's own request, or the acceptance of their own answer: not hidden by blocks or mutes
      (isSocialAuthorShown(row.actor) &&
        !hidden.all.has(row.actor.username) &&
        (row.socialPostId === null || shownPosts.has(row.socialPostId))),
  );
}

export async function loadNotifications(userId: string): Promise<NotificationItem[]> {
  const rows = (await shownRows(userId, false)).slice(0, NOTIFICATION_PAGE_SIZE);
  // Community decisions: the sentence is built from the request (name, address, note), read once for the whole page.
  const requestIds = [...new Set(rows.flatMap((row) => (row.communityRequestId === null ? [] : [row.communityRequestId])))];
  const requests = new Map(
    (requestIds.length
      ? await prisma.communityRequest.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, name: true, slug: true, decisionNote: true },
        })
      : []
    ).map((request) => [request.id, request]),
  );
  // "Your answer was accepted": if a bounty was paid for it, the sentence says how much. Read once for the whole page.
  const answerPostIds = [...new Set(rows.flatMap((row) => (row.type === ANSWER_ACCEPTED_NOTIFICATION && row.postId !== null ? [row.postId] : [])))];
  const paid = new Map(
    (answerPostIds.length
      ? await prisma.bounty.findMany({ where: { postId: { in: answerPostIds }, status: "AWARDED", awardedToId: userId }, select: { postId: true, amount: true } })
      : []
    ).map((bounty) => [bounty.postId, bounty.amount]),
  );
  return rows.flatMap((row): NotificationItem[] => {
    const base = {
      id: row.id,
      type: row.type as NotificationItem["type"],
      actor: row.actor.username,
      actorName: row.actor.displayName?.trim() || row.actor.username,
      time: timeAgo(row.createdAt),
      unread: row.readAt === null,
    };
    if ((COMMUNITY_NOTIFICATIONS as readonly string[]).includes(row.type)) {
      const request = row.communityRequestId === null ? undefined : requests.get(row.communityRequestId);
      if (!request) return [];
      const approved = row.type === "COMMUNITY_APPROVED";
      return [{
        ...base,
        text: crNotificationText(approved, request.name, request.slug, request.decisionNote),
        href: approved ? `/c/${request.slug}` : "/communities/new",
      }];
    }
    if (row.type === ANSWER_ACCEPTED_NOTIFICATION) {
      if (row.postId === null) return [];
      const amount = paid.get(row.postId);
      return [{
        ...base,
        text: amount !== undefined
          ? t("notifications.type.bountyAwarded", { name: base.actorName, amount: formatNumber(amount) })
          : t("notifications.type.answerAccepted", { name: base.actorName }),
        href: `/post/${row.postId}`,
      }];
    }
    return [{ ...base, href: row.socialPostId !== null ? `/social/${row.socialPostId}` : `/u/${row.actor.username}` }];
  });
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
