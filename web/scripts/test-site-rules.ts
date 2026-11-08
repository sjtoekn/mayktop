// Tests for the site-wide rule list (SOCIAL_TODO 2a). Run:  npm run test:rules
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { staffConfig } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

const keys = staffConfig.siteRules.map((r) => r.key);
assert.deepEqual([...keys].sort(), ["ABUSE", "HARASSMENT", "HATE", "ILLEGAL", "IMPERSONATION", "PRIVACY", "SPAM"]);
assert.equal(new Set(keys).size, keys.length);
ok("the site-wide list has exactly the 7 decided rules, no duplicates");

const serious = (k: string) => staffConfig.siteRules.find((r) => r.key === k)?.serious;
for (const k of ["HARASSMENT", "HATE", "ILLEGAL", "PRIVACY"]) assert.equal(serious(k), true, k);
for (const k of ["SPAM", "ABUSE", "IMPERSONATION"]) assert.equal(serious(k), false, k);
ok("serious (ban allowed at once): HARASSMENT, HATE, ILLEGAL, PRIVACY; the ladder applies to SPAM, ABUSE, IMPERSONATION");

const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
for (const [lang, messages] of Object.entries(languages)) {
  for (const k of keys) {
    const text = messages[`siteRule.${k}`];
    assert.equal(typeof text, "string", `${lang}: missing siteRule.${k}`);
    assert.ok((text as string).trim().length >= 10, `${lang}: siteRule.${k} is empty or too short`);
  }
}
ok("every rule has a text in all six languages (en, es, fr, zh, hi, ar)");

for (const k of ["PRIVACY", "IMPERSONATION"]) {
  const texts = Object.values(languages).map((m) => m[`siteRule.${k}`]);
  assert.equal(new Set(texts).size, 6, `${k}: two languages share the same text`);
}
ok("the 2 new rules are really translated (no language repeats another's text)");

console.log("\nAll site-rule tests passed.");
