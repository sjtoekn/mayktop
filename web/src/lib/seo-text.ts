// Page titles, descriptions and share-card data for single pages (SEO stage 2). Pure code (no database): npm run test:seo-text
import type { Metadata } from "next";

/** Cuts a text to at most `max` characters (an emoji or a Chinese character counts as one), at a word end when there is one, with "…". */
export function cutText(text: string, max: number): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, Math.max(1, max - 1));
  const lastSpace = head.lastIndexOf(" ");
  const cutAt = lastSpace >= Math.floor(max * 0.6) ? lastSpace : head.length;
  return head.slice(0, cutAt).join("").replace(/[\s,;:.\-–—]+$/u, "") + "…";
}

/** The text under the title in Google: web addresses left out, one line, about 160 characters. */
export function summarize(text: string, max = 160): string {
  return cutText(text.replace(/https?:\/\/\S+/gi, " "), max);
}

/** "My question | Falvenco". An empty title gives just the site name. */
export function pageTitle(title: string, siteName: string, max = 60): string {
  const cut = cutText(title, max);
  return cut ? `${cut} | ${siteName}` : siteName;
}

/** For a page that must not be in search engines (missing, hidden, erased or private content). */
export const noIndexMetadata: Metadata = { robots: { index: false, follow: false } };

export type PageMetaInput = {
  /** The page's own address, starting with "/" (its ONE canonical address, so ?x=1 variants do not count as other pages). */
  path: string;
  title: string;
  siteName: string;
  description?: string;
  image?: { url: string; alt?: string };
  type?: "website" | "article";
};

const BRAND_LOGO = "/brand/falvenco-logo.png"; // public/brand/falvenco-logo.png (219x224)
const BRAND_IMAGE = (alt: string) => ({ url: BRAND_LOGO, width: 219, height: 224, alt });

export function pageMetadata(input: PageMetaInput): Metadata {
  const title = pageTitle(input.title, input.siteName);
  const description = input.description ? summarize(input.description) : "";
  const desc = description ? { description } : {};
  return {
    title,
    ...desc,
    alternates: { canonical: input.path },
    openGraph: {
      type: input.type ?? "website",
      siteName: input.siteName,
      title,
      ...desc,
      url: input.path,
      images: [input.image ?? BRAND_IMAGE(input.siteName)], // a page without its own picture shows the site logo in share cards
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title,
      ...desc,
      images: [input.image?.url ?? BRAND_LOGO],
    },
  };
}
