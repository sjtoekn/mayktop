// Where the files of shorts live on disk (SHORTS_TODO 11). Server only.
// Same idea as photos (photo-storage.ts): kept OUTSIDE `web/public/` (default `web/storage/shorts/`, or the folder in the
// SHORT_MEDIA_DIR setting) and served only through GET /api/shorts/media/[file], which checks who may see the short.
// The stored name is random; nothing a person typed is ever used as a path.
// An upload first waits in `<media dir>/tmp/` (the raw file as sent), is processed, and only the finished pair
// (video + thumbnail) is moved into the media folder.
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SHORT_MEDIA_DIR_ENV } from "@/config/short-config";
import { isShortFullName, SHORT_FILE_RE, shortThumbName } from "@/lib/short-file";

export function shortMediaDir(): string {
  const custom = process.env[SHORT_MEDIA_DIR_ENV];
  return custom && custom.trim() !== "" ? path.resolve(custom) : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "shorts");
}

/** The folder where raw uploads wait while they are processed. */
export function shortTempDir(): string {
  return path.join(/*turbopackIgnore: true*/ shortMediaDir(), "tmp");
}

/** The full path of a stored file, or null when the name is not one of ours (so no "../" can ever get through). */
export function shortMediaPath(file: string): string | null {
  return SHORT_FILE_RE.test(file) ? path.join(/*turbopackIgnore: true*/ shortMediaDir(), file) : null;
}

/** A new random video name "<32 hex>.mp4" (not yet written anywhere). */
export function newShortName(): string {
  return `${randomBytes(16).toString("hex")}.mp4`;
}

/** Saves the raw upload in the temp folder (random name, no extension: nothing can run it). Returns its path. */
export async function saveShortUpload(bytes: Uint8Array): Promise<string> {
  const dir = shortTempDir();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const file = path.join(/*turbopackIgnore: true*/ dir, `${randomBytes(16).toString("hex")}.upload`);
  await fs.writeFile(file, bytes, { flag: "wx" });
  return file;
}

/** Moves a finished video + thumbnail (made in the temp folder) into the media folder under `name`.
 *  If the second move fails the first is removed again: never one file without the other. */
export async function publishShortFiles(name: string, videoTmp: string, thumbTmp: string): Promise<void> {
  if (!isShortFullName(name)) throw new Error("publishShortFiles: not one of our names");
  const dir = shortMediaDir();
  await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const videoPath = path.join(/*turbopackIgnore: true*/ dir, name);
  const thumbPath = path.join(/*turbopackIgnore: true*/ dir, shortThumbName(name));
  await moveFile(videoTmp, videoPath);
  try {
    await moveFile(thumbTmp, thumbPath);
  } catch (error) {
    await fs.rm(videoPath, { force: true });
    throw error;
  }
}

async function moveFile(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch {
    await fs.copyFile(from, to); // another disk: copy, then remove the original
    await fs.rm(from, { force: true });
  }
}

/** Deletes the files (video and thumbnail) behind these video names. Anything that is not one of our names is ignored. Never throws. */
export async function deleteShortFiles(names: (string | null | undefined)[]): Promise<void> {
  for (const name of names) {
    if (!isShortFullName(name)) continue;
    for (const file of [name, shortThumbName(name)]) {
      const full = shortMediaPath(file);
      if (!full) continue;
      try {
        await fs.rm(full, { force: true });
      } catch (error) {
        console.error("deleteShortFiles failed:", error);
      }
    }
  }
}
