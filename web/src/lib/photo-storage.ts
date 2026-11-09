// Where the files of photos live on disk (PHOTO_TODO 3). Server only.
// Same idea as the Social pictures (social-image-storage.ts): kept OUTSIDE `web/public/` (default `web/storage/photos/`,
// or the folder in the PHOTO_MEDIA_DIR setting) and served only through GET /api/photos/media/[file], which checks who
// may see the photo. The stored name is random; nothing a person typed is ever used as a path.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { isPhotoFullName, PHOTO_FILE_RE, photoThumbName } from "@/lib/photo-file";

export function photoMediaDir(): string {
  const custom = process.env.PHOTO_MEDIA_DIR;
  return custom && custom.trim() !== "" ? path.resolve(custom) : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "photos");
}

/** The full path of a stored file, or null when the name is not one of ours (so no "../" can ever get through). */
export function photoMediaPath(file: string): string | null {
  return PHOTO_FILE_RE.test(file) ? path.join(/*turbopackIgnore: true*/ photoMediaDir(), file) : null;
}

/** Saves the full copy and the thumbnail under a new random name. Returns the full name (keep it in Photo.file).
 *  If the second file cannot be written, the first one is removed again: never one file without the other. */
export async function savePhotoFiles(full: Uint8Array, thumb: Uint8Array): Promise<string> {
  const dir = photoMediaDir();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const name = `${randomBytes(16).toString("hex")}.webp`;
  const fullPath = path.join(/*turbopackIgnore: true*/ dir, name);
  const thumbPath = path.join(/*turbopackIgnore: true*/ dir, photoThumbName(name));
  await fs.writeFile(fullPath, full, { flag: "wx" });
  try {
    await fs.writeFile(thumbPath, thumb, { flag: "wx" });
  } catch (error) {
    await fs.rm(fullPath, { force: true });
    throw error;
  }
  return name;
}

/** Deletes the files (full copy and thumbnail) behind these full names. Anything that is not one of our names is ignored. Never throws. */
export async function deletePhotoFiles(names: (string | null | undefined)[]): Promise<void> {
  for (const name of names) {
    if (!isPhotoFullName(name)) continue;
    for (const file of [name, photoThumbName(name)]) {
      const full = photoMediaPath(file);
      if (!full) continue;
      try {
        await fs.rm(full, { force: true });
      } catch (error) {
        console.error("deletePhotoFiles failed:", error);
      }
    }
  }
}
