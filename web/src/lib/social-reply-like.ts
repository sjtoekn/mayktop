// Like on a reply (SOCIAL_TODO B10): the database part. No login check or rate limit here (the action does them first). `db` can be a transaction.
// A reply can be liked while the reply is VISIBLE and not deleted, its post is VISIBLE and not deleted, both accounts may be shown, and
// neither the reply's author nor the post's author blocked you or was blocked by you. Taking a like back is always allowed.
// No notification is made (a like on a reply is a quiet signal for the order). Likes by the reply's own author are allowed, as on X.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isBlockedEitherWay } from "@/lib/social-block";
import { socialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export type ReplyLikeResult = { ok: true; liked: boolean; likes: number } | { ok: false };

export async function applySocialReplyLike(db: Db, input: { replyId: number; userId: string; like: boolean }): Promise<ReplyLikeResult> {
  if (!Number.isSafeInteger(input.replyId) || input.replyId <= 0 || !input.userId || typeof input.like !== "boolean") return { ok: false };
  const reply = await db.socialReply.findFirst({
    where: {
      id: input.replyId,
      status: ContentStatus.VISIBLE,
      deletedAt: null,
      author: socialAuthorShown,
      socialPost: { status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
    },
    select: { id: true, authorId: true, socialPost: { select: { authorId: true } } },
  });
  if (!reply) return { ok: false };
  if (input.like) {
    if (await isBlockedEitherWay(db, input.userId, reply.authorId)) return { ok: false };
    if (await isBlockedEitherWay(db, input.userId, reply.socialPost.authorId)) return { ok: false };
  }
  const key = { userId_socialReplyId: { userId: input.userId, socialReplyId: input.replyId } };
  const existing = await db.socialReplyLike.findUnique({ where: key, select: { userId: true } });
  if (input.like && !existing) await db.socialReplyLike.create({ data: { userId: input.userId, socialReplyId: input.replyId } });
  if (!input.like && existing) await db.socialReplyLike.delete({ where: key });
  const likes = await db.socialReplyLike.count({ where: { socialReplyId: input.replyId } });
  return { ok: true, liked: input.like ? true : false, likes };
}
