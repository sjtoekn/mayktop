// Replies to a Social post (SOCIAL_TODO 18). The server action (social/reply/actions.ts) calls these inside a
// transaction; a test calls them too, so the rules live in ONE place.
//
// Rules:
//  - the person who replies comes from the login cookie (getSessionUser: only an ACTIVE account);
//  - you can only reply to a post that may be shown (visible, not deleted, author's posts shown: the same rule as the
//    feeds, `isSocialAuthorShown`). Anything else is "not found" (it does not say which);
//  - the text is cleaned like a post (`cleanSocialBody`) and is at most `socialReplyConfig.maxBody` characters;
//  - replying to your OWN post is allowed and notifies nobody;
//  - the author of the post gets a `SOCIAL_POST_REPLY` notification, but only ONE unread one per person per post: ten
//    quick replies from one person make one line in the author's notifications, not ten;
//  - a reply is a flat list under the post (oldest first). Replies to replies come later;
//  - deleting your OWN reply: the text is erased for good, `deletedAt` is set, the row stays (like a deleted post).
// Not here: login check and rate limit (the action does them first). Hiding / removing a reply is SOCIAL_TODO 27 (next step):
// the `status` column is already in the table for that.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { socialReplyConfig } from "@/config/site";
import { cleanSocialBody } from "@/lib/social-input";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { isBlockedEitherWay } from "@/lib/social-block";

type Db = Prisma.TransactionClient;

export const REPLY_NOTIFICATION = "SOCIAL_POST_REPLY";

export type CleanReplyResult = { ok: true; body: string } | { ok: false; reason: "type" | "empty" | "long" };

/** The text rules of a reply: the post rules, plus a shorter maximum. */
export function cleanReplyBody(input: unknown): CleanReplyResult {
  const cleaned = cleanSocialBody(input);
  if (!cleaned.ok) return cleaned;
  if (cleaned.body.length > socialReplyConfig.maxBody) return { ok: false, reason: "long" };
  return cleaned;
}

export type ApplyReplyResult =
  | { ok: true; replyId: number; notified: boolean }
  | { ok: false; reason: "error" | "invalid" | "notfound" };

export async function applySocialReply(
  db: Db,
  input: { authorId: string; socialPostId: number; body: unknown },
): Promise<ApplyReplyResult> {
  if (!input.authorId || !Number.isSafeInteger(input.socialPostId) || input.socialPostId <= 0) {
    return { ok: false, reason: "error" };
  }
  const cleaned = cleanReplyBody(input.body);
  if (!cleaned.ok) return { ok: false, reason: cleaned.reason === "type" ? "error" : "invalid" };

  const post = await db.socialPost.findUnique({
    where: { id: input.socialPostId },
    select: { id: true, authorId: true, status: true, deletedAt: true, author: { select: { status: true, deletedAt: true } } },
  });
  if (!post || post.deletedAt !== null || post.status !== ContentStatus.VISIBLE || !isSocialAuthorShown(post.author)) {
    return { ok: false, reason: "notfound" };
  }
  // Block (SOCIAL_TODO A7): neither person may have blocked the other. The same "not found", it never says why.
  if (await isBlockedEitherWay(db, input.authorId, post.authorId)) return { ok: false, reason: "notfound" };

  const reply = await db.socialReply.create({
    data: { socialPostId: post.id, authorId: input.authorId, body: cleaned.body },
    select: { id: true },
  });

  let notified = false;
  if (post.authorId !== input.authorId) {
    const unread = await db.notification.findFirst({
      where: { recipientId: post.authorId, actorId: input.authorId, type: REPLY_NOTIFICATION, socialPostId: post.id, readAt: null },
      select: { id: true },
    });
    if (!unread) {
      await db.notification.create({
        data: { recipientId: post.authorId, actorId: input.authorId, type: REPLY_NOTIFICATION, socialPostId: post.id },
      });
      notified = true;
    }
  }
  return { ok: true, replyId: reply.id, notified };
}

export type ReplyDeleteResult = { ok: true } | { ok: false; reason: "error" | "notfound" };

/** Delete your OWN reply (only while it is visible; a hidden one waits for a reviewer). */
export async function applySocialReplyDelete(
  db: Db,
  input: { id: number; authorId: string; now?: Date },
): Promise<ReplyDeleteResult> {
  if (!Number.isSafeInteger(input.id) || input.id <= 0 || !input.authorId) return { ok: false, reason: "error" };
  const result = await db.socialReply.updateMany({
    where: { id: input.id, authorId: input.authorId, status: ContentStatus.VISIBLE, deletedAt: null },
    data: { body: "", deletedAt: input.now ?? new Date() },
  });
  return result.count === 1 ? { ok: true } : { ok: false, reason: "notfound" };
}
