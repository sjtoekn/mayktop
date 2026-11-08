// The replies under one Social post (SOCIAL_TODO 18): visible, not deleted, written by an account whose posts may be
// shown (the same rules as the feeds), oldest first. Only called for a logged-in person on a post that is shown.
// Cached like the feeds (tag "social-posts"): a new, deleted, hidden, shown-again or liked reply calls updateTag("social-posts").
// `hiddenByAuthor` and the like counts are the same for every viewer (they hold no personal data), so they can live in this shared cache.
// Fair ranking (SOCIAL_TODO B10): each reply also carries what the "Top" order needs (likes, the author's account age and post count).
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { timeAgo } from "@/lib/queries";
import { socialReplyConfig } from "@/config/site";
import { socialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/client";

export type SocialReplyItem = {
  id: number;
  author: string;
  displayName: string | null;
  body: string;
  time: string;
  /** The author of the post hid this reply (SOCIAL_TODO B9). Not removed: it is shown in a separate "Hidden replies" part. */
  hiddenByAuthor: boolean;
  /** For the fair "Top" order (SOCIAL_TODO B10). */
  createdAtMs: number;
  likes: number;
  authorCreatedAtMs: number;
  authorPosts: number;
};

export async function getSocialReplies(socialPostId: number): Promise<SocialReplyItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("social-posts");

  const rows = await prisma.socialReply.findMany({
    where: { socialPostId, status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: socialReplyConfig.listSize,
    select: {
      id: true,
      body: true,
      createdAt: true,
      hiddenByAuthorAt: true,
      _count: { select: { likes: true } },
      author: {
        select: {
          username: true,
          displayName: true,
          createdAt: true,
          _count: { select: { socialPosts: { where: { status: ContentStatus.VISIBLE, deletedAt: null } } } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    author: row.author.username,
    displayName: row.author.displayName,
    body: row.body,
    time: timeAgo(row.createdAt),
    hiddenByAuthor: row.hiddenByAuthorAt !== null,
    createdAtMs: row.createdAt.getTime(),
    likes: row._count.likes,
    authorCreatedAtMs: row.author.createdAt.getTime(),
    authorPosts: row.author._count.socialPosts,
  }));
}
