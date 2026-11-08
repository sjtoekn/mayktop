// Where the picture / video files of ads live on disk (ADS_PLAN decision 10). Server only.
// They are kept OUTSIDE `web/public/` (default `web/storage/ads/`, or the folder in the AD_MEDIA_DIR setting) and are served
// only through GET /api/ad/media/[file]. The stored name is random; nothing an advertiser typed is used as a path.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileFromMediaUrl, mediaUrl, MEDIA_FILE_RE, type MediaExt } from "@/lib/ad-media";

export function adMediaDir(): string {
  const custom = process.env.AD_MEDIA_DIR;
  return custom && custom.trim() !== "" ? path.resolve(custom) : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "ads");
}

/** The full path of a stored file, or null when the name is not one of ours (so no "../" can ever get through). */
export function adMediaPath(file: string): string | null {
  return MEDIA_FILE_RE.test(file) ? path.join(/*turbopackIgnore: true*/ adMediaDir(), file) : null;
}

/** Saves the bytes under a new random name. Returns the address to keep in the ad ("/api/ad/media/<file>"). */
export async function saveAdFile(bytes: Uint8Array, ext: MediaExt): Promise<string> {
  const dir = adMediaDir();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const file = `${randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ dir, file), bytes, { flag: "wx" });
  return mediaUrl(file);
}

/** Deletes the stored files behind these addresses. Anything that is not one of our addresses is ignored. Never throws. */
export async function deleteAdFiles(urls: (string | null | undefined)[]): Promise<void> {
  for (const url of urls) {
    const file = fileFromMediaUrl(url);
    const full = file ? adMediaPath(file) : null;
    if (!full) continue;
    try {
      await fs.rm(full, { force: true });
    } catch (error) {
      console.error("deleteAdFiles failed:", error);
    }
  }
}
