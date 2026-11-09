// Rules of the /photos grid (PHOTO_TODO 5). Pure functions: no database, no disk, so `npm run test:photo-feed` can run them.

/** The wished height of a row of photos, in CSS pixels. Rows are filled to the full width, so the real height varies a little. */
export const PHOTO_ROW_HEIGHT = 200;

/**
 * The page cursor from the address (`/photos?before=123`): the id of the last photo of the previous page. Only plain
 * digits that make a positive whole number are a cursor; anything else (empty, "12abc", "-5", "1e3", a list given twice)
 * means "the first page", never an error.
 */
export function parsePhotoBefore(input: unknown): number | null {
  if (typeof input !== "string" || !/^[0-9]{1,10}$/.test(input)) return null;
  const n = Number(input);
  return Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
}

export type PhotoTileStyle = { grow: number; basis: number; ratioPercent: number };

/**
 * How one picture is laid out so that every row is filled to the same width and (almost) the same height, with no
 * script: `grow` and `basis` go to the flex item, `ratioPercent` is the padding that keeps the picture's shape.
 * A picture without a usable size is shown as a square.
 */
export function photoTileStyle(width: number, height: number, rowHeight: number = PHOTO_ROW_HEIGHT): PhotoTileStyle {
  const ok = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const w = ok ? width : 1;
  const h = ok ? height : 1;
  // Very wide or very tall pictures are limited so one of them cannot take a whole row or a whole screen.
  const ratio = Math.min(3, Math.max(1 / 3, w / h));
  return {
    grow: Math.round(ratio * 100),
    basis: Math.round(ratio * rowHeight),
    ratioPercent: Math.round((1 / ratio) * 10_000) / 100,
  };
}
