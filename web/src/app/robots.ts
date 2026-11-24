// /robots.txt: tells search engines what they may visit. Needs SITE_URL (src/lib/site-url.ts).
// Without a real https SITE_URL (a test copy, a preview, a forgotten setting) everything is closed to search engines.
import type { MetadataRoute } from "next";
import { getSiteUrl, isSiteIndexable } from "@/lib/site-url";
import { robotsAllow, robotsDisallow } from "@/lib/seo-rules";

export default function robots(): MetadataRoute.Robots {
  if (!isSiteIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const base = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: [...robotsAllow], disallow: [...robotsDisallow] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
