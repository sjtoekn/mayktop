// Reads one photo for the page /photos/<id> (PHOTO_TODO 6). Server only (uses the database).
// This only READS. Whether the person may see it (shown to everybody, or only its owner / an admin) is decided by the page
// with the same rule as the media route, so a hidden photo's file and page behave the same.
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants: no database code is loaded

export async function getPhotoDetail(id: number) {
  return prisma.photo.findUnique({
    where: { id },
    select: {
      id: true,
      file: true,
      title: true,
      caption: true,
      category: true,
      width: true,
      height: true,
      status: true,
      createdAt: true,
      editedAt: true,
      viewCount: true,
      deletedAt: true,
      ownerId: true,
      owner: { select: { username: true, displayName: true, status: true, deletedAt: true } },
      tags: { select: { tag: true }, orderBy: { tag: "asc" } },
      _count: { select: { likes: true } },
    },
  });
}

/** Did this person like this photo? (read per request, never cached) */
export async function hasLikedPhoto(userId: string, photoId: number): Promise<boolean> {
  const row = await prisma.photoLike.findUnique({ where: { userId_photoId: { userId, photoId } }, select: { userId: true } });
  return row !== null;
}

export type PhotoDetail = NonNullable<Awaited<ReturnType<typeof getPhotoDetail>>>;

// ---------------------------------------------------------------- the rest of the page (PHOTO_TODO 6b)
// Only called for a photo that is SHOWN (visible, owner shown, not blocked), so these look at the SAME photographer's
// photos that may be shown: VISIBLE and not deleted. Nothing about the person who looks is read or saved.
const thumbSelect = { id: true, file: true, title: true, width: true, height: true } as const;

function ownerShownPhotos(ownerId: string) {
  return { ownerId, status: ContentStatus.VISIBLE, deletedAt: null } as const;
}

/** How many photos of this photographer may be shown ("Photographer · 33 photos"). */
export async function countPhotographerPhotos(ownerId: string): Promise<number> {
  return prisma.photo.count({ where: ownerShownPhotos(ownerId) });
}

/**
 * The photographer's next-newer and next-older photo, in the same order as the grid (newest first, then the larger number).
 * "Previous" on the page = the newer one, "Next" = the older one.
 */
export async function getPhotoNeighbours(photo: { id: number; ownerId: string; createdAt: Date }) {
  const base = ownerShownPhotos(photo.ownerId);
  const [newer, older] = await Promise.all([
    prisma.photo.findFirst({
      where: { ...base, OR: [{ createdAt: { gt: photo.createdAt } }, { createdAt: photo.createdAt, id: { gt: photo.id } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: thumbSelect,
    }),
    prisma.photo.findFirst({
      where: { ...base, OR: [{ createdAt: { lt: photo.createdAt } }, { createdAt: photo.createdAt, id: { lt: photo.id } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: thumbSelect,
    }),
  ]);
  return { newer, older };
}

/** Other photos of the same photographer, newest first (not the one being looked at). */
export async function getMorePhotos(ownerId: string, exceptId: number, limit: number) {
  return prisma.photo.findMany({
    where: { ...ownerShownPhotos(ownerId), id: { not: exceptId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: thumbSelect,
  });
}

export type PhotoThumb = Awaited<ReturnType<typeof getMorePhotos>>[number];
