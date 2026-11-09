"use server";

// Like / unlike a photo (PHOTO_TODO 7). A login is needed; anybody may SEE a photo and its number of likes.
//  - The photo must be one that may be shown (VISIBLE, not deleted, owner shown: socialAuthorShown, the same rule as the
//    media route and the photo page). A like on anything else is refused.
//  - Block (like Social): liking needs that neither person blocked the other. Unlike is always allowed (for a photo that may
//    be shown).
//  - A person's own photo may be liked (Social does the same).
//  - Rate limit: the Social like numbers (socialLimits.likes), kept in the database, with the stricter limits of a new
//    account (limitsFor), but counted in its own key, so photo likes and Social likes do not use up each other's turns.
//  - The answer is the real state from the database (liked or not, and the real number of likes), so a double click
//    cannot show a wrong number.
// No notification for the owner yet (the notification types are Social only; PHOTO_TODO 8 and later).
import { socialLimits } from "@/config/site";
import { limitsFor } from "@/lib/account-limits";
import { isPhotoId } from "@/lib/photo-detail-rules";
import { prisma } from "@/lib/prisma";
import { takeActionDb } from "@/lib/rate-limit-db";
import { getSessionUser } from "@/lib/session";
import { isBlockedEitherWay } from "@/lib/social-block";
import { socialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../../../../generated/prisma/client";

const likeRules = [{ max: socialLimits.likes.max, windowMs: socialLimits.likes.windowSeconds * 1000 }];

export type PhotoLikeResult = { error: true; login?: true; tooMany?: true } | { liked: boolean; likes: number };

export async function setPhotoLike(photoId: number, desiredLiked: boolean): Promise<PhotoLikeResult> {
  if (!isPhotoId(photoId) || typeof desiredLiked !== "boolean") return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!(await takeActionDb(`photo-like:${viewer.id}`, limitsFor(likeRules, viewer))).ok) return { error: true, tooMany: true };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const photo = await tx.photo.findFirst({
        where: { id: photoId, status: ContentStatus.VISIBLE, deletedAt: null, owner: socialAuthorShown },
        select: { id: true, ownerId: true },
      });
      if (!photo) return null;

      if (desiredLiked && (await isBlockedEitherWay(tx, viewer.id, photo.ownerId))) return null;

      const key = { userId_photoId: { userId: viewer.id, photoId } };
      const existing = await tx.photoLike.findUnique({ where: key, select: { userId: true } });

      let liked = existing !== null;
      if (desiredLiked && !existing) {
        await tx.photoLike.create({ data: { userId: viewer.id, photoId } });
        liked = true;
      } else if (!desiredLiked && existing) {
        await tx.photoLike.delete({ where: key });
        liked = false;
      }

      const likes = await tx.photoLike.count({ where: { photoId } });
      return { liked, likes };
    });

    return result ?? { error: true };
  } catch (error) {
    console.error("setPhotoLike failed:", error);
    return { error: true };
  }
}
