"use server";

// Reply to a Social post, delete your own reply (SOCIAL_TODO 18), and hide / show again a reply under YOUR post (SOCIAL_TODO B9).
//  1. The text is checked and cleaned on the server (src/lib/social-reply.ts). Nobody logged in: refused with login: true.
//  2. Rate limit (socialReplyConfig.limits in src/config/site.ts): counted from the person's earlier replies in the
//     database, in the same transaction as the save, so it survives a restart and is right with several servers.
//     Deleted replies count too, so deleting does not give a new turn.
//  3. The rules (a post that may be shown, own post allowed, one unread notification per person per post) are in
//     src/lib/social-reply.ts. The browser is not trusted: the person comes from the login cookie only.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialDuplicate, socialReplyConfig, socialReplyControl } from "@/config/site";
import { checkRules, type RateRule } from "@/lib/social-limits";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { isRepeat } from "@/lib/social-duplicate";
import { applySocialReply, applySocialReplyDelete, cleanReplyBody } from "@/lib/social-reply";
import { applySocialReplyHide } from "@/lib/social-reply-control";

const replyRules: RateRule[] = socialReplyConfig.limits.map((rule) => ({ max: rule.max, windowMs: rule.windowMinutes * 60_000 }));
const LONGEST_WINDOW_MS = Math.max(...replyRules.map((rule) => rule.windowMs), socialDuplicate.windowHours * 3_600_000);

export type CreateSocialReplyResult =
  | { ok: true }
  | { error: true; login?: true; invalid?: true; restricted?: true; tooMany?: true; waitMinutes?: number; duplicate?: true };

export async function createSocialReply(input: { postId: number; body: string }): Promise<CreateSocialReplyResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  const { postId, body } = input;
  if (!Number.isSafeInteger(postId) || postId <= 0) return { error: true };
  const cleaned = cleanReplyBody(body);
  if (!cleaned.ok) return cleaned.reason === "type" ? { error: true } : { error: true, invalid: true };

  const author = await getSessionUser();
  if (!author) return { error: true, login: true };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const earlier = await tx.socialReply.findMany({
        where: { authorId: author.id, createdAt: { gte: new Date(now - LONGEST_WINDOW_MS) } },
        select: { createdAt: true, body: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), limitsFor(replyRules, author), now);
      if (!rate.ok) return { rate, result: null, duplicate: false };
      // The same reply text again, under any post (SOCIAL_TODO C2): this person's replies of the last `windowHours`; deleted replies have no text.
      const sameSince = now - socialDuplicate.windowHours * 3_600_000;
      const recentBodies = earlier.filter((row) => row.createdAt.getTime() >= sameSince).map((row) => row.body);
      if (isRepeat(cleaned.body, recentBodies, socialDuplicate.minChars)) return { rate, result: null, duplicate: true };
      const result = await applySocialReply(tx, { authorId: author.id, socialPostId: postId, body: cleaned.body });
      return { rate, result, duplicate: false };
    });

    if (outcome.duplicate) return { error: true, duplicate: true };
    if (!outcome.rate.ok) {
      return { error: true, tooMany: true, waitMinutes: Math.max(1, Math.ceil(outcome.rate.retryAfterMs / 60_000)) };
    }
    if (outcome.result && !outcome.result.ok && outcome.result.reason === "restricted") {
      return { error: true, restricted: true }; // the author limited who can reply (SOCIAL_TODO B9)
    }
    if (!outcome.result || !outcome.result.ok) return { error: true };
    updateTag("social-posts"); // the post page and the reply counts
    if (outcome.result.notified) updateTag("notifications");
    return { ok: true };
  } catch (error) {
    console.error("createSocialReply failed:", error);
    return { error: true };
  }
}

export type DeleteSocialReplyResult = { ok: true } | { error: true; login?: true };

export async function deleteSocialReply(input: { id: number }): Promise<DeleteSocialReplyResult> {
  if (typeof input?.id !== "number") return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };
  try {
    const result = await prisma.$transaction((tx) => applySocialReplyDelete(tx, { id: input.id, authorId: user.id }));
    if (!result.ok) return { error: true };
    updateTag("social-posts");
    return { ok: true };
  } catch (error) {
    console.error("deleteSocialReply failed:", error);
    return { error: true };
  }
}

// Hide a reply under your own post, or show it again (SOCIAL_TODO B9, ACCOUNT_RULES.md 3.21). Not moderation: the reply stays
// readable for everybody in the "Hidden replies" part and its author is not told. The rules are in social-reply-control.ts.
const hideRules: RateRule[] = socialReplyControl.hideLimits.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SetSocialReplyHiddenResult = { ok: true; hidden: boolean } | { error: true; login?: true; tooMany?: true };

export async function setSocialReplyHidden(input: { id: number; hidden: boolean }): Promise<SetSocialReplyHiddenResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  if (!Number.isSafeInteger(input.id) || input.id <= 0 || typeof input.hidden !== "boolean") return { error: true };
  const user = await getSessionUser();
  if (!user) return { error: true, login: true };
  if (!(await takeActionDb(`reply-hide:${user.id}`, hideRules)).ok) return { error: true, tooMany: true };
  try {
    const result = await prisma.$transaction((tx) =>
      applySocialReplyHide(tx, { replyId: input.id, actorId: user.id, hide: input.hidden }),
    );
    if (!result.ok) return { error: true };
    updateTag("social-posts");
    return { ok: true, hidden: result.hidden };
  } catch (error) {
    console.error("setSocialReplyHidden failed:", error);
    return { error: true };
  }
}
