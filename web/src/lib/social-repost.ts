// Repost / quote repost / undo (SOCIAL_TODO 16). The server action calls applySocialRepost() inside a transaction;
// a test calls it too, so the rules live in ONE place.
//
// Rules (PROJECT.md 8j.12, ACCOUNT_RULES.md 3.10):
//  - the person comes from the login cookie (getSessionUser: only an ACTIVE account, so a suspended / banned /
//    deleting person cannot repost or undo anything);
//  - ONE row per person per post (the database key): a plain repost OR a quote repost, never both. Quoting a post you
//    already reposted turns that row into a quote (the text is replaced); it is not a second repost;
//  - reposting your OWN post is allowed (owner's decision 2026-11-07); you are not notified about it;
//  - a repost or quote needs a post that may be shown (visible, not deleted, author's posts shown: the same rule as the
//    feeds). A post that is missing or may not be shown is "not found" (it does not say which);
//  - UNDO is always allowed, whatever the state of the post: it is the person's own choice and data;
//  - reposting twice, or undoing something you never reposted, changes nothing (no error, no second row);
//  - the author gets ONE `SOCIAL_POST_REPOST` notification per person per post, EVER: repost -> undo -> repost again
//    (or turning a repost into a quote) never adds another one; nobody is told about an undo;
//  - the quote text is cleaned like a post (`cleanSocialBody`: at most 5,000 characters, no control / bidi-override
//    characters, not empty).
// Not here: login check and rate limit (the action does them first).
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { cleanSocialBody } from "@/lib/social-input";
import { isBlockedEitherWay } from "@/lib/social-block";

type Db = Prisma.TransactionClient;

export const REPOST_NOTIFICATION = "SOCIAL_POST_REPOST";
export const REPOST_ACTIONS = ["repost", "quote", "undo"] as const;
export type RepostAction = (typeof REPOST_ACTIONS)[number];

export type SocialRepostResult =
  | { ok: true; reposted: boolean; quoted: boolean; reposts: number; changed: boolean; notified: boolean }
  | { ok: false; reason: "error" | "notfound" | "invalid" };

export async function applySocialRepost(
  db: Db,
  input: { userId: string; socialPostId: unknown; action: unknown; quote?: unknown },
): Promise<SocialRepostResult> {
  const socialPostId = input.socialPostId;
  if (typeof socialPostId !== "number" || !Number.isSafeInteger(socialPostId) || socialPostId <= 0) {
    return { ok: false, reason: "error" };
  }
  if (!input.userId || !(REPOST_ACTIONS as readonly unknown[]).includes(input.action)) {
    return { ok: false, reason: "error" };
  }
  const action = input.action as RepostAction;

  let quoteText: string | null = null;
  if (action === "quote") {
    const cleaned = cleanSocialBody(input.quote);
    if (!cleaned.ok) return { ok: false, reason: "invalid" };
    quoteText = cleaned.body;
  }

  const key = { userId_socialPostId: { userId: input.userId, socialPostId } };
  const existing = await db.socialRepost.findUnique({ where: key, select: { id: true, quoteText: true } });

  let changed = false;
  let notified = false;

  if (action === "undo") {
    if (existing) {
      await db.socialRepost.delete({ where: key });
      changed = true;
    }
  } else {
    // Repost: when you already reposted, nothing to check or change. Quote: the post must be shown every time.
    if (action === "quote" || !existing) {
      const post = await db.socialPost.findFirst({
        where: { id: socialPostId },
        select: { id: true, authorId: true, status: true, deletedAt: true, author: { select: { status: true, deletedAt: true } } },
      });
      if (!post || post.status !== ContentStatus.VISIBLE || post.deletedAt !== null || !isSocialAuthorShown(post.author)) {
        return { ok: false, reason: "notfound" };
      }

      // Block (SOCIAL_TODO A7): neither person may have blocked the other (repost and quote). Undo is always allowed.
      if (await isBlockedEitherWay(db, input.userId, post.authorId)) return { ok: false, reason: "notfound" };

      if (!existing) {
        await db.socialRepost.create({ data: { userId: input.userId, socialPostId, quoteText } });
        changed = true;

        if (post.authorId !== input.userId) {
          const earlier = await db.notification.findFirst({
            where: { recipientId: post.authorId, actorId: input.userId, type: REPOST_NOTIFICATION, socialPostId },
            select: { id: true },
          });
          if (!earlier) {
            await db.notification.create({
              data: { recipientId: post.authorId, actorId: input.userId, type: REPOST_NOTIFICATION, socialPostId },
            });
            notified = true;
          }
        }
      } else if (existing.quoteText !== quoteText) {
        await db.socialRepost.update({ where: key, data: { quoteText } });
        changed = true;
      }
    }
  }

  const reposted = action !== "undo";
  // A plain "repost" on a post you already quoted keeps the quote; a new plain repost is not a quote.
  const quoted = action === "quote" || (action === "repost" && Boolean(existing?.quoteText));
  const reposts = await db.socialRepost.count({ where: { socialPostId } });
  return { ok: true, reposted, quoted, reposts, changed, notified };
}
