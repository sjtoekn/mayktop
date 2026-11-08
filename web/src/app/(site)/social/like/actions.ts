"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialAuthorShown } from "@/lib/social-visibility";
import { isBlockedEitherWay } from "@/lib/social-block";
import { socialLimits } from "@/config/site";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { ContentStatus } from "../../../../../generated/prisma/client";

// Like / unlike counts against a per-person limit kept in server memory (SOCIAL_TODO 10; a shared limiter is TODO 50).
const likeRules = [{ max: socialLimits.likes.max, windowMs: socialLimits.likes.windowSeconds * 1000 }];

export type SocialLikeResult =
  | { error: true; login?: true; tooMany?: true }
  | { liked: boolean; likes: number };

export async function setSocialPostLike(
  socialPostId: number,
  desiredLiked: boolean,
): Promise<SocialLikeResult> {
  if (
    !Number.isSafeInteger(socialPostId) ||
    socialPostId <= 0 ||
    typeof desiredLiked !== "boolean"
  ) {
    return { error: true };
  }

  const viewer = await getSessionUser();

  if (!viewer) {
    return { error: true, login: true };
  }

  if (!(await takeActionDb(`like:${viewer.id}`, limitsFor(likeRules, viewer))).ok) {
    return { error: true, tooMany: true };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const post = await tx.socialPost.findFirst({
        where: {
          id: socialPostId,
          status: ContentStatus.VISIBLE,
          deletedAt: null,
          author: socialAuthorShown,
        },
        select: {
          id: true,
          authorId: true,
        },
      });

      if (!post) return null;

      // Block (SOCIAL_TODO A7): liking needs that neither person blocked the other. Unlike is always allowed.
      if (desiredLiked && (await isBlockedEitherWay(tx, viewer.id, post.authorId))) return null;

      const key = {
        userId_socialPostId: {
          userId: viewer.id,
          socialPostId,
        },
      };

      const existing = await tx.socialPostLike.findUnique({
        where: key,
        select: { userId: true },
      });

      let liked = Boolean(existing);
      let notificationCreated = false;

      if (desiredLiked && !existing) {
        await tx.socialPostLike.create({
          data: {
            userId: viewer.id,
            socialPostId,
          },
        });

        liked = true;

        if (post.authorId !== viewer.id) {
          await tx.notification.create({
            data: {
              recipientId: post.authorId,
              actorId: viewer.id,
              type: "SOCIAL_POST_LIKE",
              socialPostId,
            },
          });

          notificationCreated = true;
        }
      } else if (!desiredLiked && existing) {
        await tx.socialPostLike.delete({ where: key });
        liked = false;
      }

      const likes = await tx.socialPostLike.count({
        where: { socialPostId },
      });

      return { liked, likes, notificationCreated };
    });

    if (!result) return { error: true };

    updateTag("social-posts");

    if (result.notificationCreated) {
      updateTag("notifications");
    }

    return {
      liked: result.liked,
      likes: result.likes,
    };
  } catch (error) {
    console.error("setSocialPostLike failed:", error);
    return { error: true };
  }
}
