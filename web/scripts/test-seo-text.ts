// Test: page titles, descriptions and share-card data (SEO stage 2). Run:  npm run test:seo-text
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { cutText, noIndexMetadata, pageMetadata, pageTitle, summarize } from "../src/lib/seo-text";

function ok(name: string) { console.log("OK  " + name); }

// ---- cutText
assert.equal(cutText("  short   text \n here ", 50), "short text here");
assert.equal(cutText("one two three four five six", 15), "one two three…");
assert.equal(cutText("abcdefghijklmnopqrstuvwxyz", 10), "abcdefghi…", "no space to cut at: cut by characters");
assert.ok(Array.from(cutText("😀".repeat(30), 10)).length <= 10, "an emoji counts as one character and is never cut in half");
assert.ok(!cutText("😀".repeat(30), 10).includes("\uFFFD"));
assert.equal(Array.from(cutText("你好世界".repeat(20), 20)).length, 20);
assert.equal(cutText("", 10), "");
ok("cutText: whitespace, word ends, emoji and Chinese");

// ---- summarize
assert.equal(summarize("Look at https://example.com/a?b=1 for details"), "Look at for details");
assert.ok(Array.from(summarize("word ".repeat(100))).length <= 160);
assert.equal(summarize("https://only-a-link.com"), "");
ok("summarize: no web addresses, at most 160 characters");

// ---- pageTitle
assert.equal(pageTitle("How do I fix X?", "Falvenco"), "How do I fix X? | Falvenco");
assert.equal(pageTitle("", "Falvenco"), "Falvenco");
assert.ok(Array.from(pageTitle("a ".repeat(100), "Falvenco")).length <= 60 + " | Falvenco".length);
ok("pageTitle: brand name added, title limited to 60 characters");

// ---- pageMetadata
const m = pageMetadata({ path: "/post/5", title: "My question", siteName: "Falvenco", description: "Some body text https://x.com", type: "article" });
assert.equal(m.title, "My question | Falvenco");
assert.equal(m.description, "Some body text");
assert.deepEqual(m.alternates, { canonical: "/post/5" });
assert.equal((m.openGraph as { type: string }).type, "article");
assert.equal((m.openGraph as { url: string }).url, "/post/5");
assert.equal((m.twitter as { card: string }).card, "summary");
ok("pageMetadata: title, description, canonical address, share card");

const withImage = pageMetadata({ path: "/photos/2", title: "Sunset", siteName: "Falvenco", image: { url: "/api/photos/media/abc.webp", alt: "Sunset" } });
assert.equal((withImage.twitter as { card: string }).card, "summary_large_image");
assert.equal("description" in withImage, false, "no description given: none invented");
assert.deepEqual((withImage.openGraph as { images: unknown[] }).images, [{ url: "/api/photos/media/abc.webp", alt: "Sunset" }]);
ok("pageMetadata: a picture gives a large share card");

assert.deepEqual(noIndexMetadata, { robots: { index: false, follow: false } });
ok("noIndexMetadata keeps search engines away");
console.log("\nAll SEO text tests passed.");
