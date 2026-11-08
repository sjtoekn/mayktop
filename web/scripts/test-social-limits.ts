// Tests for the Social text checks and rate limits (SOCIAL_TODO 10). Run:  npm run test:social-limits
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { socialLimits } from "../src/config/site";
import { cleanSocialBody, SOCIAL_MAX_BODY } from "../src/lib/social-input";
import { checkRules, resetActionLimits, takeAction, type RateRule } from "../src/lib/social-limits";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

const MIN = 60_000;
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);

// ---- text checks ----
function body(input: unknown): string {
  const r = cleanSocialBody(input);
  assert.ok(r.ok, "expected the text to be accepted");
  return r.ok ? r.body : "";
}
function reason(input: unknown): string {
  const r = cleanSocialBody(input);
  assert.ok(!r.ok, "expected the text to be refused");
  return r.ok ? "" : r.reason;
}

assert.equal(reason(42), "type");
assert.equal(reason(null), "type");
assert.equal(reason(undefined), "type");
assert.equal(reason({ toString: () => "hi" }), "type");
ok("not a string -> refused");

assert.equal(reason(""), "empty");
assert.equal(reason("   \n\t  "), "empty");
assert.equal(reason("\u200B\u200B \u2060\uFEFF"), "empty");
assert.equal(reason("\u0000\u0007"), "empty");
ok("empty / only spaces / only invisible characters -> refused as empty");

assert.equal(body("  hello  "), "hello");
assert.equal(body("a\r\nb\rc"), "a\nb\nc");
assert.equal(body("a\u0000b\u0007c"), "abc");
assert.equal(body("a\tb"), "a\tb");
assert.equal(body("a\u202Eb\u2066c"), "abc");
assert.equal(body("a\n\n\n\n\n\nb"), "a\n\n\nb");
ok("trimmed; line endings fixed; control and bidi-override characters removed; tab kept; blank lines limited to two");

assert.equal(body("ආයුබෝවන් \u200D ශ්‍රී"), "ආයුබෝවන් \u200D ශ්‍රී");
assert.equal(body("مرحبا\u200F"), "مرحبا\u200F");
assert.equal(body("नमस्ते \u200C दुनिया"), "नमस्ते \u200C दुनिया");
assert.equal(body("🙂 emoji and 日本語"), "🙂 emoji and 日本語");
ok("Sinhala / Arabic / Hindi / emoji text is kept as it is (joiners and direction marks stay)");

assert.equal(body("x".repeat(SOCIAL_MAX_BODY)).length, SOCIAL_MAX_BODY);
assert.equal(reason("x".repeat(SOCIAL_MAX_BODY + 1)), "long");
assert.equal(reason("x".repeat(20_001)), "long");
assert.equal(body(" ".repeat(10) + "x".repeat(SOCIAL_MAX_BODY) + " ".repeat(10)).length, SOCIAL_MAX_BODY);
ok(`at most ${SOCIAL_MAX_BODY} characters (counted after cleaning)`);

// ---- checkRules ----
const rules: RateRule[] = [{ max: 3, windowMs: 10 * MIN }];
assert.deepEqual(checkRules([], rules, NOW), { ok: true });
assert.deepEqual(checkRules([NOW - MIN, NOW - 2 * MIN], rules, NOW), { ok: true });
ok("below the limit -> allowed");

const full = checkRules([NOW - MIN, NOW - 2 * MIN, NOW - 3 * MIN], rules, NOW);
assert.equal(full.ok, false);
assert.equal(!full.ok && full.retryAfterMs, 7 * MIN);
ok("at the limit -> refused; wait = until the OLDEST event leaves the window (7 min here)");

assert.deepEqual(checkRules([NOW - 11 * MIN, NOW - 12 * MIN, NOW - 13 * MIN], rules, NOW), { ok: true });
assert.deepEqual(checkRules([NOW - 10 * MIN, NOW - 11 * MIN, NOW - 20 * MIN], rules, NOW), { ok: true });
ok("events older than the window do not count (exactly at the edge = left)");

