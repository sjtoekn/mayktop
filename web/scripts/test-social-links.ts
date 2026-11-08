// Test: web addresses and YouTube in Social posts (patch-social-links). Run:  npm run test:social-links
// Needs no database: plain functions only.
import assert from "node:assert/strict";
import { cleanTypedLink, findPostLink, parseYouTube, splitLinks, youTubeEmbedSrc } from "../src/lib/social-links";

let n = 0;
const ok = (name: string) => console.log(`ok ${++n} ${name}`);
const ID = "dQw4w9WgXcQ";

// --- YouTube forms
for (const href of [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}&list=PL123`,
  `https://m.youtube.com/watch?v=${ID}`,
  `https://music.youtube.com/watch?v=${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube.com/live/${ID}`,
  `http://www.youtube-nocookie.com/embed/${ID}`,
]) assert.equal(parseYouTube(href)?.id, ID, href);
ok("YouTube: watch, youtu.be, shorts, embed, live, music, mobile");

for (const href of [
  "https://www.youtube.com/playlist?list=PL123",
  "https://www.youtube.com/@somechannel",
  "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/watch?v=" + ID + "x",
  "https://www.youtube.com/watch?v=<script>",
  "https://youtube.com.evil.example/watch?v=" + ID,
  "https://notyoutube.com/watch?v=" + ID,
  "https://youtu.be.evil.example/" + ID,
  "javascript:alert(1)",
  "ftp://youtube.com/watch?v=" + ID,
  "https://user:pw@www.youtube.com/watch?v=" + ID,
]) assert.equal(parseYouTube(href), null, href);
ok("YouTube: other addresses, bad ids, look-alike hosts, other schemes are NOT videos");

assert.equal(parseYouTube(`https://youtu.be/${ID}?t=90`)?.start, 90);
assert.equal(parseYouTube(`https://youtu.be/${ID}?t=1m30s`)?.start, 90);
assert.equal(parseYouTube(`https://youtu.be/${ID}?t=1h1m1s`)?.start, 3661);
assert.equal(parseYouTube(`https://www.youtube.com/watch?v=${ID}&start=12`)?.start, 12);
assert.equal(parseYouTube(`https://youtu.be/${ID}?t=abc`)?.start, 0);
assert.equal(parseYouTube(`https://youtu.be/${ID}?t=999999999`)?.start, 0);
ok("start time: 90, 90s, 1m30s, 1h1m1s, start=; nonsense = 0");

// --- the player address
assert.equal(youTubeEmbedSrc(ID, 0, false), `https://www.youtube-nocookie.com/embed/${ID}?rel=0&playsinline=1`);
assert.equal(youTubeEmbedSrc(ID, 90, true), `https://www.youtube-nocookie.com/embed/${ID}?rel=0&playsinline=1&autoplay=1&start=90`);
assert.equal(youTubeEmbedSrc("x\"onload=1", 0, false), "");
ok("player address: only a checked id goes in");

// --- finding addresses in text
const text = `Look: https://example.com/a_(b), and (see https://example.org/x). Done! http://localhost/x javascript:alert(1) https://nodot`;
const parts = splitLinks(text);
assert.equal(parts.map((p) => p.text).join(""), text);
assert.deepEqual(parts.filter((p) => p.kind === "url").map((p) => p.text), ["https://example.com/a_(b)", "https://example.org/x"]);
ok("splitLinks: trailing signs stay out, balanced brackets stay in, no-dot hosts and other schemes ignored, text is lossless");

assert.equal(splitLinks("no address here").length, 1);
assert.equal(splitLinks("").length, 0);
assert.equal(splitLinks("https://" + "a".repeat(2100) + ".com").some((p) => p.kind === "url"), false);
assert.equal(splitLinks("https://google.com@evil.example/x").some((p) => p.kind === "url"), false);
ok("splitLinks: none, empty, too long, user:password");

// --- what to show
assert.deepEqual(findPostLink("hi"), null);
const yt = findPostLink(`Great video https://youtu.be/${ID}?t=5 and https://example.com`);
assert.equal(yt?.kind, "youtube");
assert.equal(yt?.kind === "youtube" && yt.start, 5);
const card = findPostLink("read https://www.example.com/news/2026/11/story?id=1 now");
assert.equal(card?.kind, "link");
assert.equal(card?.kind === "link" && card.host, "example.com");
assert.equal(card?.kind === "link" && card.shown, "example.com/news/2026/11/story");
const first = findPostLink(`https://example.com then https://youtu.be/${ID}`);
assert.equal(first?.kind, "link"); // the FIRST address decides
ok("findPostLink: none, YouTube, link card, the first address decides");

// --- the "Add a link" field
assert.equal(cleanTypedLink("  example.com/page "), "https://example.com/page");
assert.equal(cleanTypedLink("http://example.com"), "http://example.com/");
assert.equal(cleanTypedLink("two words.com"), null);
assert.equal(cleanTypedLink("javascript:alert(1)"), null);
assert.equal(cleanTypedLink("localhost"), null);
assert.equal(cleanTypedLink(""), null);
ok("typed link: scheme added, spaces / other schemes / no dot refused");

console.log("\nAll social-links checks passed.");
