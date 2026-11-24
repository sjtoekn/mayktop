// Database reads for sitemap.xml (SEO). Cached like every other read (see the top of queries.ts): plain numbers only, no Dates.
// Only public, visible content is listed: removed, hidden-for-review and erased items are not, and neither are archived communities.
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITEMAP_LIMIT_PER_KIND, type SitemapData } from "@/lib/seo-rules";
import { ContentStatus } from "../../generated/prisma/client";

export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheLife("hours");
  cacheTag("posts", "communities");

  const visible = { status: ContentStatus.VISIBLE, deletedAt: null };
  const take = SITEMAP_LIMIT_PER_KIND;
  const newest = [{ id: "desc" as const }];
  const [communities, posts, photos, places] = await Promise.all([
    prisma.community.findMany({ where: { archivedAt: null }, orderBy: { id: "asc" }, take, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({ where: { ...visible, community: { archivedAt: null } }, orderBy: newest, take, select: { id: true, updatedAt: true } }),
    prisma.photo.findMany({ where: visible, orderBy: newest, take, select: { id: true, updatedAt: true } }),
    prisma.place.findMany({ where: visible, orderBy: newest, take, select: { id: true, updatedAt: true } }),
  ]);
  return {
    communities: communities.map((r) => ({ slug: r.slug, ms: r.updatedAt.getTime() })),
    posts: posts.map((r) => ({ id: r.id, ms: r.updatedAt.getTime() })),
    photos: photos.map((r) => ({ id: r.id, ms: r.updatedAt.getTime() })),
    places: places.map((r) => ({ id: r.id, ms: r.updatedAt.getTime() })),
  };
}
