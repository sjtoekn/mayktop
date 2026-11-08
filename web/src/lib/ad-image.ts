// Makes a big picture of an ad SMALL on our server, so the advertiser never has to shrink it first.
// Server only (uses `sharp`). Called by ad-submit.ts after checkMedia() has confirmed it is a real JPEG / PNG / WebP.
//
// What happens to every ad picture (and the poster of a video ad):
//  - the camera's rotation (Exif orientation) is applied, so phone photos are not sideways;
//  - it is scaled DOWN (never up) so no side is longer than 2560 pixels;
//  - it is saved as WebP, and the quality is lowered step by step until the file is at most adsConfig.media.imageMaxBytes;
//  - ALL metadata is dropped (GPS location, camera, date): a rebuilt copy is saved, never the uploaded bytes.
// If even the smallest step is still too big, or the file cannot be read, it is refused (the caller shows an error).
import sharp from "sharp";
import { adsConfig } from "@/config/site";

// Tried in order: bigger and better first. Each step is smaller than the one before.
const STEPS = [
  { side: 2560, quality: 85 },
  { side: 2560, quality: 74 },
  { side: 1920, quality: 70 },
  { side: 1600, quality: 62 },
  { side: 1280, quality: 55 },
  { side: 1024, quality: 48 },
] as const;

const MAX_INPUT_PIXELS = 100_000_000; // a small file can still be a huge picture that eats memory

export type ShrunkImage = { ok: true; bytes: Uint8Array; ext: "webp" } | { ok: false; error: "media-size" | "media-type" };

export async function shrinkAdImage(input: Uint8Array): Promise<ShrunkImage> {
  try {
    for (const step of STEPS) {
      const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
        .rotate() // apply the camera orientation, then the metadata is dropped (sharp drops it by default)
        .resize({ width: step.side, height: step.side, fit: "inside", withoutEnlargement: true })
        .webp({ quality: step.quality })
        .toBuffer();
      if (out.length <= adsConfig.media.imageMaxBytes) return { ok: true, bytes: new Uint8Array(out), ext: "webp" };
    }
    return { ok: false, error: "media-size" };
  } catch (error) {
    console.error("shrinkAdImage failed:", error);
    return { ok: false, error: "media-type" }; // broken, truncated or too many pixels
  }
}
