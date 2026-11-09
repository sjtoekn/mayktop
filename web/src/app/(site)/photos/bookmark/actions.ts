"use server";

// Save / remove a saved photo (patch-photo-save). Private: nothing is cached, nobody is notified. The rules are in
// src/lib/photo-bookmark.ts. Rate limit: the Social bookmark numbers, kept in the database, in their own key
// (photo saves and Social saves do not use up each other's turns), with the stricter limits of a new account.
import { socialLimits } from "@/config/site";
import { limitsFor } from "@/lib/account-limits";
import { applyPhotoBookmark } from "@/lib/photo-bookmark";
import { prisma } from "@/lib/prisma";
import { takeActionDb } from "@/lib/rate-limit-db";
import { getSessionUser } from "@/lib/session";

const bookmarkRules = socialLimits.bookmarks.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type PhotoBookmarkActionResult = { error: true; login?: true; tooMany?: true; full?: true } | { bookmarked: boolean };

export async function setPhotoBookmark(photoId: number, desiredBookmarked: boolean): Promise<PhotoBookmarkActionResult> {
  if (typeof desiredBookmarked !== "boolean") return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!(await takeActionDb(`photo-bookmark:${viewer.id}`, limitsFor(bookmarkRules, viewer))).ok) return { error: true, tooMany: true };

  try {
    const result = await prisma.$transaction((tx) =>
      applyPhotoBookmark(tx, { userId: viewer.id, photoId, bookmark: desiredBookmarked }, socialLimits.maxBookmarks),
    );
    if (!result.ok) return result.reason === "full" ? { error: true, full: true } : { error: true };
    return { bookmarked: result.bookmarked };
  } catch (error) {
    console.error("setPhotoBookmark failed:", error);
    return { error: true };
  }
}
