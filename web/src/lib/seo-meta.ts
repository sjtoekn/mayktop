// What the page headers of ONE photo or ONE place need (SEO stage 2). Server only (uses the database).
// Only content that anybody may see is returned (the same rule as the pages: visible, not erased, owner shown);
// for everything else the answer is null and the page header tells search engines to stay away.
// Cached like the other reads (queries.ts): plain data only.
import { cacheLife } from "next/cache";
import { prisma } from "@/lib/prisma";
import { loadPlace } from "@/lib/place-view";
import { isSocialAuthorShown } from "@/lib/social-visibility";
import type { PlaceType } from "@/config/site";
import { ContentStatus } from "../../generated/prisma/client";

export type PhotoSeo = { file: string; title: string | null; caption: string | null };

export async function getPhotoSeo(id: number): Promise<PhotoSeo | null> {
  "use cache";
  cacheLife("minutes");
  const row = await prisma.photo.findUnique({
    where: { id },
    select: { file: true, title: true, caption: true, status: true, deletedAt: true, owner: { select: { status: true, deletedAt: true } } },
  });
  if (!row || row.deletedAt || row.status !== ContentStatus.VISIBLE || !isSocialAuthorShown(row.owner)) return null;
  return { file: row.file, title: row.title, caption: row.caption };
}

export type PlaceSeo = { name: string; type: PlaceType; city: string | null; region: string | null; country: string; description: string | null };

export async function getPlaceSeo(id: number): Promise<PlaceSeo | null> {
  "use cache";
  cacheLife("minutes");
  const place = await loadPlace(id); // already: visible and not erased
  if (!place) return null;
  return { name: place.name, type: place.type, city: place.city, region: place.region, country: place.country, description: place.description };
}
