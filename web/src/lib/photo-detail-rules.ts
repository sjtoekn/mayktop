// Small pure rules of the photo page /photos/<id> (PHOTO_TODO 6). No database, so `npm run test:photo-detail` can run them.
import { photoCategories, type PhotoCategory } from "@/config/site";

const MAX_PHOTO_ID = 2_147_483_647; // the database column is a 32-bit integer

/** The number in /photos/<id>. Only the plain canonical form ("12", not "012", "1e3", "12.0", " 12", "+12"): one photo, ONE address. */
export function parsePhotoId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_PHOTO_ID ? id : null;
}

/** A photo number that came from the browser as a number (a Like button): a whole number the database column can hold. */
export function isPhotoId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= MAX_PHOTO_ID;
}

/** The stored category as a known key. A key that is not in the list any more (the list changed later) is shown as "other". */
export function photoCategoryKeyOf(stored: unknown): PhotoCategory {
  const found = photoCategories.find((key) => key === stored);
  return found ?? "other";
}

/** "2026-11-08" (UTC) from a date, the same in every language and time zone. */
export function photoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- info / photographer / neighbours (PHOTO_TODO 6b)

/** How many other photos of the photographer are shown under a photo. */
export const photoMoreLimit = 6;

export type PhotoOrientation = "landscape" | "portrait" | "square";

/** Landscape, portrait or square, from the stored width and height. */
export function photoOrientation(width: number, height: number): PhotoOrientation {
  if (width > height) return "landscape";
  if (width < height) return "portrait";
  return "square";
}

/** Megapixels with one decimal, as text: 600 x 420 -> "0.3". Never below 0.1 (a tiny picture is not "0.0"). */
export function photoMegapixels(width: number, height: number): string {
  const mp = (Number.isFinite(width) && Number.isFinite(height) ? width * height : 0) / 1_000_000;
  return Math.max(0.1, Math.round(mp * 10) / 10).toFixed(1);
}

/**
 * The small copy of a stored photo file: "<32 hex>.webp" -> "<32 hex>-t.webp" (the thumbnail name described in the
 * Photo model of schema.prisma). A name that is not one of ours is returned unchanged. If the grid ever names thumbnails
 * differently, change ONLY this function.
 */
export function photoThumbFile(file: string): string {
  const m = /^([a-f0-9]{32})\.(jpg|png|webp)$/.exec(file);
  return m ? `${m[1]}-t.webp` : file;
}

/** Up to two letters for the round picture of a photographer without a picture: "SJ Ethan" -> "SE", "sjethan" -> "S". */
export function photoInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "");
  return letters.join("").toUpperCase();
}

/** "5 November 2026" in the reader's language (UTC day, so the same everywhere). English uses day-month-year. */
export function photoDateText(date: Date, locale: string): string {
  const tag = locale === "en" ? "en-GB" : locale;
  try {
    return new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  } catch {
    return photoDay(date);
  }
}

/** The name a downloaded photo gets on the person's computer: "photo-12.webp". Plain letters only (a title may be in any script). */
export function photoDownloadName(id: number, file: string): string {
  const m = /\.(jpg|png|webp)$/.exec(file);
  return m ? `photo-${id}.${m[1]}` : `photo-${id}`;
}
