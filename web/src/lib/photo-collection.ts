// Photo collections: a person's own named groups of photos. Private: nobody else sees them, no count, no notification.
// The server actions call these inside a transaction. Rules:
//  - the person comes from the login cookie (the action does that and the rate limit first);
//  - a collection belongs to ONE person; nobody can change another person's collection ("not found");
//  - ADDING a photo needs a photo that may be shown (VISIBLE, not deleted, owner shown) and no block either way;
//  - REMOVING a photo from a collection is always allowed; doing the same thing twice changes nothing;
//  - a name is 1 to 60 characters, unique per person; at most 50 collections per person, 500 photos per collection.
import type { Prisma } from "../../generated/prisma/client";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded
import { isPhotoId } from "@/lib/photo-detail-rules";
import { isBlockedEitherWay } from "@/lib/social-block";
import { isSocialAuthorShown } from "@/lib/social-visibility";

type Db = Prisma.TransactionClient;

export const photoCollectionLimits = { maxCollections: 50, maxPhotos: 500, nameMax: 60 } as const;

export type PhotoCollectionRow = { id: number; name: string; has: boolean };

export type PhotoCollectionFail = "error" | "notfound" | "full" | "exists" | "badname";

/** The name as it is saved: NFC, spaces collapsed and trimmed. Null = not allowed. */
export function cleanCollectionName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > photoCollectionLimits.nameMax) return null;
  return name;
}

async function photoMayBeAdded(db: Db, userId: string, photoId: number): Promise<boolean> {
  const photo = await db.photo.findUnique({ where: { id: photoId }, select: { ownerId: true, status: true, deletedAt: true } });
  if (!photo || photo.status !== ContentStatus.VISIBLE || photo.deletedAt !== null) return false;
  const owner = await db.user.findUnique({ where: { id: photo.ownerId }, select: { status: true, deletedAt: true } });
  if (!owner || !isSocialAuthorShown(owner)) return false;
  if (await isBlockedEitherWay(db, userId, photo.ownerId)) return false;
  return true;
}

/** The person's collections (newest first) and whether this photo is already in each. */
export async function listCollectionsForPhoto(db: Db, userId: string, photoId: unknown): Promise<PhotoCollectionRow[]> {
  if (!isPhotoId(photoId) || !userId) return [];
  const rows = await db.photoCollection.findMany({
    where: { ownerId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, items: { where: { photoId }, select: { photoId: true } } },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, has: row.items.length > 0 }));
}

export async function applyCollectionToggle(
  db: Db,
  input: { userId: string; collectionId: unknown; photoId: unknown; add: unknown },
): Promise<{ ok: true; has: boolean } | { ok: false; reason: PhotoCollectionFail }> {
  const { collectionId, photoId } = input;
  if (typeof collectionId !== "number" || !Number.isSafeInteger(collectionId) || collectionId < 1) return { ok: false, reason: "error" };
  if (!isPhotoId(photoId) || typeof input.add !== "boolean" || !input.userId) return { ok: false, reason: "error" };

  const collection = await db.photoCollection.findUnique({ where: { id: collectionId }, select: { ownerId: true } });
  if (!collection || collection.ownerId !== input.userId) return { ok: false, reason: "notfound" };

  const key = { collectionId_photoId: { collectionId, photoId } };
  const existing = await db.photoCollectionItem.findUnique({ where: key, select: { photoId: true } });

  if (!input.add) {
    if (existing) await db.photoCollectionItem.delete({ where: key });
    return { ok: true, has: false };
  }

  if (!(await photoMayBeAdded(db, input.userId, photoId))) return { ok: false, reason: "notfound" };
  if (existing) return { ok: true, has: true };
  const total = await db.photoCollectionItem.count({ where: { collectionId } });
  if (total >= photoCollectionLimits.maxPhotos) return { ok: false, reason: "full" };
  await db.photoCollectionItem.create({ data: { collectionId, photoId } });
  return { ok: true, has: true };
}

/** A new collection that already holds this photo. */
export async function createCollectionWithPhoto(
  db: Db,
  input: { userId: string; name: unknown; photoId: unknown },
): Promise<{ ok: true; collection: PhotoCollectionRow } | { ok: false; reason: PhotoCollectionFail }> {
  const name = cleanCollectionName(input.name);
  if (name === null) return { ok: false, reason: "badname" };
  const photoId = input.photoId;
  if (!isPhotoId(photoId) || !input.userId) return { ok: false, reason: "error" };
  if (!(await photoMayBeAdded(db, input.userId, photoId))) return { ok: false, reason: "notfound" };

  const count = await db.photoCollection.count({ where: { ownerId: input.userId } });
  if (count >= photoCollectionLimits.maxCollections) return { ok: false, reason: "full" };
  const same = await db.photoCollection.findUnique({ where: { ownerId_name: { ownerId: input.userId, name } }, select: { id: true } });
  if (same) return { ok: false, reason: "exists" };

  const created = await db.photoCollection.create({
    data: { ownerId: input.userId, name, items: { create: { photoId } } },
    select: { id: true, name: true },
  });
  return { ok: true, collection: { id: created.id, name: created.name, has: true } };
}

/**
 * Final erasure of an account (ACCOUNT_RULES.md 3.7): deletes the person's collections (with what is in them) and every
 * place where a collection of somebody else holds one of the person's photos. Safe to run twice.
 * MUST run before the person's photos are deleted (the links are RESTRICT foreign keys).
 */
export async function erasePhotoCollections(db: Db, userId: string): Promise<number> {
  const items = await db.photoCollectionItem.deleteMany({ where: { OR: [{ collection: { ownerId: userId } }, { photo: { ownerId: userId } }] } });
  const collections = await db.photoCollection.deleteMany({ where: { ownerId: userId } });
  return items.count + collections.count;
}
