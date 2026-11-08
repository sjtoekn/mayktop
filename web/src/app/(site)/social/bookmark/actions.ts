"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeAction } from "@/lib/social-limits";
import { applySocialBookmark } from "@/lib/social-bookmark";

// Save / remove a bookmark (SOCIAL_TODO B2). Private: nothing is cached, nobody is notified, no tag is updated
// (no shared feed holds anything about bookmarks). The limit is kept in server memory (a shared limiter is TODO 50).
const bookmarkRules = socialLimits.bookmarks.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialBookmarkActionResult =
  | { error: true; login?: true; tooMany?: true; full?: true }
  | { bookmarked: boolean };

export async function setSocialBookmark(
  socialPostId: number,
  desiredBookmarked: boolean,
): Promise<SocialBookmarkActionResult> {
  if (!Number.isSafeInteger(socialPostId) || socialPostId <= 0 || typeof desiredBookmarked !== "boolean") {
    return { error: true };
  }

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!takeAction(`bookmark:${viewer.id}`, bookmarkRules).ok) return { error: true, tooMany: true };

  try {
    const result = await prisma.$transaction((tx) =>
      applySocialBookmark(tx, { userId: viewer.id, postId: socialPostId, bookmark: desiredBookmarked }, socialLimits.maxBookmarks),
    );
    if (!result.ok) return result.reason === "full" ? { error: true, full: true } : { error: true };
    return { bookmarked: result.bookmarked };
  } catch (error) {
    console.error("setSocialBookmark failed:", error);
    return { error: true };
  }
}
