"use server";

// Saves a new photo (PHOTO_TODO 4). A login is needed to upload (anybody may SEE photos, PHOTO_TODO 1a).
//  1. Title (required), category (required), caption and tags are checked and cleaned on the server (src/lib/photo-input.ts).
//  2. Nobody logged in: refused with reason "login", before the picture is even read.
//  3. The picture is checked by its REAL content, size and number of pixels and rebuilt as two WebP files without Exif /
//     location data (src/lib/photo-image.ts). Checking is work for the server, so it has its own limit (photoMedia.checks).
//  4. Rate limit (photoLimits in src/config/site.ts): counted from the person's earlier photos in the database, in the same
//     transaction as the save. Deleted and hidden photos count too, so deleting a photo does not give a new turn.
//     A new account gets the stricter limits (limitsFor).
//  5. The files are written to disk only after the rate limit said yes, inside the transaction; if anything fails
//     afterwards the files are deleted again, so no file is left without a photo.
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { photoLimits, photoMedia } from "@/config/site";
import { cleanPhotoCaption, cleanPhotoTitle, parsePhotoCategory, parsePhotoTags } from "@/lib/photo-input";
import { makePhotoFiles, type PhotoImageError } from "@/lib/photo-image";
import { deletePhotoFiles, savePhotoFiles } from "@/lib/photo-storage";
import { takeActionDb } from "@/lib/rate-limit-db";
import { limitsFor } from "@/lib/account-limits";
import { mayWriteText } from "@/lib/reputation";
import { checkRules, type RateRule } from "@/lib/social-limits";

const uploadRules: RateRule[] = photoLimits.uploads.map((rule) => ({ max: rule.max, windowMs: rule.windowMinutes * 60_000 }));
const LONGEST_WINDOW_MS = Math.max(...uploadRules.map((rule) => rule.windowMs));
const checkRulesForImages: RateRule[] = [{ max: photoMedia.checks.max, windowMs: photoMedia.checks.windowMinutes * 60_000 }];

export type UploadPhotoResult =
  | { ok: true; id: number; file: string }
  | {
      ok: false;
      reason: "error" | "login" | "link" | "title" | "invalid" | "category" | "tags" | "noImage" | "tooMany" | "imageType" | "imageSize" | "imagePixels";
      waitMinutes?: number; // with tooMany: about how long to wait
    };

const IMAGE_REASON: Record<PhotoImageError, "imageType" | "imageSize" | "imagePixels"> = {
  type: "imageType",
  size: "imageSize",
  pixels: "imagePixels",
};

export async function uploadPhoto(form: FormData): Promise<UploadPhotoResult> {
  if (!(form instanceof FormData)) return { ok: false, reason: "error" };

  const title = cleanPhotoTitle(form.get("title"));
  if (!title.ok) return { ok: false, reason: title.reason === "empty" ? "title" : "invalid" };
  const caption = cleanPhotoCaption(form.get("caption"));
  if (!caption.ok) return { ok: false, reason: "invalid" };
  const category = parsePhotoCategory(form.get("category"));
  if (!category.ok) return { ok: false, reason: "category" };
  const tags = parsePhotoTags(form.get("tags"));
  if (!tags.ok) return { ok: false, reason: "tags" };

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, reason: "noImage" };

  const owner = await getSessionUser();
  if (!owner) return { ok: false, reason: "login" };
  // A web link in the title or caption needs the "link" privilege (reputationConfig.privileges.link); staff may always.
  if (!(await mayWriteText(owner.id, title.title, caption.caption ?? ""))) return { ok: false, reason: "link" };

  const turn = await takeActionDb(`photo-image:${owner.id}`, checkRulesForImages);
  if (!turn.ok) return { ok: false, reason: "tooMany", waitMinutes: Math.max(1, Math.ceil(turn.retryAfterMs / 60_000)) };
  if (file.size > photoMedia.imageMaxBytes) return { ok: false, reason: "imageSize" };
  const made = await makePhotoFiles(new Uint8Array(await file.arrayBuffer()));
  if (!made.ok) return { ok: false, reason: IMAGE_REASON[made.error] };

  const saved: { name: string | null } = { name: null };
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const now = Date.now();
      const earlier = await tx.photo.findMany({
        where: { ownerId: owner.id, createdAt: { gte: new Date(now - LONGEST_WINDOW_MS) } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const rate = checkRules(earlier.map((row) => row.createdAt.getTime()), limitsFor(uploadRules, owner), now);
      if (!rate.ok) return rate;

      saved.name = await savePhotoFiles(made.full, made.thumb);
      const created = await tx.photo.create({
        data: {
          ownerId: owner.id,
          file: saved.name,
          width: made.width,
          height: made.height,
          title: title.title,
          caption: caption.caption,
          category: category.category,
          tags: { create: tags.tags.map((tag) => ({ tag })) },
        },
        select: { id: true },
      });
      return { ok: true as const, id: created.id };
    });

    if (!outcome.ok) {
      return { ok: false, reason: "tooMany", waitMinutes: Math.max(1, Math.ceil(outcome.retryAfterMs / 60_000)) };
    }
    return { ok: true, id: outcome.id, file: saved.name as string };
  } catch (error) {
    console.error("uploadPhoto failed:", error);
    await deletePhotoFiles([saved.name]); // no file is left behind without a photo
    return { ok: false, reason: "error" };
  }
}
