import { prisma } from "@/lib/prisma";

const MAX_FEEDS_PER_RUN = 8;
const MAX_ITEMS_PER_FEED = 40;
const MAX_TEXT = 8_000;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function tag(block: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"));
  return match ? decodeXml(match[1]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
}

function attr(block: string, tagName: string, attribute: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}\\b([^>]*)>`, "i"));
  if (!match) return "";
  const attrMatch = match[1].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return attrMatch ? decodeXml(attrMatch[1]).trim() : "";
}

export function safeHttpUrl(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "127.0.0.1" || host === "::1" || host.startsWith("10.") ||
      host.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "0.0.0.0" || host === "169.254.169.254" || host.includes(":")
    ) return null;
    url.username = ""; url.password = "";
    return url.toString();
  } catch { return null; }
}

const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif|avif)(?:[?#]|$)/i;

/** Raw (not tag-stripped) text of a tag, so we can look for <img> inside description / content:encoded. */
function rawTag(block: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

/** Picture of a feed item: media tags, an image enclosure, or the first real <img> in the item's HTML. */
function extractImage(block: string, base: string): string | null {
  const candidates: string[] = [];

  for (const m of block.matchAll(/<media:(?:content|thumbnail)\b([^>]*)>/gi)) {
    const attrs = m[1];
    const url = attrs.match(/url\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!url) continue;
    const type = attrs.match(/type\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const medium = attrs.match(/medium\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if ((type && !type.startsWith("image")) || (medium && medium !== "image")) continue;
    candidates.push(decodeXml(url).trim());
  }

  for (const m of block.matchAll(/<enclosure\b([^>]*)>/gi)) {
    const attrs = m[1];
    const url = attrs.match(/url\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!url) continue;
    const type = attrs.match(/type\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (type.startsWith("image") || (!type && IMAGE_EXT.test(url))) candidates.push(decodeXml(url).trim());
  }

  const own = tag(block, "image");
  if (own && IMAGE_EXT.test(own)) candidates.push(own);

  const html = `${rawTag(block, "content:encoded")} ${rawTag(block, "description")} ${rawTag(block, "content")} ${rawTag(block, "summary")}`;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const imgTag = m[0];
    if (/\b(?:width|height)\s*=\s*["']?1["']?(?:\s|\/|>)/i.test(imgTag)) continue; // tracking pixel
    const src = imgTag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) candidates.push(decodeXml(src).trim());
  }

  for (const candidate of candidates) {
    const safe = safeHttpUrl(candidate, base);
    if (safe) return safe;
  }
  return null;
}

/** Fallback: the article page's own og:image / twitter:image (what Facebook and WhatsApp show as a preview). */
async function fetchOgImage(articleUrl: string): Promise<string | null> {
  let current = safeHttpUrl(articleUrl);
  for (let hop = 0; current && hop < 4; hop += 1) {
    const response = await fetch(current, {
      headers: { "user-agent": "FalvencoNewsBot/1.0 (+news feed reader)", accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(6_000),
      redirect: "manual",
      cache: "no-store",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      current = location ? safeHttpUrl(location, current) : null; // every redirect target is checked again
      continue;
    }
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("html")) return null;

    // Read only the start of the page: the <meta> tags are in <head>.
    let html = "";
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      while (size < 300_000) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      await reader.cancel().catch(() => {});
    } else {
      html = (await response.text()).slice(0, 300_000);
    }

    const wanted = ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"];
    for (const key of wanted) {
      for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
        const metaTag = m[0];
        const name = (metaTag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
        if (name !== key) continue;
        const content = metaTag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
        const safe = content ? safeHttpUrl(decodeXml(content).trim(), current) : null;
        if (safe) return safe;
      }
    }
    return null;
  }
  return null;
}

/**
 * Give pictures to the newest stories that have none. imageUrl: null = not looked at yet,
 * "" = looked at, the page has no picture (so we do not ask the publisher again on every run).
 */
async function fillMissingImages(limit = 15): Promise<number> {
  const pending = await prisma.newsArticle.findMany({
    where: { imageUrl: null },
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: limit,
    select: { id: true, url: true },
  });
  let filled = 0;
  for (let i = 0; i < pending.length; i += 5) {
    const batch = pending.slice(i, i + 5);
    const found = await Promise.all(batch.map(async (article) => {
      try { return await fetchOgImage(article.url); } catch { return null; }
    }));
    for (let j = 0; j < batch.length; j += 1) {
      const image = found[j];
      await prisma.newsArticle.update({ where: { id: batch[j].id }, data: { imageUrl: image ?? "" } });
      if (image) filled += 1;
    }
  }
  return filled;
}

function parseItems(xml: string, feedUrl: string) {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>[\s\S]*?<\/\1\s*>/gi)].slice(0, MAX_ITEMS_PER_FEED);
  return blocks.flatMap(([block]) => {
    const title = tag(block, "title");
    const linkHref = attr(block, "link", "href");
    const linkText = tag(block, "link");
    const url = safeHttpUrl(linkHref || linkText, feedUrl);
    if (!title || !url) return [];
    const guid = tag(block, "guid") || tag(block, "id") || url;
    const rawDate = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated");
    const date = rawDate ? new Date(rawDate) : null;
    const publishedAt = date && Number.isFinite(date.getTime()) ? date : null;
    const summary = tag(block, "description") || tag(block, "summary") || tag(block, "content");
    const rawCategory = tag(block, "category").toLowerCase();
    const category = /tech|science|digital/.test(rawCategory) ? "TECHNOLOGY"
      : /business|market|finance|econom/.test(rawCategory) ? "BUSINESS"
      : /sport|football|cricket/.test(rawCategory) ? "SPORTS"
      : /health|medical/.test(rawCategory) ? "HEALTH"
      : /politic|government|world|nation/.test(rawCategory) ? "WORLD"
      : "GENERAL";
    return [{ title: title.slice(0, 300), url, guid: guid.slice(0, 1000), summary: summary || null, imageUrl: extractImage(block, feedUrl), category, publishedAt }];
  });
}

export type NewsCollectionResult = { sources: number; fetched: number; inserted: number; errors: number; images: number };

export async function collectNewsNow(): Promise<NewsCollectionResult> {
  const sources = await prisma.newsSource.findMany({
    where: { enabled: true }, orderBy: [{ lastFetchedAt: "asc" }, { id: "asc" }], take: MAX_FEEDS_PER_RUN,
  });
  const result: NewsCollectionResult = { sources: sources.length, fetched: 0, inserted: 0, errors: 0, images: 0 };

  for (const source of sources) {
    const now = new Date();
    try {
      const feedUrl = safeHttpUrl(source.feedUrl);
      if (!feedUrl) throw new Error("Feed URL must be a public HTTP(S) address.");
      const response = await fetch(feedUrl, {
        headers: { "user-agent": "FalvencoNewsBot/1.0 (+news feed reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
        signal: AbortSignal.timeout(8_000),
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
      const xml = await response.text();
      if (xml.length > 2_000_000) throw new Error("Feed is too large (over 2 MB).");
      const items = parseItems(xml, feedUrl);
      result.fetched += items.length;
      for (const item of items) {
        try {
          const existing = await prisma.newsArticle.findFirst({
            where: { OR: [{ url: item.url }, { sourceId: source.id, guid: item.guid }] },
            select: { id: true },
          });
          if (existing) continue;
          await prisma.newsArticle.create({ data: { ...item, sourceId: source.id } });
          result.inserted += 1;
        } catch (error) {
          // A duplicate can race with another collector; keep processing the remaining items.
          if (!(error instanceof Error) || !error.message.toLowerCase().includes("unique")) throw error;
        }
      }
      await prisma.newsSource.update({
        where: { id: source.id }, data: { lastFetchedAt: now, lastSuccessAt: now, lastError: null },
      });
    } catch (error) {
      result.errors += 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown feed error";
      await prisma.newsSource.update({
        where: { id: source.id }, data: { lastFetchedAt: now, lastError: message },
      });
    }
  }
  // Stories whose feed had no picture: look for the page's own preview image.
  try { result.images = await fillMissingImages(); } catch { /* pictures are a bonus: never fail the collector */ }
  return result;
}
