// Tests for the "n new posts" banner rules (SOCIAL_TODO B4). Run:  npm run test:social-new-posts
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { clampNewCount, newestMs, NEW_POSTS_CAP, NEW_POSTS_POLL_MS, parseNewPostsFeed, parseSince } from "../src/lib/social-new-posts";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";
import { tn, t } from "../src/i18n";

function ok(name: string) { console.log("OK  " + name); }

assert.equal(parseNewPostsFeed("all"), "all");
assert.equal(parseNewPostsFeed("following"), "following");
assert.equal(parseNewPostsFeed("home"), null);
assert.equal(parseNewPostsFeed(["all"]), null);
assert.equal(parseNewPostsFeed(null), null);
ok("feed: only all and following");

assert.equal(parseSince("1762560000000"), 1762560000000);
assert.equal(parseSince("0"), 0);
assert.equal(parseSince(""), null);
assert.equal(parseSince("-5"), null);
assert.equal(parseSince("12.5"), null);
assert.equal(parseSince("1e12"), null);
assert.equal(parseSince("12 "), null);
assert.equal(parseSince("1".repeat(16)), null);
assert.equal(parseSince(123), null);
assert.equal(parseSince(null), null);
ok("since: digits only, at most 15");

assert.equal(newestMs([], 777), 777);
assert.equal(newestMs([{ createdAtMs: 5 }, { createdAtMs: 9 }, { createdAtMs: 7 }], 777), 9);
assert.equal(newestMs([{ createdAtMs: 0 }], 777), 777);
ok("newest item time (or the request time when the page is empty)");

assert.equal(clampNewCount(-3), 0);
assert.equal(clampNewCount(NaN), 0);
assert.equal(clampNewCount(Infinity), 0);
assert.equal(clampNewCount(3.9), 3);
assert.equal(clampNewCount(5000), NEW_POSTS_CAP);
ok("count is a whole number from 0 to the cap");

assert.ok(NEW_POSTS_POLL_MS >= 30_000, "do not ask more than twice a minute");
assert.ok(socialLimits.newPosts.length >= 1);
for (const rule of socialLimits.newPosts) assert.ok(rule.max > 0 && rule.windowSeconds > 0);
const perMinute = socialLimits.newPosts.find((rule) => rule.windowSeconds === 60);
assert.ok(perMinute && perMinute.max >= 4, "one open tab asks once a minute; a few tabs must fit");
ok("poll interval and rate limit are sensible");

assert.equal(tn("social.new.posts", 1, "en"), "1 new post");
assert.equal(tn("social.new.posts", 3, "en"), "3 new posts");
assert.equal(tn("social.new.posts", 3, "zh"), "3 条新动态");
assert.ok(tn("social.new.posts", 2, "ar").includes("منشوران"));
assert.equal(t("social.new.overflow", undefined, "en"), "99+ new posts");
ok("labels, including plural forms");

const keys = Object.keys(en).filter((k) => k.startsWith("social.new."));
assert.ok(keys.length >= 3);
for (const [name, dict] of Object.entries({ es, fr, zh, hi, ar }) as [string, Record<string, string>][]) {
  assert.ok(dict["social.new.overflow"], `${name} is missing social.new.overflow`);
  assert.ok(dict["social.new.posts.other"], `${name} is missing social.new.posts.other`);
}
ok("the texts exist in all six languages");

console.log("\nAll new-posts tests passed.");
