// Reply control (SOCIAL_TODO B9), the parts that read or write the database. Rules live in social-reply-control-rules.ts.
//  1. canReplyToPost: may this person reply, given the post's policy? Used by applySocialReply (the server decides) and by
//     the post page (box or notice), so the two always agree.
//  2. applySocialReplyHide: the AUTHOR of a post hides (or shows again) a reply under THEIR post. This is NOT moderation:
//     nothing is removed, the reply stays readable for everybody in a "Hidden replies" part, the reply author is not told,
//     and it can be undone at any time. Site moderation (hide / remove for a rule) is a separate thing (social-reply-review.ts).
// No login check or rate limit here (the actions do them first). `db` can be a transaction.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { factsNeeded, readStoredReplyPolicy, replyAllowed } from "@/lib/social-reply-control-rules";

type Db = Prisma.TransactionClient;

export async function canReplyToPost(
  db: Db,
  input: { viewerId: string; post: { id: number; authorId: string; replyPolicy?: unknown } },
): Promise<boolean> {
  const policy = readStoredReplyPolicy(input.post.replyPolicy);
  const isPostAuthor = input.post.authorId === input.viewerId;
  const need = factsNeeded(policy);
  let authorFollowsReplier = false;
  let replierMentioned = false;
  if (!isPostAuthor && need.follow) {
    const row = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: input.post.authorId, followingId: input.viewerId } },
      select: { followerId: true },
    });
    authorFollowsReplier = row !== null;
  }
  if (!isPostAuthor && need.mention) {
    const row = await db.socialMention.findUnique({
      where: { socialPostId_userId: { socialPostId: input.post.id, userId: input.viewerId } },
      select: { userId: true },
    });
    replierMentioned = row !== null;
  }
  return replyAllowed(policy, { isPostAuthor, authorFollowsReplier, replierMentioned });
}

export type ReplyHideResult = { ok: true; hidden: boolean } | { ok: false; reason: "error" | "notfound" };

/**
 * Hide (`hide: true`) or show again (`hide: false`) a reply. Only the author of the post the reply is under, only a reply that
 * is VISIBLE and not deleted, only while the post itself is VISIBLE and not deleted. Not your own reply (nothing to hide).
 * Doing the same thing twice changes nothing. Anything else is "not found" (it does not say which).
 */
export async function applySocialReplyHide(
  db: Db,
  input: { replyId: number; actorId: string; hide: boolean; now?: Date },
): Promise<ReplyHideResult> {
  if (!Number.isSafeInteger(input.replyId) || input.replyId <= 0 || !input.actorId || typeof input.hide !== "boolean") {
    return { ok: false, reason: "error" };
  }
  const reply = await db.socialReply.findUnique({
    where: { id: input.replyId },
    select: {
      id: true,
      authorId: true,
      status: true,
      deletedAt: true,
      hiddenByAuthorAt: true,
      socialPost: { select: { authorId: true, status: true, deletedAt: true } },
    },
  });
  if (
    !reply ||
    reply.deletedAt !== null ||
    reply.status !== ContentStatus.VISIBLE ||
    reply.socialPost.deletedAt !== null ||
    reply.socialPost.status !== ContentStatus.VISIBLE ||
    reply.socialPost.authorId !== input.actorId ||
    reply.authorId === input.actorId
  ) {
    return { ok: false, reason: "notfound" };
  }
  const isHidden = reply.hiddenByAuthorAt !== null && reply.hiddenByAuthorAt !== undefined;
  if (input.hide === isHidden) return { ok: true, hidden: isHidden }; // already in that state: nothing to change
  await db.socialReply.updateMany({
    where: { id: reply.id, hiddenByAuthorAt: input.hide ? null : { not: null } },
    data: { hiddenByAuthorAt: input.hide ? (input.now ?? new Date()) : null },
  });
  return { ok: true, hidden: input.hide };
}
