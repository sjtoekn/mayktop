// Reading saved photos (patch-photo-save). Server only (uses the database). Only READS; it is private to one viewer.
import { photoMedia } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { photoSavedAfterWhere, type PhotoSavedCursor } from "@/lib/photo-bookmark-rules";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/client";

/** Did this person save this photo? (read per request, never cached) */
export async function hasSavedPhoto(userId: string, photoId: number): Promise<boolean> {
  const row = await prisma.photoBookmark.findUnique({ where: { userId_photoId: { userId, photoId } }, select: { userId: true } });
  return row !== null;
}

export type SavedPhotoTile = { id: number; file: string; title: string | null; width: number; height: number; savedAtMs: number };

const MAX_ROUNDS = 5;

/**
 * One page of the person's saved photos, the most recently SAVED first.
 * Left out: a photo that is hidden, removed or deleted, one whose owner may not be shown, and one of a person who blocked you
 * or whom you blocked (`blockedUsernames`). They come back when the photo comes back. Like the /photos grid, rows are read in
 * batches and checked in code; if a page cannot be filled the cursor continues from where reading stopped.
 */
export async function loadSavedPhotos(
  userId: string,
  cursor: PhotoSavedCursor | null,
  blockedUsernames: ReadonlySet<string>,
): Promise<{ items: SavedPhotoTile[]; next: PhotoSavedCursor | null }> {
  const size = photoMedia.pageSize;
  const batch = size * 2;
  const shown: SavedPhotoTile[] = [];
  let at = cursor;
  let last: PhotoSavedCursor | null = null;
  let scannedAll = false;

  for (let round = 0; round < MAX_ROUNDS && shown.length <= size; round++) {
    const rows = await prisma.photoBookmark.findMany({
      where: { userId, ...photoSavedAfterWhere(at), photo: { status: ContentStatus.VISIBLE, deletedAt: null } },
      orderBy: [{ createdAt: "desc" }, { photoId: "desc" }],
      take: batch,
      select: {
        createdAt: true,
        photo: { select: { id: true, file: true, title: true, width: true, height: true, owner: { select: { username: true, status: true, deletedAt: true } } } },
      },
    });
    for (const row of rows) {
      last = { ms: row.createdAt.getTime(), id: row.photo.id };
      if (isSocialAuthorShown(row.photo.owner) && !blockedUsernames.has(row.photo.owner.username)) {
        const { id, file, title, width, height } = row.photo;
        shown.push({ id, file, title, width, height, savedAtMs: row.createdAt.getTime() });
      }
      if (shown.length > size) break;
    }
    if (rows.length < batch) {
      scannedAll = true;
      break;
    }
    const tail = rows[rows.length - 1];
    at = { ms: tail.createdAt.getTime(), id: tail.photo.id };
  }

  const items = shown.slice(0, size);
  const more = shown.length > size || !scannedAll;
  const lastShown = items[items.length - 1];
  const next: PhotoSavedCursor | null = !more ? null : shown.length > size && lastShown ? { ms: lastShown.savedAtMs, id: lastShown.id } : last;
  return { items, next };
}
