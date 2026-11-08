// Saves an ad that an advertiser sent from /advertise/new (ADS_PLAN Session 3). Server only.
//
//  1. cleanAdInput() checks and cleans every field (src/lib/ad-input.ts). The browser is not trusted.
//  2. The person must be logged in and active (the caller passes the session user).
//  3. Limits (adsConfig.submit), counted from the database: not too many ads waiting for review, not too many per day.
//  3b. IMAGE / VIDEO ads (Session 3b): the files come in the same request. checkMedia() reads their real content and size
//      (src/lib/ad-media.ts); they are stored in OUR folder (src/lib/ad-storage.ts) and the ad keeps only our own address.
//      If the ad cannot be saved, the files just written are deleted again, so no orphan file is left.
//  4. The ad is saved as SUBMITTED, UNPAID, with the flat price from `adsConfig` (never a price from the browser).
//     (DRAFT is used from Session 4, when an advertiser can edit an ad and send it again.)
// Nothing about any visitor is stored here. The only personal data is the advertiser's own contact email.
import { prisma } from "@/lib/prisma";
import { adsConfig } from "@/config/site";
import { cleanAdInput, checkSubmitLimits, type AdInputError } from "@/lib/ad-input";
import { checkMedia, mediaNeeds, type MediaError } from "@/lib/ad-media";
import { deleteAdFiles, saveAdFile } from "@/lib/ad-storage";
import { shrinkAdImage } from "@/lib/ad-image";
import { AdStatus } from "../../generated/prisma/client";

export type SubmitAdResult =
  | { ok: true; id: number; email: string }
  | { ok: false; error: AdInputError | MediaError | "community" | "limit-waiting" | "limit-day" | "other"; phrase?: string };

/** The files of an IMAGE / VIDEO ad. `image` = the picture (or the poster of a video ad), `video` = the video. */
export type AdFiles = { image?: Uint8Array | null; video?: Uint8Array | null };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitAd(
  advertiserId: string,
  input: unknown,
  files: AdFiles = {},
  now: Date = new Date(),
): Promise<SubmitAdResult> {
  const cleaned = cleanAdInput(input, now);
  if (!cleaned.ok) return { ok: false, error: cleaned.error, phrase: cleaned.phrase };
  const ad = cleaned.value;

  // Files first (cheap, no database): a TEXT ad has none, an IMAGE ad needs a picture, a VIDEO ad needs a video + poster.
  const needs = mediaNeeds(ad.format);
  const image = needs.image ? checkMedia("image", files.image) : null;
  if (image && !image.ok) return { ok: false, error: image.error };
  const video = needs.video ? checkMedia("video", files.video) : null;
  if (video && !video.ok) return { ok: false, error: video.error };
  // A big picture is made small HERE (ad-image.ts): the advertiser never has to shrink it first. Videos are saved as they are.
  let imageFile: { bytes: Uint8Array; ext: "jpg" | "png" | "webp" } | null = null;
  if (image && image.ok && files.image) {
    const shrunk = await shrinkAdImage(files.image);
    if (!shrunk.ok) return { ok: false, error: shrunk.error };
    imageFile = { bytes: shrunk.bytes, ext: shrunk.ext };
  }

  const written: string[] = []; // addresses of files saved in this call; deleted again if the ad is not saved
  try {
    let communityId: number | null = null;
    if (ad.communitySlug) {
      const community = await prisma.community.findFirst({
        where: { slug: ad.communitySlug, archivedAt: null },
        select: { id: true },
      });
      if (!community) return { ok: false, error: "community" };
      communityId = community.id;
    }

    // Count and save in one transaction, so two quick clicks cannot both pass the limit.
    const saved = await prisma.$transaction(async (tx) => {
      const [waiting, lastDay] = await Promise.all([
        tx.adCampaign.count({ where: { advertiserId, status: AdStatus.SUBMITTED } }),
        tx.adCampaign.count({ where: { advertiserId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
      ]);
      const limit = checkSubmitLimits(waiting, lastDay);
      if (limit !== "ok") return limit;
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;
      if (imageFile) {
        imageUrl = await saveAdFile(imageFile.bytes, imageFile.ext);
        written.push(imageUrl);
      }
      if (video && video.ok && files.video) {
        videoUrl = await saveAdFile(files.video, video.ext);
        written.push(videoUrl);
      }
      return tx.adCampaign.create({
        data: {
          advertiserId,
          contactEmail: ad.contactEmail,
          format: ad.format,
          title: ad.title,
          body: ad.body,
          imageUrl,
          videoUrl,
          destinationUrl: ad.destinationUrl,
          slot: ad.slot,
          communityId,
          startDate: ad.startDate,
          priceCents: adsConfig.monthlyPriceCents,
          currency: adsConfig.currency,
          status: AdStatus.SUBMITTED,
          submittedAt: now,
        },
        select: { id: true },
      });
    });

    if (saved === "waiting") return { ok: false, error: "limit-waiting" };
    if (saved === "day") return { ok: false, error: "limit-day" };
    return { ok: true, id: saved.id, email: ad.contactEmail };
  } catch (error) {
    console.error("submitAd failed:", error);
    await deleteAdFiles(written);
    return { ok: false, error: "other" };
  }
}