const over = checkRules([NOW - 1 * MIN, NOW - 2 * MIN, NOW - 3 * MIN, NOW - 4 * MIN, NOW - 5 * MIN], rules, NOW);
assert.equal(over.ok, false);
// 5 events, limit 3: three of them (the ones 5, 4 and 3 minutes old) must leave before there is room for one more,
// and the last of those three leaves 7 minutes from now.
assert.equal(!over.ok && over.retryAfterMs, 7 * MIN);
ok("more events than the limit (e.g. posts from before the limit existed): wait until there is room for ONE more");

const two: RateRule[] = [{ max: 5, windowMs: 10 * MIN }, { max: 30, windowMs: 24 * 60 * MIN }];
const many = Array.from({ length: 30 }, (_, i) => NOW - (60 + i) * MIN); // 30 posts, spread over the last day
const day = checkRules(many, two, NOW);
assert.equal(day.ok, false);
assert.equal(!day.ok && day.retryAfterMs, 24 * 60 * MIN - 89 * MIN);
ok("two rules: the daily rule can refuse even when the 10-minute rule is free");

const both = checkRules([NOW - MIN, NOW - MIN, NOW - MIN, NOW - MIN, NOW - MIN], two, NOW);
assert.equal(both.ok, false);
assert.equal(!both.ok && both.retryAfterMs, 9 * MIN);
ok("two rules: wait = the longest of the full rules");

// ---- takeAction (in memory) ----
resetActionLimits();
const likeRule: RateRule[] = [{ max: 3, windowMs: 60_000 }];
assert.equal(takeAction("like:u1", likeRule, NOW).ok, true);
assert.equal(takeAction("like:u1", likeRule, NOW + 1000).ok, true);
assert.equal(takeAction("like:u1", likeRule, NOW + 2000).ok, true);
const fourth = takeAction("like:u1", likeRule, NOW + 3000);
assert.equal(fourth.ok, false);
assert.equal(!fourth.ok && fourth.retryAfterMs, 57_000);
ok("the 4th action inside the window is refused");

assert.equal(takeAction("like:u2", likeRule, NOW + 3000).ok, true);
ok("another person has their own count");

assert.equal(takeAction("like:u1", likeRule, NOW + 3500).ok, false);
assert.equal(takeAction("like:u1", likeRule, NOW + 60_001).ok, true);
ok("a refused action is not counted, and after the window the person can act again");

resetActionLimits();
for (let i = 0; i < 6000; i++) takeAction(`like:bulk${i}`, likeRule, NOW);
assert.equal(takeAction("like:late", likeRule, NOW + 10 * MIN).ok, true);
ok("many people tracked: the memory is cleaned up (no error)");

// ---- the numbers in the config ----
assert.ok(socialLimits.posts.length >= 1);
for (const r of socialLimits.posts) {
  assert.ok(Number.isInteger(r.max) && r.max >= 1, "posts.max must be a whole number >= 1");
  assert.ok(r.windowMinutes >= 1, "posts.windowMinutes must be >= 1");
}
assert.ok(Number.isInteger(socialLimits.likes.max) && socialLimits.likes.max >= 1);
assert.ok(socialLimits.likes.windowSeconds >= 1);
const sorted = [...socialLimits.posts].sort((a, b) => a.windowMinutes - b.windowMinutes);
for (let i = 1; i < sorted.length; i++) {
  assert.ok(sorted[i].max >= sorted[i - 1].max, "a longer window must allow at least as many posts as a shorter one");
}
ok("socialLimits in src/config/site.ts has sensible numbers");

// ---- the texts (all six languages) ----
const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
for (const [lang, messages] of Object.entries(languages)) {
  for (const k of ["social.form.invalid", "social.form.toomany", "social.like.toomany"]) {
    assert.equal(typeof messages[k], "string", `${lang}: missing ${k}`);
    assert.ok((messages[k] as string).trim().length > 0, `${lang}: ${k} is empty`);
    if (lang !== "en") assert.notEqual(messages[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is still English`);
  }
  assert.ok((messages["social.form.toomany"] as string).includes("{minutes}"), `${lang}: social.form.toomany lost {minutes}`);
}
ok("the 3 new texts exist in all six languages, and {minutes} is kept");

console.log("\nAll Social limit tests passed.");
