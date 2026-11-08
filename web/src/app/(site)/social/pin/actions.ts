"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits } from "@/config/site";
import { takeAction } from "@/lib/social-limits";
import { applySocialPin } from "@/lib/social-pin";

// Pin / unpin one of your own posts (SOCIAL_TODO B6). The limit is kept in server memory (a shared limiter is TODO 50).
// The profile page reads the pin per request (it is not in a shared feed cache), so only the profile path is refreshed.
const pinRules = socialLimits.pins.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));

export type SocialPinActionResult = { error: true; login?: true; tooMany?: true; notfound?: true } | { pinned: boolean };

export async function setSocialPin(socialPostId: number, desiredPinned: boolean): Promise<SocialPinActionResult> {
  if (!Number.isSafeInteger(socialPostId) || socialPostId <= 0 || typeof desiredPinned !== "boolean") return { error: true };

  const viewer = await getSessionUser();
  if (!viewer) return { error: true, login: true };

  if (!takeAction(`pin:${viewer.id}`, pinRules).ok) return { error: true, tooMany: true };

  try {
    const result = await prisma.$transaction((tx) =>
      applySocialPin(tx, { userId: viewer.id, postId: socialPostId, pin: desiredPinned }),
    );
    if (!result.ok) return result.reason === "notfound" ? { error: true, notfound: true } : { error: true };
    revalidatePath(`/social/u/${viewer.username}`);
    return { pinned: result.pinned };
  } catch (error) {
    console.error("setSocialPin failed:", error);
    return { error: true };
  }
}
