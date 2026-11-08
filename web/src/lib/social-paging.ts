// Paging for the Social feeds (SOCIAL_TODO 4 "Feed pagination", patch-social-pagination).
// The feeds mix posts and reposts, newest first. The total order is:
//   createdAt (newest first), then a post before a repost at the same moment, then the higher id first.
// A "cursor" is the LAST item shown on the page, written as  <createdAtMs>.<rank>.<id>  (rank: 0 = post, 1 = repost).
// The next page is everything strictly AFTER that item in the order above, so nothing is skipped or shown twice,
// even when several items have the very same time. No database here: the rules are plain functions (tested without one).

export type FeedCursor = { ms: number; rank: 0 | 1; id: number };

/** One feed item as far as paging cares. */
export type PageItem = { createdAtMs: number; rank: 0 | 1; id: number };

const CURSOR_PATTERN = /^(\d{1,15})\.([01])\.(\d{1,12})$/;

/** The text for the URL (?before=...). Only digits and dots. */
export function cursorToText(cursor: FeedCursor): string {
  return `${cursor.ms}.${cursor.rank}.${cursor.id}`;
}

/** Reads ?before=... from the URL. Anything that is not exactly a cursor is ignored (null = the first page). */
export function parseCursor(raw: unknown): FeedCursor | null {
  if (typeof raw !== "string") return null;
  const match = CURSOR_PATTERN.exec(raw);
  if (!match) return null;
  const ms = Number(match[1]);
  const id = Number(match[3]);
  if (!Number.isSafeInteger(ms) || !Number.isSafeInteger(id)) return null;
  return { ms, rank: match[2] === "1" ? 1 : 0, id };
}

/** Is this item AFTER the cursor (older, or the same moment and later in the order)? */
export function isAfterCursor(cursor: FeedCursor, item: PageItem): boolean {
  if (item.createdAtMs !== cursor.ms) return item.createdAtMs < cursor.ms;
  if (item.rank !== cursor.rank) return item.rank > cursor.rank;
  return item.id < cursor.id;
}

/** The order of the feeds: newest first, a post before a repost at the same moment, then the higher id first. */
export function comparePageItems(a: PageItem, b: PageItem): number {
  if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return b.id - a.id;
}

/**
 * A Prisma `where` piece that keeps only the rows AFTER the cursor, for ONE table.
 * `rank` is the table's own rank (0 = SocialPost, 1 = SocialRepost). It says the same as isAfterCursor().
 * No cursor: no extra condition.
 */
type CursorCondition = { createdAt: Date | { lt: Date }; id?: { lt: number } };

export function afterCursorWhere(cursor: FeedCursor | null, rank: 0 | 1): { OR?: CursorCondition[] } {
  if (!cursor) return {};
  const at = new Date(cursor.ms);
  const sameMoment =
    rank === cursor.rank
      ? { createdAt: at, id: { lt: cursor.id } }
      : rank > cursor.rank
        ? { createdAt: at }
        : null; // the table that comes first at one moment: its rows at that moment were already shown
  return { OR: sameMoment ? [{ createdAt: { lt: at } }, sameMoment] : [{ createdAt: { lt: at } }] };
}

/**
 * From the rows read for one page (read `size + 1` of each table, merged and sorted):
 * the page itself and the cursor of the next page (null = this is the last page).
 */
export function cutPage<T extends PageItem>(sorted: T[], size: number): { items: T[]; next: FeedCursor | null } {
  if (sorted.length <= size) return { items: sorted, next: null };
  const items = sorted.slice(0, size);
  const last = items[items.length - 1];
  return { items, next: last ? { ms: last.createdAtMs, rank: last.rank, id: last.id } : null };
}
