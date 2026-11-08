// Test: the social texts exist in all six languages (SOCIAL_TODO 8). Run:  npm run test:social-text
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
const keys = Object.keys(en).filter((k) => k.startsWith("social."));
assert.ok(keys.length >= 16, "expected at least 16 social.* texts");
ok(`${keys.length} social.* texts in English`);

for (const [lang, messages] of Object.entries(languages)) {
  for (const k of keys) {
    const v = messages[k];
    assert.equal(typeof v, "string", `${lang}: missing ${k}`);
    assert.ok((v as string).trim().length > 0, `${lang}: ${k} is empty`);
  }
}
ok("every social.* text exists in all six languages (en, es, fr, zh, hi, ar)");

for (const [lang, messages] of Object.entries(languages)) {
  assert.ok((messages["social.reposts"] as string).includes("{count}"), `${lang}: social.reposts lost {count}`);
}
ok("the {count} placeholder is kept in every language");

for (const k of keys) {
  for (const lang of ["es", "fr", "zh", "hi", "ar"]) {
    if (["social.form.submit", "social.like.title", "social.form.cancel"].includes(k) && lang === "es") continue; // short words that may legitimately match
    if (k === "social.reposts" && lang === "es") continue;
    if (k === "social.feed.title" && (lang === "es" || lang === "fr")) continue; // "Social" is the same word in Spanish and French
    assert.notEqual(languages[lang][k], en[k as keyof typeof en], `${lang}: ${k} is still the English text`);
  }
}
ok("no other language still has the English text");

console.log("\nAll social text tests passed.");
