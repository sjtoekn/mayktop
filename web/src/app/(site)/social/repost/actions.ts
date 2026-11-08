"use server";

// Repost / quote repost / undo (SOCIAL_TODO 16).
//  1. Nobody logged in (or the account is suspended / banned / deleting): refused with login: true.
//  2. Rate limit: socialLimits.reposts per person (server memory; a shared limiter is TODO 50).
//  3. The rules (one row per person per post, own posts allowed, one notification, quote text cleaned) are in
//     src/lib/social-repost.ts and run in ONE transaction. The browser is not trusted: the person comes from the
//     login cookie only.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { applySocialRepost, REPOST_ACTIONS } from "@/lib/social-repost";

const repostRules = socialLimits.reposts.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialRepostActionResult =
  | { error: true; login?: true; tooMany?: true; invalid?: true }
  | { reposted: boolean; quoted: boolean; reposts: number };

export async function setSocialRepost(input: {
  postId: number;
  action: "repost" | "quote" | "undo";
  quote?: string;
}): Promise<SocialRepostActionResult> {
  if (typeof input !== "object" || input === null) return { error: true };
  const { postId, action, quote } = input;
  if (!Number.isSafeInteger(postId) || postId <= 0 || !REPOST_ACTIONS.includes(action)) return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!(await takeActionDb(`repost:${viewer.id}`, limitsFor(repostRules, viewer))).ok) return { error: true, tooMany: true };

  // Two quick clicks can both pass the "no row yet" check; the database refuses the second row (P2002). One more
  // try then sees the first row and simply reports the state, so the person never sees an error for it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) =>
        applySocialRepost(tx, { userId: viewer.id, socialPostId: postId, action, quote }),
      );
      if (!result.ok) return result.reason === "invalid" ? { error: true, invalid: true } : { error: true };
      if (result.changed) updateTag("social-posts"); // feeds show reposts and counts
      if (result.notified) updateTag("notifications");
      return { reposted: result.reposted, quoted: result.quoted, reposts: result.reposts };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002" && attempt === 0) continue;
      console.error("setSocialRepost failed:", error);
      return { error: true };
    }
  }
  return { error: true };
}
