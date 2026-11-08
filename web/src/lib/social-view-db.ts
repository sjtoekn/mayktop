// The database part of the view count (SOCIAL_TODO B5, patch-social-views). Adds 1 to the total of ONE post.
// Only a post that may be shown (visible, not deleted, author shown: the same rules as the feeds, src/lib/social-visibility.ts)
// and never the author's own post. Nothing about the viewer is saved. The rules around it are in src/lib/social-views.ts.
import { prisma } from "@/lib/prisma";
import { socialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants

/** True when the total was raised (the post exists, may be shown and is not the viewer's own). */
export async function addSocialView(postId: number, viewerId: string): Promise<boolean> {
  const result = await prisma.socialPost.updateMany({
    where: {
      id: postId,
      status: ContentStatus.VISIBLE,
      deletedAt: null,
      authorId: { not: viewerId },
      author: socialAuthorShown,
    },
    data: { viewCount: { increment: 1 } }, // one atomic UPDATE: two views at the same moment are both counted
  });
  return result.count > 0;
}
