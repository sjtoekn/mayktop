"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { applySocialReplyLike } from "@/lib/social-reply-like";

// Like / unlike a reply (SOCIAL_TODO B10). Same per-person limit as liking a post (server memory; a shared limiter is TODO 50).
const likeRules = [{ max: socialLimits.likes.max, windowMs: socialLimits.likes.windowSeconds * 1000 }];

export type SocialReplyLikeResult = { error: true; login?: true; tooMany?: true } | { liked: boolean; likes: number };

export async function setSocialReplyLike(replyId: number, desiredLiked: boolean): Promise<SocialReplyLikeResult> {
  if (!Number.isSafeInteger(replyId) || replyId <= 0 || typeof desiredLiked !== "boolean") return { error: true };
  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };
  if (!(await takeActionDb(`replylike:${viewer.id}`, limitsFor(likeRules, viewer))).ok) return { error: true, tooMany: true };
  try {
    const result = await prisma.$transaction((tx) => applySocialReplyLike(tx, { replyId, userId: viewer.id, like: desiredLiked }));
    if (!result.ok) return { error: true };
    updateTag("social-replies"); // the shared reply list holds the like counts
    return { liked: result.liked, likes: result.likes };
  } catch (error) {
    console.error("setSocialReplyLike failed:", error);
    return { error: true };
  }
}
