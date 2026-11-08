// Tests for "the same text again" (SOCIAL_TODO C2, part 3). Run:  npm run test:social-duplicate
// Needs no database. Stops at the first failure.
import assert from "node:assert/strict";
import { socialDuplicate } from "../src/config/site";
import { isRepeat, normalizeForCompare } from "../src/lib/social-duplicate";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }
const MIN = 12;

// ---- what counts as "the same"
assert.equal(normalizeForCompare("Buy NOW!!"), normalizeForCompare("buy   now"));
assert.equal(normalizeForCompare("Hello,\n\nworld"), "helloworld");
assert.equal(normalizeForCompare("a\u200Bb\u200Dc"), "abc"); // zero-width characters ignored
assert.equal(normalizeForCompare("Ｈｅｌｌｏ"), "hello"); // full-width letters
assert.equal(normalizeForCompare("🙂 hi 🙂"), "hi");
ok("capital letters, spaces, line breaks, punctuation, emoji and zero-width characters are ignored");

assert.notEqual(normalizeForCompare("ආයුබෝවන් ලෝකය"), normalizeForCompare("ආයුබෝවන්"));
assert.equal(normalizeForCompare("ආයුබෝවන්  ලෝකය!"), normalizeForCompare("ආයුබෝවන් ලෝකය"));
assert.ok(normalizeForCompare("ශ්‍රී ලංකාව").length > 5); // Sinhala letters and vowel signs are kept
assert.ok(normalizeForCompare("नमस्ते दुनिया").length > 5);
assert.ok(normalizeForCompare("مرحبا بالعالم").length > 5);
assert.ok(normalizeForCompare("你好，世界").length === 4);
ok("Sinhala / Hindi / Arabic / Chinese text keeps its letters (so it is compared correctly)");

assert.equal(normalizeForCompare("version 2"), "version2");
assert.notEqual(normalizeForCompare("version 2"), normalizeForCompare("version 3"));
ok("numbers are kept: a different number is a different text");

// ---- the check
const earlier = ["Check out my new shop at example.com!!!", "good morning everyone, how are you today"];
assert.equal(isRepeat("check out my new shop at example.com", earlier, MIN), true);
assert.equal(isRepeat("CHECK OUT MY NEW SHOP AT EXAMPLE.COM!!!", earlier, MIN), true);
assert.equal(isRepeat("check out my new shop at example.org", earlier, MIN), false);
ok("the same text with other capitals / punctuation is a repeat; a different address is not");

assert.equal(isRepeat("thanks", ["thanks"], MIN), false);
assert.equal(isRepeat("+1 !!", ["+1 !!"], MIN), false);
assert.equal(isRepeat("good morning", ["good morning"], MIN), false); // 11 letters, below 12
assert.equal(isRepeat("good morning!", ["good morning!"], MIN), false);
assert.equal(isRepeat("good mornings", ["good mornings"], MIN), true); // 13 letters
ok("short texts (under 12 letters and numbers) are never repeats");

assert.equal(isRepeat("a long enough text to compare", [""], MIN), false);
assert.equal(isRepeat("a long enough text to compare", [], MIN), false);
ok("deleted posts (empty text) and no earlier posts never match");

assert.equal(isRepeat("ආයුබෝවන් ලෝකය, සුභ උදෑසනක්!", ["ආයුබෝවන් ලෝකය සුභ උදෑසනක්"], MIN), true);
ok("a repeated Sinhala text is found");

// ---- settings and texts
assert.ok(socialDuplicate.windowHours >= 1 && socialDuplicate.windowHours <= 168);
assert.ok(socialDuplicate.minChars >= 1 && socialDuplicate.minChars <= 100);
ok("the numbers in site.ts are sensible");

for (const [name, m] of Object.entries({ en, es, fr, zh, hi, ar }) as [string, Record<string, string>][]) {
  for (const key of ["social.form.duplicate", "social.reply.duplicate"]) {
    assert.ok(typeof m[key] === "string" && m[key].length > 10, `${name}: ${key} missing`);
  }
}
ok("the 2 new texts exist in all six languages");

console.log("\nAll duplicate-text checks passed.");
