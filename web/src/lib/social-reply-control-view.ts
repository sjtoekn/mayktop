// Reply control (SOCIAL_TODO B9): what the post PAGE needs to know. Read per request (it depends on who is looking), never cached.
import { prisma } from "@/lib/prisma";
import { canReplyToPost } from "@/lib/social-reply-control";
import { readStoredReplyPolicy, type ReplyPolicy } from "@/lib/social-reply-control-rules";

export type ReplyAccess = { policy: ReplyPolicy; canReply: boolean };

/** The policy of a post and whether the viewer may reply. A post that cannot be read gives the strictest answer (no box). */
export async function getReplyAccess(viewerId: string, socialPostId: number): Promise<ReplyAccess> {
  const post = await prisma.socialPost.findUnique({
    where: { id: socialPostId },
    select: { id: true, authorId: true, replyPolicy: true },
  });
  if (!post) return { policy: "MENTIONED", canReply: false };
  const canReply = await canReplyToPost(prisma, { viewerId, post });
  return { policy: readStoredReplyPolicy(post.replyPolicy), canReply };
}
