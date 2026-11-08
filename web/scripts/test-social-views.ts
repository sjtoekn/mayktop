// Tests for the Social view count rules (SOCIAL_TODO B5). Run:  npm run test:social-views
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import {
  firstViewInWindow,
  parsePostId,
  resetViewMemory,
  viewMemorySize,
  VIEW_SEEN_HOURS,
  VIEW_SEEN_MAX,
  VIEW_SEEN_SWEEP_AT,
  VIEW_VISIBLE_MS,
} from "../src/lib/social-views";
import { checkRules } from "../src/lib/social-limits";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";
import { formatCompact, t, tn } from "../src/i18n";

function ok(name: string) { console.log("OK  " + name); }
const HOUR = 60 * 60 * 1000;

assert.equal(parsePostId(12), 12);
assert.equal(parsePostId(1), 1);
for (const bad of [0, -1, 1.5, NaN, Infinity, "12", null, undefined, {}, [12], 2 ** 60]) assert.equal(parsePostId(bad), null);
ok("post id: a whole number from 1, nothing else");

resetViewMemory();
const t0 = 1_762_560_000_000;
assert.equal(firstViewInWindow("u1", 5, t0), true);
assert.equal(firstViewInWindow("u1", 5, t0 + 1000), false);
assert.equal(firstViewInWindow("u1", 5, t0 + 23 * HOUR), false);
assert.equal(firstViewInWindow("u1", 5, t0 + VIEW_SEEN_HOURS * HOUR), true);
ok("the same person counts once per post per 24 hours (a refresh adds nothing)");

resetViewMemory();
assert.equal(firstViewInWindow("u1", 5, t0), true);
assert.equal(firstViewInWindow("u2", 5, t0), true);
assert.equal(firstViewInWindow("u1", 6, t0), true);
assert.equal(firstViewInWindow("u1", 5, t0), false);
ok("another person, or another post, is a separate view");

resetViewMemory();
for (let i = 0; i < VIEW_SEEN_SWEEP_AT + 10; i++) firstViewInWindow("u" + i, 1, t0);
assert.ok(viewMemorySize() <= VIEW_SEEN_MAX);
// after the window has passed, a new view sweeps the expired entries away
firstViewInWindow("late", 1, t0 + 25 * HOUR);
assert.equal(viewMemorySize(), 1);
ok("memory is swept, and never grows without a limit");

assert.ok(VIEW_VISIBLE_MS >= 500 && VIEW_VISIBLE_MS <= 3000, "a view needs a real moment on screen");
ok("a view needs a moment on screen");

assert.ok(socialLimits.views.length >= 1);
for (const rule of socialLimits.views) assert.ok(rule.max > 0 && rule.windowSeconds > 0);
const rules = socialLimits.views.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
const burst = Array.from({ length: 50 }, (_, i) => t0 + i * 100); // scrolling past 50 posts in 5 seconds is normal
assert.equal(checkRules(burst, rules, t0 + 5000).ok, true);
const flood = Array.from({ length: 5000 }, (_, i) => t0 + i); // a script
assert.equal(checkRules(flood, rules, t0 + 5000).ok, false);
ok("rate limit: normal scrolling passes, a script is stopped");

assert.equal(tn("social.views", 1, "en"), "1 view");
assert.equal(tn("social.views", 1280, "en"), "1,280 views");
assert.equal(tn("social.views", 3, "zh"), "3 次浏览");
assert.ok(tn("social.views", 2, "ar").includes("مشاهدتان"));
assert.ok(t("social.views.title", undefined, "en").length > 20);
assert.equal(formatCompact(1280, "en"), "1.3K");
assert.equal(formatCompact(950, "en"), "950");
ok("labels, plural forms and the short number");

assert.ok(en["social.views.other"] && en["social.views.one"] && en["social.views.title"]);
for (const [name, dict] of Object.entries({ es, fr, zh, hi, ar }) as [string, Record<string, string>][]) {
  assert.ok(dict["social.views.other"], `${name} is missing social.views.other`);
  assert.ok(dict["social.views.title"], `${name} is missing social.views.title`);
}
ok("the texts exist in all six languages");

console.log("\nAll view-count tests passed.");
