// What goes into sitemap.xml. Pure code (no database, no Next.js), so it can be tested: npm run test:seo
// The database reading is in src/lib/seo-queries.ts, the route is src/app/sitemap.ts.

/** Public pages that are always listed. Pages that need a login, settings and the admin panel are never listed. */
export const staticSitemapPaths = ["/", "/community", "/popular", "/top", "/explore", "/news", "/photos", "/places", "/shorts", "/advertise", "/fairness", "/creator-program"] as const;

/** `ms` = when the page last changed, in milliseconds (plain numbers only, as everywhere in the cached reads). */
export type SitemapData = {
  communities: { slug: string; ms: number }[];
  posts: { id: number; ms: number }[];
  photos: { id: number; ms: number }[];
  places: { id: number; ms: number }[];
};

export type SitemapEntry = { url: string; lastModified?: Date };

/** One sitemap file may hold at most 50,000 addresses (Google's limit); we stay far below it per kind. */
export const SITEMAP_LIMIT_PER_KIND = 10_000;

export function buildSitemapEntries(base: string, data: SitemapData): SitemapEntry[] {
  const entries: SitemapEntry[] = staticSitemapPaths.map((path) => ({ url: base + path }));
  const add = (path: string, ms: number) => entries.push({ url: base + path, lastModified: new Date(ms) });
  for (const c of data.communities.slice(0, SITEMAP_LIMIT_PER_KIND)) add(`/c/${encodeURIComponent(c.slug)}`, c.ms);
  for (const p of data.posts.slice(0, SITEMAP_LIMIT_PER_KIND)) add(`/post/${p.id}`, p.ms);
  for (const p of data.photos.slice(0, SITEMAP_LIMIT_PER_KIND)) add(`/photos/${p.id}`, p.ms);
  for (const p of data.places.slice(0, SITEMAP_LIMIT_PER_KIND)) add(`/places/${p.id}`, p.ms);
  return entries;
}

/** Pages that search engines must not visit: private, login-only, or without value for a visitor from Google. */
export const robotsDisallow = [
  "/admin",
  "/api/",
  "/settings",
  "/notifications",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/email-verified",
  "/submit",
  "/communities/new",
  "/advertise/new",
  "/advertise/my",
  "/appeal",
  "/saved",
  "/search",
  "/social/submit",
  "/social/search",
  "/social/bookmarks",
  "/social/following",
  "/photos/upload",
  "/photos/saved",
  "/places/new",
  "/shorts/upload",
] as const;

/** Photo files are the one /api/ path that Google Images may read. */
export const robotsAllow = ["/", "/api/photos/media/"] as const;
