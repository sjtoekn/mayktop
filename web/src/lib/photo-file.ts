// Names and addresses of stored photos (PHOTO_TODO 3). Pure functions: no database, no disk, no sharp, so tests and
// client code can use them.
// A photo is saved as two rebuilt WebP files with a RANDOM name (nothing a person typed is ever part of a path):
//   full copy   "<32 hex>.webp"     (this is the name kept in Photo.file)
//   thumbnail   "<32 hex>-t.webp"   (always derived from the full name)

/** The address start of every stored photo file. */
export const PHOTO_URL_PREFIX = "/api/photos/media/";

/** Any file we ever store or serve: 32 random hex characters, optional "-t" (thumbnail), ".webp". Nothing else. */
export const PHOTO_FILE_RE = /^[a-f0-9]{32}(-t)?\.webp$/;

/** The name of a FULL copy only (the value saved in Photo.file). */
export const PHOTO_FULL_RE = /^[a-f0-9]{32}\.webp$/;

export function isPhotoFullName(file: unknown): file is string {
  return typeof file === "string" && PHOTO_FULL_RE.test(file);
}

/** "<hex>.webp" -> "<hex>-t.webp" */
export function photoThumbName(fullName: string): string {
  return fullName.replace(/\.webp$/, "-t.webp");
}

/** Any stored name (full or thumbnail) -> the full name, or null when it is not one of ours. */
export function photoFullNameOf(anyName: unknown): string | null {
  if (typeof anyName !== "string" || !PHOTO_FILE_RE.test(anyName)) return null;
  return anyName.replace(/-t\.webp$/, ".webp");
}

export const photoFileUrl = (fullName: string): string => `${PHOTO_URL_PREFIX}${fullName}`;
export const photoThumbUrl = (fullName: string): string => `${PHOTO_URL_PREFIX}${photoThumbName(fullName)}`;
