// Reading collections (private to one viewer). Server only (uses the database). Only READS.
import { photoMedia } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { photoSavedAfterWhere, type PhotoSavedCursor } from "@/lib/photo-bookmark-rules";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/client";

const visiblePhoto = { status: ContentStatus.VISIBLE, deletedAt: null } as const;

export type CollectionCard = { id: number; name: string; count: number; cover: string | null };

/** The person's collections, newest first, with how many photos can be seen in each and the picture of the latest one. */
export async function loadMyCollections(userId: string): Promise<CollectionCard[]> {
  const rows = await prisma.photoCollection.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      _count: { select: { items: { where: { photo: visiblePhoto } } } },
      items: {
        where: { photo: visiblePhoto },
        orderBy: [{ createdAt: "desc" }, { photoId: "desc" }],
        take: 1,
        select: { photo: { select: { file: true } } },
      },
    },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, count: row._count.items, cover: row.items[0]?.photo.file ?? null }));
}

export type CollectionPhotoTile = { id: number; file: string; title: string | null; width: number; height: number; addedAtMs: number };

const MAX_ROUNDS = 5;

/**
 * One page of one collection, the most recently ADDED first. Null = there is no such collection of this person
 * (also when it belongs to somebody else: it never says which). Left out: hidden / removed / deleted photos, photos whose owner
 * may not be shown, and photos of a person who blocked you or whom you blocked. Same batch reading as the Saved photos page.
 */
export async function loadCollectionPhotos(
  userId: string,
  collectionId: number,
  cursor: PhotoSavedCursor | null,
  blockedUsernames: ReadonlySet<string>,
): Promise<{ name: string; items: CollectionPhotoTile[]; next: PhotoSavedCursor | null } | null> {
  const collection = await prisma.photoCollection.findUnique({ where: { id: collectionId }, select: { ownerId: true, name: true } });
  if (!collection || collection.ownerId !== userId) return null;

  const size = photoMedia.pageSize;
  const batch = size * 2;
  const shown: CollectionPhotoTile[] = [];
  let at = cursor;
  let last: PhotoSavedCursor | null = null;
  let scannedAll = false;

  for (let round = 0; round < MAX_ROUNDS && shown.length <= size; round++) {
    const rows = await prisma.photoCollectionItem.findMany({
      where: { collectionId, ...photoSavedAfterWhere(at), photo: visiblePhoto },
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
        shown.push({ id, file, title, width, height, addedAtMs: row.createdAt.getTime() });
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
  const next: PhotoSavedCursor | null = !more ? null : shown.length > size && lastShown ? { ms: lastShown.addedAtMs, id: lastShown.id } : last;
  return { name: collection.name, items, next };
}
