// Bookmarks: the plain rules (SOCIAL_TODO B2, patch-social-bookmark). No database, no imports, so a test can run them.
// A bookmark is PRIVATE: only the person who saved it can see it. Nobody is told, no count is shown to anybody (not even the
// author of the post), and nothing about bookmarks goes into the shared feed caches.
//
// The Bookmarks page lists the most recently SAVED first (not the newest post first), so its paging cursor is about the
// time of the bookmark:   <savedAtMs>.<postId>   (digits and one dot only; the page reads it from ?before=...).
// The next page is everything strictly AFTER that bookmark in the order  savedAt (newest first), then the higher post id first.

export type BookmarkCursor = { ms: number; id: number };

const CURSOR_PATTERN = /^(\d{1,15})\.(\d{1,12})$/;

/** The text for the URL (?before=...). */
export function bookmarkCursorToText(cursor: BookmarkCursor): string {
  return `${cursor.ms}.${cursor.id}`;
}

/** Reads ?before=... Anything that is not exactly a cursor is ignored (null = the first page). */
export function parseBookmarkCursor(raw: unknown): BookmarkCursor | null {
  if (typeof raw !== "string") return null;
  const match = CURSOR_PATTERN.exec(raw);
  if (!match) return null;
  const ms = Number(match[1]);
  const id = Number(match[2]);
  if (!Number.isSafeInteger(ms) || !Number.isSafeInteger(id) || id < 1) return null;
  return { ms, id };
}

/** Is this bookmark AFTER the cursor (saved earlier, or at the very same moment with a lower post id)? */
export function isBookmarkAfterCursor(cursor: BookmarkCursor, item: { savedAtMs: number; id: number }): boolean {
  if (item.savedAtMs !== cursor.ms) return item.savedAtMs < cursor.ms;
  return item.id < cursor.id;
}

type BookmarkCondition = { createdAt: Date | { lt: Date }; socialPostId?: { lt: number } };

/** A Prisma `where` piece with the same meaning as isBookmarkAfterCursor(). No cursor: no extra condition. */
export function bookmarkAfterWhere(cursor: BookmarkCursor | null): { OR?: BookmarkCondition[] } {
  if (!cursor) return {};
  const at = new Date(cursor.ms);
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, socialPostId: { lt: cursor.id } }] };
}

/** From the rows read for one page (read `size + 1`, newest saved first): the page and the cursor of the next page. */
export function cutBookmarkPage<T extends { savedAtMs: number; id: number }>(
  sorted: T[],
  size: number,
): { items: T[]; next: BookmarkCursor | null } {
  if (sorted.length <= size) return { items: sorted, next: null };
  const items = sorted.slice(0, size);
  const last = items[items.length - 1];
  return { items, next: last ? { ms: last.savedAtMs, id: last.id } : null };
}

/** A post number from the browser: a whole number of 1 or more, or null. */
export function cleanBookmarkPostId(raw: unknown): number | null {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
}
