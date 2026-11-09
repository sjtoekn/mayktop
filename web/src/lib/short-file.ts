// Names and addresses of stored shorts (SHORTS_TODO 11). Pure functions: no database, no disk, no ffmpeg.
// A short is saved as two files with a RANDOM name (nothing a person typed is ever part of a path):
//   video       "<32 hex>.mp4"     (the name kept in Short.file)
//   thumbnail   "<32 hex>-t.webp"  (always derived from the video name)
import { SHORTS_ROUTE } from "@/config/short-config";

/** The address start of every stored short file (served by GET /api/shorts/media/[file], which checks who may see it). */
export const SHORT_URL_PREFIX = "/api/shorts/media/";

/** Any file we ever store or serve. Nothing else passes (so no "../" can ever get through). */
export const SHORT_FILE_RE = /^[a-f0-9]{32}(\.mp4|-t\.webp)$/;
/** The name of the VIDEO only (the value saved in Short.file). */
export const SHORT_FULL_RE = /^[a-f0-9]{32}\.mp4$/;

export function isShortFullName(file: unknown): file is string {
  return typeof file === "string" && SHORT_FULL_RE.test(file);
}

/** "<hex>.mp4" -> "<hex>-t.webp" */
export function shortThumbName(fullName: string): string {
  return fullName.replace(/\.mp4$/, "-t.webp");
}

/** Any stored name (video or thumbnail) -> the video name, or null when it is not one of ours. */
export function shortFullNameOf(anyName: unknown): string | null {
  if (typeof anyName !== "string" || !SHORT_FILE_RE.test(anyName)) return null;
  return anyName.replace(/-t\.webp$/, ".mp4");
}

export const shortVideoUrl = (fullName: string) => `${SHORT_URL_PREFIX}${fullName}`;
export const shortThumbUrl = (fullName: string) => `${SHORT_URL_PREFIX}${shortThumbName(fullName)}`;
/** The page of one short: /shorts/123 */
export const shortPageUrl = (id: number) => `${SHORTS_ROUTE}/${id}`;
