// Loads one page of the /photos grid (PHOTO_TODO 5): newest first, only photos that may be shown to everybody.
// Server only (uses the database).
//  - A photo is shown when its status is VISIBLE, it is not deleted AND its owner is shown (isSocialAuthorShown, the same
//    account rule as Social and as the media route). A hidden or removed photo is never in the list.
//  - Paging by cursor, not by page number: `before` = the id of the last photo of the previous page. Ids only grow with
//    time, so "newest first" is "highest id first", and a new photo never shifts the pages.
//  - The owner rule cannot be written as one database filter, so rows are read in batches and checked here. A few
//    batches are read at most; if that is not enough (very many photos of hidden owners in a row) the page is simply
//    shorter and the cursor continues from where reading stopped, so nothing is skipped.
import { photoMedia } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/client";

export type PhotoTile = { id: number; file: string; title: string | null; width: number; height: number };
export type PhotoPage = { items: PhotoTile[]; next: number | null };

const MAX_ROUNDS = 5;

export async function loadPhotoPage(before: number | null, tag: string | null = null): Promise<PhotoPage> {
  const size = photoMedia.pageSize;
  const batch = size * 2;
  const shown: PhotoTile[] = [];
  let cursor = before;
  let lastScanned: number | null = null;
  let scannedAll = false;

  for (let round = 0; round < MAX_ROUNDS && shown.length <= size; round++) {
    const rows = await prisma.photo.findMany({
      where: { status: ContentStatus.VISIBLE, deletedAt: null, ...(tag !== null ? { tags: { some: { tag } } } : {}), ...(cursor !== null ? { id: { lt: cursor } } : {}) },
      orderBy: { id: "desc" },
      take: batch,
      select: { id: true, file: true, title: true, width: true, height: true, owner: { select: { status: true, deletedAt: true } } },
    });
    for (const row of rows) {
      lastScanned = row.id;
      if (isSocialAuthorShown(row.owner)) {
        shown.push({ id: row.id, file: row.file, title: row.title, width: row.width, height: row.height });
      }
      if (shown.length > size) break;
    }
    if (rows.length < batch) {
      scannedAll = true;
      break;
    }
    cursor = rows[rows.length - 1].id;
  }

  const items = shown.slice(0, size);
  const more = shown.length > size || !scannedAll;
  const next = !more ? null : shown.length > size ? items[size - 1].id : lastScanned;
  return { items, next };
}
