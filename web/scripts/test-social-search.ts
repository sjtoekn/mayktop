// Tests for the Social search rules (SOCIAL_TODO B1). Run:  npm run test:social-search
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import {
  cleanSearchText,
  parseSearchTab,
  parseSocialSearch,
  rankPeople,
  rankTags,
  searchHref,
  searchPersonName,
  searchTagName,
  SOCIAL_SEARCH_MAX_LENGTH,
  SOCIAL_SEARCH_MAX_WORDS,
} from "../src/lib/social-search";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

// ---- cleaning ----
assert.equal(cleanSearchText(undefined), "");
assert.equal(cleanSearchText(42), "");
assert.equal(cleanSearchText(["a", "b"]), "");
assert.equal(cleanSearchText("   colombo   rain \n\t "), "colombo rain");
assert.equal(cleanSearchText("a\u200Bb\u0000c"), "a b c");
assert.equal(cleanSearchText("\u200B\u2060\uFEFF"), "");
ok("not a string -> empty; spaces and invisible characters cleaned");

// Sinhala joiners (U+200D) must stay inside a word
assert.equal(cleanSearchText("ශ්\u200Dරී ලංකා"), "ශ්\u200Dරී ලංකා");
ok("zero-width joiner kept in Sinhala words");

const long = "x".repeat(300);
assert.equal([...cleanSearchText(long)].length, SOCIAL_SEARCH_MAX_LENGTH);
const emoji = "😀".repeat(150);
assert.equal([...cleanSearchText(emoji)].length, SOCIAL_SEARCH_MAX_LENGTH);
assert.ok(!/\uFFFD/.test(cleanSearchText(emoji)), "an emoji must not be cut in half");
ok("length counted in whole characters");

// ---- tab ----
assert.equal(parseSearchTab("people"), "people");
assert.equal(parseSearchTab("tags"), "tags");
assert.equal(parseSearchTab("posts"), "posts");
assert.equal(parseSearchTab("admin"), null);
assert.equal(parseSearchTab(["people"]), null);
assert.equal(parseSearchTab(undefined), null);
ok("tab: only the three known values");

// ---- parse ----
assert.deepEqual(parseSocialSearch(undefined, undefined), { state: "empty", q: "", tab: "posts" });
assert.deepEqual(parseSocialSearch("   ", "tags"), { state: "empty", q: "", tab: "tags" });
ok("nothing typed -> empty");

assert.equal(parseSocialSearch("a", undefined).state, "short");
assert.equal(parseSocialSearch("#", undefined).state, "short");
assert.equal(parseSocialSearch("#a", undefined).state, "short");
assert.equal(parseSocialSearch("@", undefined).state, "short");
assert.equal(parseSocialSearch("@a", undefined).state, "short");
assert.equal(parseSocialSearch("ab", undefined).state, "ready");
assert.equal(parseSocialSearch("#ab", undefined).state, "ready");
assert.equal(parseSocialSearch("ක", undefined).state, "short"); // one Sinhala letter
assert.equal(parseSocialSearch("කඩ", undefined).state, "ready");
ok("too short -> short (a lone # or @ does not count)");

assert.equal(parseSocialSearch("rain", undefined).tab, "posts");
assert.equal(parseSocialSearch("#colombo", undefined).tab, "tags");
assert.equal(parseSocialSearch("@maya", undefined).tab, "people");
assert.equal(parseSocialSearch("#colombo", "posts").tab, "posts"); // an explicit tab wins
assert.equal(parseSocialSearch("rain", "people").tab, "people");
assert.equal(parseSocialSearch("rain", "bogus").tab, "posts");
ok("default tab from # and @, explicit tab wins");

{
  const s = parseSocialSearch("  Colombo   RAIN colombo ", undefined);
  assert.ok(s.state === "ready");
  if (s.state === "ready") {
    assert.equal(s.q, "Colombo RAIN colombo");
    assert.deepEqual(s.words, ["colombo", "rain"]); // lower case, different
  }
}
{
  const s = parseSocialSearch("a1 b2 c3 d4 e5 f6 g7", undefined);
  assert.ok(s.state === "ready");
  if (s.state === "ready") assert.equal(s.words.length, SOCIAL_SEARCH_MAX_WORDS);
}
ok("post words: lower case, different, at most 5");

{
  const s = parseSocialSearch("#Colombo", undefined);
  assert.ok(s.state === "ready");
  if (s.state === "ready") {
    assert.equal(s.tag, "colombo");
    assert.equal(s.person, "#colombo");
    assert.deepEqual(s.words, ["#colombo"]);
  }
  const p = parseSocialSearch("@Maya_R", undefined);
  assert.ok(p.state === "ready");
  if (p.state === "ready") assert.equal(p.person, "maya_r");
}
assert.equal(searchTagName("##Colombo"), "colombo");
assert.equal(searchTagName("Colombo City"), "colombocity");
assert.equal(searchTagName("CAFE\u0301"), "caf\u00e9"); // NFC + lower case, same as social-tags.ts
assert.equal(searchPersonName("@@Maya"), "maya");
ok("hashtag and username forms");

// ---- address ----
assert.equal(searchHref(""), "/social/search");
assert.equal(searchHref("rain"), "/social/search?q=rain");
assert.equal(searchHref("rain", "people"), "/social/search?q=rain&tab=people");
assert.equal(searchHref("a b&c=d", "tags"), "/social/search?q=a+b%26c%3Dd&tab=tags");
assert.equal(searchHref("rain", "posts", "123.0.4"), "/social/search?q=rain&before=123.0.4");
ok("addresses are encoded; Posts has no ?tab");

// ---- ranking: never by popularity ----
const people = [
  { username: "zed_maya", displayName: null },
  { username: "maya", displayName: "Someone Else" },
  { username: "maya_r", displayName: null },
  { username: "amy", displayName: "Maya Fernando" },
  { username: "maya", displayName: "duplicate" },
  { username: "bob", displayName: "Mayank" },
];
assert.deepEqual(rankPeople(people, "maya").map((p) => p.username), ["maya", "maya_r", "amy", "bob", "zed_maya"]);
assert.equal(rankPeople(people, "maya", 2).length, 2);
assert.deepEqual(rankPeople([], "maya"), []);
ok("people: exact, username prefix, name prefix, rest; no duplicates; limit");

assert.deepEqual(rankTags(["colombo2", "colombo", "colombo2", "mycolombo"], "colombo"), ["colombo", "colombo2", "mycolombo"]);
assert.deepEqual(rankTags(["b", "a"], "zzz"), ["b", "a"]); // no exact: the given (newest-use-first) order is kept
assert.equal(rankTags(["a", "b", "c"], "q", 2).length, 2);
ok("hashtags: exact first, then the order given");

// ---- config and texts ----
assert.ok(Array.isArray(socialLimits.searches) && socialLimits.searches.length >= 1);
for (const rule of socialLimits.searches) assert.ok(rule.max > 0 && rule.windowSeconds > 0);
ok("search rate limit is configured");

const keys = Object.keys(en).filter((k) => k.startsWith("social.search."));
assert.ok(keys.length >= 15, "expected the search texts");
for (const [name, dict] of Object.entries({ es, fr, zh, hi, ar }) as [string, Record<string, string>][]) {
  for (const key of keys) assert.ok(typeof dict[key] === "string" && dict[key].length > 0, `${name} is missing ${key}`);
}
ok("every search text exists in all six languages");

console.log("\nAll Social search tests passed.");
