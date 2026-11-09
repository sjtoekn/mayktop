// Saved photos (patch-photo-save). The server action calls `applyPhotoBookmark` inside a transaction; a test calls it too,
// so the rules live in ONE place. Same rules as Social bookmarks (ACCOUNT_RULES.md 3.17), for photos:
//  - the person comes from the login cookie (the action does that and the rate limit first);
//  - SAVING needs a photo that may be shown (VISIBLE, not deleted, owner shown: the same rule as Like and the media route)
//    and that neither person has blocked the other ("not found", it never says why);
//  - a person can save their own photos;
//  - REMOVING a save is always allowed, whatever the state of the photo (so a person can always clean the list);
//  - doing the same thing twice changes nothing (no error, no second row);
//  - at most `maxTotal` saved photos per person: when full, saving another is refused ("full"), removing always works;
//  - a save is private: no notification, no count for anybody else, never in a shared cache.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isPhotoId } from "@/lib/photo-detail-rules";
import { isBlockedEitherWay } from "@/lib/social-block";
import { isSocialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export type PhotoBookmarkResult =
  | { ok: true; bookmarked: boolean; changed: boolean }
  | { ok: false; reason: "error" | "notfound" | "full" };

export async function applyPhotoBookmark(
  db: Db,
  input: { userId: string; photoId: unknown; bookmark: unknown },
  maxTotal: number,
): Promise<PhotoBookmarkResult> {
  const photoId = input.photoId;
  if (!isPhotoId(photoId) || typeof input.bookmark !== "boolean" || !input.userId) return { ok: false, reason: "error" };

  const key = { userId_photoId: { userId: input.userId, photoId } };
  const existing = await db.photoBookmark.findUnique({ where: key, select: { userId: true } });

  if (!input.bookmark) {
    // Always allowed.
    if (existing) await db.photoBookmark.delete({ where: key });
    return { ok: true, bookmarked: false, changed: Boolean(existing) };
  }

  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { id: true, ownerId: true, status: true, deletedAt: true } });
  if (!photo || photo.status !== ContentStatus.VISIBLE || photo.deletedAt !== null) return { ok: false, reason: "notfound" };
  const owner = await db.user.findUnique({ where: { id: photo.ownerId }, select: { status: true, deletedAt: true } });
  if (!owner || !isSocialAuthorShown(owner)) return { ok: false, reason: "notfound" };
  if (await isBlockedEitherWay(db, input.userId, photo.ownerId)) return { ok: false, reason: "notfound" };

  if (existing) return { ok: true, bookmarked: true, changed: false };

  const total = await db.photoBookmark.count({ where: { userId: input.userId } });
  if (total >= maxTotal) return { ok: false, reason: "full" };

  await db.photoBookmark.create({ data: { userId: input.userId, photoId } });
  return { ok: true, bookmarked: true, changed: true };
}

/**
 * Final erasure of an account (ACCOUNT_RULES.md 3.7): deletes every save the person made, and every save that points to one
 * of the person's photos (those photos are erased too). Safe to run twice. Returns how many rows went.
 * MUST run before the person's photos are deleted (the link is a RESTRICT foreign key).
 */
export async function erasePhotoBookmarks(db: Db, userId: string): Promise<number> {
  const result = await db.photoBookmark.deleteMany({ where: { OR: [{ userId }, { photo: { ownerId: userId } }] } });
  return result.count;
}
