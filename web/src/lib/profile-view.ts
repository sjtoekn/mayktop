// What the main profile page /u/<username> needs besides getSocialProfile (queries.ts): the photo count, the newest
// photos, and the picture. Server only (uses the database). Only photos that may be shown to everybody are read
// (VISIBLE, not deleted); whether the ACCOUNT may be shown is decided by getSocialProfile (the same rule as Social and Photos).
import { photoMedia } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { ContentStatus } from "../../generated/prisma/client";

export type ProfilePhoto = { id: number; file: string; title: string | null; width: number; height: number };

export async function getProfilePhotos(ownerId: string): Promise<{ total: number; items: ProfilePhoto[] }> {
  const where = { ownerId, status: ContentStatus.VISIBLE, deletedAt: null } as const;
  const [total, items] = await Promise.all([
    prisma.photo.count({ where }),
    prisma.photo.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: photoMedia.pageSize,
      select: { id: true, file: true, title: true, width: true, height: true },
    }),
  ]);
  return { total, items };
}

/** The profile picture address, only when it is one we can safely put in a CSS url() (our own file or https). */
export async function getProfileImage(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  const image = row?.image?.trim() ?? "";
  return /^(\/[A-Za-z0-9._~\-\/]+|https:\/\/[^\s"'()\\]+)$/.test(image) ? image : null;
}
