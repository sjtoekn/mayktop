// Saved photos: the plain rules (no database, no imports of the database), so a test can run them.
// Same idea as Social bookmarks (social-bookmark-rules.ts): a saved photo is PRIVATE, and the "Saved photos" page lists the
// most recently SAVED first. The paging cursor is  <savedAtMs>.<photoId>  and is read from ?before=...
export {
  bookmarkCursorToText as photoSavedCursorToText,
  parseBookmarkCursor as parsePhotoSavedCursor,
  isBookmarkAfterCursor as isPhotoSavedAfterCursor,
  type BookmarkCursor as PhotoSavedCursor,
} from "@/lib/social-bookmark-rules";
import type { BookmarkCursor } from "@/lib/social-bookmark-rules";

type SavedCondition = { createdAt: Date | { lt: Date }; photoId?: { lt: number } };

/** A Prisma `where` piece: everything saved strictly AFTER the cursor. No cursor: no extra condition. */
export function photoSavedAfterWhere(cursor: BookmarkCursor | null): { OR?: SavedCondition[] } {
  if (!cursor) return {};
  const at = new Date(cursor.ms);
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, photoId: { lt: cursor.id } }] };
}
