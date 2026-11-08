"use server";

// Reply to a Social post and delete your own reply (SOCIAL_TODO 18).
//  1. The text is checked and cleaned on the server (src/lib/social-reply.ts). Nobody logged in: refused with login: true.
//  2. Rate limit (socialReplyConfig.limits in src/config/site.ts): counted from the person's earlier replies in the
//     database, in the same transaction as the save, so it survives a restart and is right with several servers.
//     Deleted replies count too, so deleting does not give a new turn.
//  3. The rules (a post that may be shown, own post allowed, one unread notification per person per post) are in
//     src/lib/social-reply.ts. The browser is not trusted: the person comes from the login cookie only.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialReplyConfig } from "@/config/site";
import { checkRules, type RateRule } from "@/lib/social-limits";
import { applySocialReply, applySocialReplyDelete, cleanReplyBody } from "@/lib/social-reply";

const replyRules: RateRule[] = socialReplyConfig.limits.map((rule) => ({ max: rule.max, windowMs: rule.windowMinutes * 60_000 }));
const LONGEST_WINDOW_MS = Math.max(...replyRules.map((rule) => rule.windowMs));

export type CreateSocialReplyResult =
  | { ok: true }
  | { error: true; login?: true; invalid?: true; tooMany?: true; waitMinutes?: number };

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
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), replyRules, now);
      if (!rate.ok) return { rate, result: null };
      const result = await applySocialReply(tx, { authorId: author.id, socialPostId: postId, body: cleaned.body });
      return { rate, result };
    });

    if (!outcome.rate.ok) {
      return { error: true, tooMany: true, waitMinutes: Math.max(1, Math.ceil(outcome.rate.retryAfterMs / 60_000)) };
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
