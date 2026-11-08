// The replies under one Social post (SOCIAL_TODO 18): visible, not deleted, written by an account whose posts may be
// shown (the same rules as the feeds), oldest first. Only called for a logged-in person on a post that is shown.
// Cached like the feeds (tag "social-posts"): a new or deleted reply calls updateTag("social-posts").
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
};

export async function getSocialReplies(socialPostId: number): Promise<SocialReplyItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("social-posts");

  const rows = await prisma.socialReply.findMany({
    where: { socialPostId, status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: socialReplyConfig.listSize,
    select: { id: true, body: true, createdAt: true, author: { select: { username: true, displayName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    author: row.author.username,
    displayName: row.author.displayName,
    body: row.body,
    time: timeAgo(row.createdAt),
  }));
}
