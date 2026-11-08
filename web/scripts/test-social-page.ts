// Test: the single Social post page (SOCIAL_TODO 14). Run:  npm run test:social-page
// Needs no database: checks the address parser, the texts, and (by reading the page source) that the page keeps the
// "logged-in people only" rules of PROJECT.md 8j point 11.
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseSocialPostId } from "../src/lib/social-id";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

for (const [raw, id] of [["1", 1], ["12", 12], ["2147483647", 2147483647]] as const) assert.equal(parseSocialPostId(raw), id);
for (const raw of ["0", "-1", "012", "1.5", "1e3", " 12", "12 ", "+12", "abc", "", "2147483648", "99999999999", "١٢"]) {
  assert.equal(parseSocialPostId(raw), null, `should refuse ${JSON.stringify(raw)}`);
}
for (const raw of [undefined, null, 12, ["12"]]) assert.equal(parseSocialPostId(raw), null);
ok("post numbers: only plain whole numbers 1 to 2147483647 are accepted (one address per post)");

const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
for (const [lang, m] of Object.entries(languages)) {
  for (const k of ["social.post.back", "social.share.copied"]) {
    assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
    assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
    if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
  }
}
ok("the 2 new texts exist in six languages");

const page = fs.readFileSync("src/app/(site)/social/[id]/page.tsx", "utf8");
const meta = page.slice(page.indexOf("export const metadata"), page.indexOf("export default"));
assert.ok(!/generateMetadata/.test(page), "page title must not be made from the post");
assert.ok(/title: t\("social\.label"\)/.test(meta) && /index: false/.test(meta));
ok("page title is the plain words 'Social post' (never the post text) and the page is noindex");
assert.ok(page.indexOf("if (!viewer)") < page.indexOf("getSocialPost("), "the post must be read only after the login check");
ok("a visitor gets the login message before any post is read");

console.log("\nAll social page tests passed.");
