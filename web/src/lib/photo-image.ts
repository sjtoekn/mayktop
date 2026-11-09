// Turns an uploaded picture into the two files we store for a photo (PHOTO_TODO 3). Server only (uses `sharp`).
//
// Steps, every time (the browser is never trusted):
//  1. size: photoMedia.imageMaxBytes.
//  2. REAL content: checkSocialImage() (src/lib/social-image.ts) reads the file structure, accepts only JPEG, PNG and WebP
//     (no SVG), removes Exif / GPS / comments / trailing bytes, and refuses a broken file. It is given the photo limits
//     (photoMedia), not the Social ones.
//  3. pixels: photoMedia.maxSide and photoMedia.maxPixels (a small file can still be a huge picture).
//  4. sharp REBUILDS two WebP files from the cleaned bytes: the camera rotation is applied first, then all metadata is
//     dropped (sharp drops it unless asked to keep it). Nothing is ever saved "as it came".
//  - full copy: longest side at most photoMedia.fullSide (never enlarged)
//  - thumbnail: longest side at most photoMedia.thumbSide (the grid shows these, so 1000 photos stay light)
import sharp from "sharp";
import { photoMedia } from "@/config/site";
import { checkSocialImage } from "@/lib/social-image";

export type PhotoImageError = "size" | "type" | "pixels";

export type PhotoFiles =
  | { ok: true; full: Uint8Array; thumb: Uint8Array; width: number; height: number }
  | { ok: false; error: PhotoImageError };

export async function makePhotoFiles(input: Uint8Array | null | undefined): Promise<PhotoFiles> {
  if (!input || input.length === 0) return { ok: false, error: "type" };
  if (input.length > photoMedia.imageMaxBytes) return { ok: false, error: "size" };

  const checked = checkSocialImage(input, photoMedia);
  if (!checked.ok) return { ok: false, error: checked.error };
  if (checked.width > photoMedia.maxSide || checked.height > photoMedia.maxSide || checked.width * checked.height > photoMedia.maxPixels) {
    return { ok: false, error: "pixels" };
  }

  try {
    const source = () => sharp(checked.bytes, { limitInputPixels: photoMedia.maxPixels + 1, failOn: "error" }).rotate();
    const full = await source()
      .resize({ width: photoMedia.fullSide, height: photoMedia.fullSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: photoMedia.fullQuality })
      .toBuffer({ resolveWithObject: true });
    const thumb = await source()
      .resize({ width: photoMedia.thumbSide, height: photoMedia.thumbSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: photoMedia.thumbQuality })
      .toBuffer();
    return { ok: true, full: new Uint8Array(full.data), thumb: new Uint8Array(thumb), width: full.info.width, height: full.info.height };
  } catch (error) {
    console.error("makePhotoFiles failed:", error);
    return { ok: false, error: "type" }; // broken, truncated or too many pixels
  }
}
