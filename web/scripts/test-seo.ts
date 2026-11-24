// Test: SITE_URL handling, sitemap list and robots rules (SEO stage 1). Run:  npm run test:seo
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { absoluteUrl, getSiteUrl, isSiteIndexable } from "../src/lib/site-url";
import { buildSitemapEntries, robotsAllow, robotsDisallow, SITEMAP_LIMIT_PER_KIND, staticSitemapPaths } from "../src/lib/seo-rules";

function ok(name: string) { console.log("OK  " + name); }

// ---- SITE_URL
assert.equal(getSiteUrl("https://falvenco.com"), "https://falvenco.com");
assert.equal(getSiteUrl("https://falvenco.com/"), "https://falvenco.com");
assert.equal(getSiteUrl("  https://falvenco.com/some/path?x=1  "), "https://falvenco.com");
assert.equal(getSiteUrl(undefined), "http://localhost:3000");
assert.equal(getSiteUrl(""), "http://localhost:3000");
assert.equal(getSiteUrl("falvenco.com"), "http://localhost:3000", "an address without https:// is refused (falls back)");
assert.equal(getSiteUrl("javascript:alert(1)"), "http://localhost:3000");
ok("getSiteUrl cleans the address and falls back to localhost");

assert.equal(absoluteUrl("/post/5", "https://falvenco.com/"), "https://falvenco.com/post/5");
assert.equal(absoluteUrl("post/5", "https://falvenco.com"), "https://falvenco.com/post/5");
ok("absoluteUrl joins the address and the path with exactly one slash");

assert.equal(isSiteIndexable("https://falvenco.com"), true);
assert.equal(isSiteIndexable("http://falvenco.com"), false, "plain http is not indexable");
assert.equal(isSiteIndexable(undefined), false);
assert.equal(isSiteIndexable("https://localhost:3000"), false);
assert.equal(isSiteIndexable("https://127.0.0.1"), false);
assert.equal(isSiteIndexable("https://macmini.local"), false);
ok("search engines are let in only for a real https address");

// ---- sitemap
const base = "https://falvenco.com";
const entries = buildSitemapEntries(base, {
  communities: [{ slug: "learning", ms: 1_700_000_000_000 }, { slug: "a b", ms: 1_700_000_000_000 }],
  posts: [{ id: 7, ms: 1_700_000_000_000 }],
  photos: [{ id: 3, ms: 1_700_000_000_000 }],
  places: [{ id: 2, ms: 1_700_000_000_000 }],
});
const urls = entries.map((e) => e.url);
assert.ok(urls.includes(base + "/"));
assert.ok(urls.includes(base + "/c/learning"));
assert.ok(urls.includes(base + "/c/a%20b"), "a slug is encoded");
assert.ok(urls.includes(base + "/post/7"));
assert.ok(urls.includes(base + "/photos/3"));
assert.ok(urls.includes(base + "/places/2"));
assert.equal(new Set(urls).size, urls.length, "no address twice");
assert.equal(urls.length, staticSitemapPaths.length + 5);
assert.ok(urls.every((u) => u.startsWith(base + "/")));
assert.ok(entries.find((e) => e.url.endsWith("/post/7"))?.lastModified instanceof Date);
ok("the sitemap lists the fixed pages, communities, posts, photos and places once each");

const many = buildSitemapEntries(base, {
  communities: [],
  posts: Array.from({ length: SITEMAP_LIMIT_PER_KIND + 50 }, (_, i) => ({ id: i + 1, ms: 0 })),
  photos: [],
  places: [],
});
assert.equal(many.length, staticSitemapPaths.length + SITEMAP_LIMIT_PER_KIND);
ok("one kind never goes over the limit");

// ---- robots
for (const path of ["/admin", "/api/", "/settings", "/login", "/signup", "/submit"]) {
  assert.ok((robotsDisallow as readonly string[]).includes(path), `${path} must be closed to search engines`);
}
assert.ok(!(robotsDisallow as readonly string[]).includes("/"), "the whole site must not be closed");
assert.ok((robotsAllow as readonly string[]).includes("/api/photos/media/"));
for (const path of staticSitemapPaths) {
  const closed = (robotsDisallow as readonly string[]).some((d) => path !== "/" && path.startsWith(d));
  assert.ok(!closed, `${path} is in the sitemap but closed in robots`);
}
ok("robots closes private pages and never closes a page that the sitemap lists");
console.log("\nAll SEO tests passed.");
