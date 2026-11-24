// The public address of the site, used by robots.txt, the sitemap and the page headers (SEO).
// ONE place to set it: SITE_URL in .env (and in the hosting settings), for example  SITE_URL=https://falvenco.com
// Nothing else in the code may type the address by hand.
const FALLBACK = "http://localhost:3000";

function parse(raw: string | undefined): URL | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** The address without a trailing slash and without a path ("https://falvenco.com"). Falls back to localhost when SITE_URL is missing or wrong. */
export function getSiteUrl(env: string | undefined = process.env.SITE_URL): string {
  return (parse(env) ?? new URL(FALLBACK)).origin;
}

/** A full address for a path on this site: absoluteUrl("/post/5") -> "https://falvenco.com/post/5". */
export function absoluteUrl(path: string, env: string | undefined = process.env.SITE_URL): string {
  return getSiteUrl(env) + (path.startsWith("/") ? path : "/" + path);
}

/**
 * True only when SITE_URL is a real public https address. Search engines are told to come in only then:
 * a test copy, a preview or a forgotten SITE_URL must never end up in Google.
 */
export function isSiteIndexable(env: string | undefined = process.env.SITE_URL): boolean {
  const url = parse(env);
  if (!url || url.protocol !== "https:") return false;
  const host = url.hostname;
  return !(host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local"));
}
