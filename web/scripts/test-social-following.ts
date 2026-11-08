// Test: the Following feed (SOCIAL_TODO 17). Run:  npm run test:social-following
// Needs no database: it tests the author list (social-following.ts) and the texts.
import assert from "node:assert/strict";
import { followingAuthorIds, MAX_FOLLOWING_IDS } from "../src/lib/social-following";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

// 1. yourself is always in the list (a new person who follows nobody still sees their own posts)
assert.deepEqual(followingAuthorIds("amy", []), ["amy"]);
ok("follow nobody: only yourself");

// 2. the people you follow come after, no duplicates, yourself only once
assert.deepEqual(followingAuthorIds("amy", ["bob", "cat", "bob", "amy"]), ["amy", "bob", "cat"]);
ok("followed people are added; duplicates and yourself are not repeated");

// 3. nobody logged in: nothing
assert.deepEqual(followingAuthorIds("", ["bob"]), []);
ok("no person: empty list");

// 4. junk ids are ignored
assert.deepEqual(followingAuthorIds("amy", ["", null as unknown as string, 5 as unknown as string, "bob"]), ["amy", "bob"]);
ok("empty or non-text ids are ignored");

// 5. the list never grows without limit
const many = Array.from({ length: MAX_FOLLOWING_IDS * 2 }, (_, i) => "u" + i);
const capped = followingAuthorIds("amy", many);
assert.ok(capped.length <= MAX_FOLLOWING_IDS + 1);
assert.equal(capped[0], "amy");
ok(`at most ${MAX_FOLLOWING_IDS} followed people are used`);

// 6. texts
const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
const keys = ["social.tabs.label", "social.tabs.all", "social.tabs.following", "social.following.title",
  "social.following.sub", "social.following.none", "social.following.quiet", "social.following.browse"];
for (const [lang, m] of Object.entries(languages)) {
  for (const k of keys) {
    assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
    assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
    if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
  }
}
ok("all 8 following-feed texts exist in six languages");

console.log("\nAll social following tests passed.");
