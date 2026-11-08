// Tests for the stricter limits of new accounts (SOCIAL_TODO C2, part 2). Run:  npm run test:new-account
// Needs no database. Stops at the first failure.
import assert from "node:assert/strict";
import { newAccountLimits, socialLimits, socialReplyConfig, socialReportConfig } from "../src/config/site";
import { isNewAccount, rulesForAccount } from "../src/lib/new-account-rules";
import { checkRules, type RateRule } from "../src/lib/social-limits";

function ok(name: string) { console.log("OK  " + name); }

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const cfg = { days: 7, factor: 0.5 };
const rules: RateRule[] = [{ max: 5, windowMs: 10 * 60_000 }, { max: 30, windowMs: DAY }];

// ---- who is new
assert.equal(isNewAccount(NOW - 1 * DAY, cfg, NOW), true);
assert.equal(isNewAccount(NOW - 6.9 * DAY, cfg, NOW), true);
assert.equal(isNewAccount(NOW - 7 * DAY, cfg, NOW), false); // exactly 7 days old = no longer new
assert.equal(isNewAccount(NOW - 400 * DAY, cfg, NOW), false);
assert.equal(isNewAccount(NOW, cfg, NOW), true); // created just now
ok("younger than 7 days = new; 7 days or more = not new");

assert.equal(isNewAccount(undefined, cfg, NOW), false);
assert.equal(isNewAccount(null, cfg, NOW), false);
assert.equal(isNewAccount(Number.NaN, cfg, NOW), false);
assert.equal(isNewAccount(NOW + DAY, cfg, NOW), false); // a time in the future (clock difference) never blocks anybody
ok("unknown or impossible creation time counts as not new (never blocks by mistake)");

// ---- the rules
assert.deepEqual(rulesForAccount(rules, NOW - 400 * DAY, cfg, NOW), rules);
const strict = rulesForAccount(rules, NOW - DAY, cfg, NOW);
assert.deepEqual(strict, [{ max: 2, windowMs: 10 * 60_000 }, { max: 15, windowMs: DAY }]);
assert.equal(rules[0].max, 5); // the original list is not changed
ok("new account gets half (rounded down); an old account gets the same list; the original is untouched");

assert.deepEqual(rulesForAccount([{ max: 1, windowMs: 1000 }], NOW, cfg, NOW), [{ max: 1, windowMs: 1000 }]);
assert.deepEqual(rulesForAccount([{ max: 3, windowMs: 1000 }], NOW, { days: 7, factor: 0.1 }, NOW), [{ max: 1, windowMs: 1000 }]);
ok("a limit is never lower than 1 (a new person can still do the action once)");

// ---- effect on a real check
const times = [NOW - 1000, NOW - 2000]; // 2 posts in the last 10 minutes
assert.equal(checkRules(times, rules, NOW).ok, true); // old account: 2 of 5, fine
const r = checkRules(times, strict, NOW); // new account: 2 of 2, full
assert.equal(r.ok, false);
ok("2 posts in 10 minutes: allowed for an old account, refused for a new one");

// ---- the real numbers in site.ts
assert.ok(newAccountLimits.days >= 1 && newAccountLimits.days <= 30);
assert.ok(newAccountLimits.factor > 0 && newAccountLimits.factor < 1);
const real: RateRule[][] = [
  socialLimits.posts.map((x) => ({ max: x.max, windowMs: x.windowMinutes * 60_000 })),
  socialReplyConfig.limits.map((x) => ({ max: x.max, windowMs: x.windowMinutes * 60_000 })),
  socialLimits.follows.map((x) => ({ max: x.max, windowMs: x.windowSeconds * 1000 })),
  socialLimits.reposts.map((x) => ({ max: x.max, windowMs: x.windowSeconds * 1000 })),
  socialReportConfig.reports.map((x) => ({ max: x.max, windowMs: x.windowSeconds * 1000 })),
  [{ max: socialLimits.likes.max, windowMs: socialLimits.likes.windowSeconds * 1000 }],
];
for (const list of real) {
  const s = rulesForAccount(list, NOW, newAccountLimits, NOW);
  s.forEach((rule, i) => { assert.ok(rule.max >= 1 && rule.max <= list[i].max); });
}
const p = rulesForAccount(real[0], NOW, newAccountLimits, NOW);
console.log("    new account posts:", p.map((x) => `${x.max} per ${x.windowMs / 60_000} min`).join(", "));
ok("the real numbers in site.ts give sensible smaller limits");

console.log("\nAll new-account checks passed.");
