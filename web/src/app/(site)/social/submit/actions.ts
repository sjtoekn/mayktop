"use server";

// Saves a new Social post (SOCIAL_TODO 10: text checks + rate limit; patch-social-images: ONE optional picture).
//  1. The text is checked and cleaned on the server (src/lib/social-input.ts). The text is required, also with a picture.
//  2. Nobody logged in: refused with login: true (before the picture is even read).
//  3. The picture (optional, field "image") is checked by its REAL content, size and number of pixels, and rebuilt
//     without Exif / location data (src/lib/social-image.ts). Checking is work for the server, so it has its own limit
//     (socialMedia.checks, server memory).
//  4. Rate limit (socialLimits in src/config/site.ts): counted from the person's earlier posts in the
//     database, in the same transaction as the save. Hidden and deleted posts count too, so deleting
//     a post does not give the person a new turn.
//  5. The file is written to disk only after the rate limit said yes, inside the transaction; if anything fails
//     afterwards the file is deleted again, so no picture is left without a post.
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { socialLimits, socialMedia } from "@/config/site";
import { cleanSocialBody } from "@/lib/social-input";
import { checkRules, takeAction, type RateRule } from "@/lib/social-limits";
import { syncSocialTags } from "@/lib/social-tag-sync";
import { checkSocialImage, type SocialImageError } from "@/lib/social-image";
import { deleteSocialImages, saveSocialImage } from "@/lib/social-image-storage";

const postRules: RateRule[] = socialLimits.posts.map((rule) => ({
  max: rule.max,
  windowMs: rule.windowMinutes * 60_000,
}));
const LONGEST_WINDOW_MS = Math.max(...postRules.map((rule) => rule.windowMs));
const checkRulesForImages: RateRule[] = [{ max: socialMedia.checks.max, windowMs: socialMedia.checks.windowMinutes * 60_000 }];

export type CreateSocialPostResult =
  | {
      error: true;
      login?: true; // not logged in
      invalid?: true; // empty, only invisible characters, or too long
      imageError?: SocialImageError; // the picture was refused: too big, not a real JPG / PNG / WebP, or too many pixels
      tooMany?: true; // rate limit reached
      waitMinutes?: number; // with tooMany: about how long to wait
    }
  | undefined;

export async function createSocialPost(form: FormData): Promise<CreateSocialPostResult> {
  if (!(form instanceof FormData)) return { error: true };

  const cleaned = cleanSocialBody(form.get("body"));
  if (!cleaned.ok) {
    return cleaned.reason === "type" ? { error: true } : { error: true, invalid: true };
  }

  const author = await getSessionUser();
  if (!author) return { error: true, login: true };

  // ---- the picture (optional). Checked and cleaned BEFORE anything is saved.
  let picture: Extract<ReturnType<typeof checkSocialImage>, { ok: true }> | null = null;
  const file = form.get("image");
  if (file !== null && !(file instanceof File)) return { error: true }; // a text value where a file belongs
  if (file instanceof File && file.size > 0) {
    const turn = takeAction(`social-image:${author.id}`, checkRulesForImages);
    if (!turn.ok) {
      return { error: true, tooMany: true, waitMinutes: Math.max(1, Math.ceil(turn.retryAfterMs / 60_000)) };
    }
    if (file.size > socialMedia.imageMaxBytes) return { error: true, imageError: "size" };
    const checked = checkSocialImage(new Uint8Array(await file.arrayBuffer()));
    if (!checked.ok) return { error: true, imageError: checked.error };
    picture = checked;
  }

  const saved: { url: string | null } = { url: null };
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const earlier = await tx.socialPost.findMany({
        where: { authorId: author.id, createdAt: { gte: new Date(now - LONGEST_WINDOW_MS) } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), postRules, now);
      if (!rate.ok) return rate;

      if (picture) saved.url = await saveSocialImage(picture.bytes, picture.ext);
      const created = await tx.socialPost.create({
        data: {
          authorId: author.id,
          body: cleaned.body,
          mediaUrl: saved.url,
        },
        select: { id: true },
      });
      // Hashtags and mentions (SOCIAL_TODO 6): saved in the same transaction as the post.
      await syncSocialTags(tx, { socialPostId: created.id, authorId: author.id, body: cleaned.body });
      return rate;
    });

    if (!outcome.ok) {
      return {
        error: true,
        tooMany: true,
        waitMinutes: Math.max(1, Math.ceil(outcome.retryAfterMs / 60_000)),
      };
    }
  } catch (error) {
    console.error("createSocialPost failed:", error);
    await deleteSocialImages([saved.url]); // no picture is left behind without a post
    return { error: true };
  }

  updateTag("social-posts");
  redirect("/");
}
