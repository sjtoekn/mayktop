// Where the pictures of Social posts live on disk (patch-social-images). Server only.
// Same idea as the ad files (ad-storage.ts, ADS_PLAN decision 10): kept OUTSIDE `web/public/` (default
// `web/storage/social/`, or the folder in the SOCIAL_MEDIA_DIR setting) and served only through
// GET /api/social/media/[file], which checks who may see the picture. The stored name is random; nothing a person
// typed is ever used as a path.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileFromSocialImageUrl, SOCIAL_IMAGE_FILE_RE, socialImageUrl, type SocialImageExt } from "@/lib/social-image";

export function socialMediaDir(): string {
  const custom = process.env.SOCIAL_MEDIA_DIR;
  return custom && custom.trim() !== "" ? path.resolve(custom) : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "social");
}

/** The full path of a stored file, or null when the name is not one of ours (so no "../" can ever get through). */
export function socialMediaPath(file: string): string | null {
  return SOCIAL_IMAGE_FILE_RE.test(file) ? path.join(/*turbopackIgnore: true*/ socialMediaDir(), file) : null;
}

/** Saves the (already cleaned) bytes under a new random name. Returns the address to keep in the post ("/api/social/media/<file>"). */
export async function saveSocialImage(bytes: Uint8Array, ext: SocialImageExt): Promise<string> {
  const dir = socialMediaDir();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const file = `${randomBytes(16).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ dir, file), bytes, { flag: "wx" });
  return socialImageUrl(file);
}

/** Deletes the stored files behind these addresses. Anything that is not one of our addresses is ignored. Never throws. */
export async function deleteSocialImages(urls: (string | null | undefined)[]): Promise<void> {
  for (const url of urls) {
    const file = fileFromSocialImageUrl(url);
    const full = file ? socialMediaPath(file) : null;
    if (!full) continue;
    try {
      await fs.rm(full, { force: true });
    } catch (error) {
      console.error("deleteSocialImages failed:", error);
    }
  }
}
