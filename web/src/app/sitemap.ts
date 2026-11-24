// /sitemap.xml: the list of public pages for search engines. Needs SITE_URL (src/lib/site-url.ts).
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getSitemapData } from "@/lib/seo-queries";
import { buildSitemapEntries, type SitemapData } from "@/lib/seo-rules";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: SitemapData = { communities: [], posts: [], photos: [], places: [] };
  try {
    data = await getSitemapData();
  } catch (error) {
    // A missing database must not break the build: the sitemap then lists only the fixed pages.
    console.error("sitemap: could not read the database:", error);
  }
  return buildSitemapEntries(getSiteUrl(), data);
}
