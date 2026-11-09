// The database part of the photo view count (PHOTO_TODO 6c). Adds 1 to the total of ONE photo. Only a photo that may be
// shown (VISIBLE, not deleted, owner shown: the same rule as the page and the media route), and never the owner's own
// photo. Nothing about the viewer is saved. The rules around it are in src/lib/photo-views.ts.
import { prisma } from "@/lib/prisma";
import { socialAuthorShown } from "@/lib/social-visibility";
import { ContentStatus } from "../../generated/prisma/enums"; // plain constants

/** True when the total was raised. */
export async function addPhotoView(photoId: number, viewerId: string): Promise<boolean> {
  const result = await prisma.photo.updateMany({
    where: { id: photoId, status: ContentStatus.VISIBLE, deletedAt: null, ownerId: { not: viewerId }, owner: socialAuthorShown },
    data: { viewCount: { increment: 1 } }, // one atomic UPDATE: two views at the same moment are both counted
  });
  return result.count > 0;
}
