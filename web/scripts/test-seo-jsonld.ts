// Test: structured data of a post page (SEO stage 3). Run:  npm run test:seo-jsonld
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { jsonLdString, postJsonLd } from "../src/lib/seo-jsonld";

function ok(name: string) { console.log("OK  " + name); }
const ENV = "https://falvenco.com";

// ---- jsonLdString
const evil = jsonLdString({ a: "</script><script>alert(1)</script> & more", b: "x\u2028y" });
assert.ok(!evil.includes("<") && !evil.includes(">") && !evil.includes("&"), "no tag characters in the output");
assert.ok(!evil.includes("\u2028"));
assert.deepEqual(JSON.parse(evil), { a: "</script><script>alert(1)</script> & more", b: "x\u2028y" }, "the data comes back unchanged");
ok("jsonLdString: a post can never close the script tag");

// ---- postJsonLd
const ld = postJsonLd({ id: 5, title: "How do I fix X?", body: "Look at https://example.com/a first.", author: "maya", createdAtMs: Date.UTC(2026, 10, 24, 5, 0, 0), comments: 3 }, ENV);
assert.equal(ld["@type"], "DiscussionForumPosting");
assert.equal(ld.url, "https://falvenco.com/post/5");
assert.equal(ld.headline, "How do I fix X?");
assert.equal(ld.text, "Look at first.", "web addresses are left out of the text");
assert.equal(ld.datePublished, "2026-11-24T05:00:00.000Z");
assert.deepEqual(ld.author, { "@type": "Person", name: "maya", url: "https://falvenco.com/u/maya" });
assert.deepEqual(ld.interactionStatistic, { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: 3 });
ok("postJsonLd: type, address, title, text, date, author, comment count");

const noAuthor = postJsonLd({ id: 6, title: "T", body: "", author: "", createdAtMs: 0, comments: 0 }, ENV);
assert.equal("author" in noAuthor, false, "no author given: none invented");
assert.equal("text" in noAuthor, false, "no text given: none invented");
ok("postJsonLd: nothing is invented");

const long = postJsonLd({ id: 7, title: "word ".repeat(80), body: "w ".repeat(1000), author: "a", createdAtMs: 0, comments: 0 }, ENV);
assert.ok(Array.from(String(long.headline)).length <= 110);
assert.ok(Array.from(String(long.text)).length <= 500);
ok("postJsonLd: long title and text are cut");
console.log("\nAll SEO structured-data tests passed.");
