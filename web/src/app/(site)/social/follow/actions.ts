"use server";

// Follow / unfollow a person (SOCIAL_TODO 15).
//  1. Nobody logged in (or the account is suspended / banned / deleting): refused with login: true.
//  2. Rate limit: socialLimits.follows per person (server memory; a shared limiter is TODO 50).
//  3. The rules (not yourself, who may be followed, one notification per follower) are in src/lib/social-follow.ts
//     and run in ONE transaction. The browser is not trusted: the person comes from the login cookie only.
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { applySocialFollow } from "@/lib/social-follow";

const followRules = socialLimits.follows.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialFollowActionResult =
  | { error: true; login?: true; tooMany?: true }
  | { following: boolean; followers: number };

export async function setSocialFollow(
  username: string,
  desiredFollowing: boolean,
): Promise<SocialFollowActionResult> {
  if (typeof username !== "string" || typeof desiredFollowing !== "boolean") return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!(await takeActionDb(`follow:${viewer.id}`, limitsFor(followRules, viewer))).ok) return { error: true, tooMany: true };

  // Two quick clicks can both pass the "not following yet" check; the database refuses the second row (P2002).
  // One more try then sees the first row and simply reports the state, so the person never sees an error for it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await prisma.$transaction((tx) =>
        applySocialFollow(tx, { followerId: viewer.id, username, follow: desiredFollowing }),
      );
      if (!result.ok) return { error: true };
      if (result.notified) updateTag("notifications");
      return { following: result.following, followers: result.followers };
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "P2002" && attempt === 0) continue;
      console.error("setSocialFollow failed:", error);
      return { error: true };
    }
  }
  return { error: true };
}
