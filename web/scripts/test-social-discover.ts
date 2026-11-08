// Test: Trending hashtags and Who to follow (SOCIAL_TODO B7, patch-social-discover). Run:  npm run test:social-discover
// Needs no database: only the plain rules are run.
import assert from "node:assert/strict";
import { pickSuggestions, rankTrendingTags, shuffleKey, suggestSeed, type SuggestCandidate } from "../src/lib/social-discover-rules";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }
const tagUse = (tag: string, authorId: string, createdAtMs = 1000) => ({ tag, authorId, createdAtMs });

// 1. Trending counts DIFFERENT people
{
  const rows = [
    ...Array.from({ length: 10 }, () => tagUse("spam", "a")),          // one person, ten posts
    tagUse("colombo", "a"), tagUse("colombo", "b"),                        // two people
    tagUse("food", "a"), tagUse("food", "b"), tagUse("food", "c"),            // three people
  ];
  assert.deepEqual(rankTrendingTags(rows, { minPeople: 2, size: 5 }), [
    { tag: "food", people: 3 },
    { tag: "colombo", people: 2 },
  ]);
  ok("trending: counts different people, one person repeating a tag never trends");
}

// 2. Order and size
{
  const rows = [tagUse("b", "x", 10), tagUse("b", "y", 10), tagUse("a", "x", 10), tagUse("a", "y", 10), tagUse("c", "x", 99), tagUse("c", "y", 5)];
  assert.deepEqual(rankTrendingTags(rows, { minPeople: 2, size: 5 }).map((r) => r.tag), ["c", "a", "b"]); // same people: most recent, then A-Z
  assert.equal(rankTrendingTags(rows, { minPeople: 2, size: 2 }).length, 2);
  assert.deepEqual(rankTrendingTags(rows, { minPeople: 2, size: 0 }), []);
  assert.deepEqual(rankTrendingTags([], { minPeople: 2, size: 5 }), []);
  assert.deepEqual(rankTrendingTags(rows, { minPeople: 3, size: 5 }), []);
  ok("trending: most people, then most recent, then A-Z; size and minimum respected");
}

// 3. Who to follow: mutual first, then a daily shuffle; no popularity
{
  const c = (username: string, mutual = 0): SuggestCandidate => ({ username, displayName: null, mutual });
  const list = [c("aaa"), c("bbb"), c("ccc", 2), c("ddd", 1), c("eee"), c("fff"), c("ccc", 9)];
  const picked = pickSuggestions(list, { seed: "u1:100", size: 4 });
  assert.equal(picked.length, 4);
  assert.deepEqual(picked.slice(0, 2).map((p) => p.username), ["ccc", "ddd"]);
  assert.equal(new Set(picked.map((p) => p.username)).size, 4); // no duplicates
  assert.deepEqual(pickSuggestions(list, { seed: "u1:100", size: 4 }), picked); // same seed, same list
  const names = (seed: string) => pickSuggestions(Array.from({ length: 30 }, (_, i) => c("user" + i)), { seed, size: 5 }).map((p) => p.username).join();
  assert.notEqual(names("u1:100"), names("u1:101")); // another day, another list
  assert.notEqual(names("u1:100"), names("u2:100")); // another person, another list
  assert.deepEqual(pickSuggestions([], { seed: "x", size: 5 }), []);
  assert.equal(pickSuggestions(list, { seed: "x", size: 0 }).length, 0);
  ok("who to follow: mutual follows first, then a shuffle fixed for one person for one day");
}

// 4. Seed and shuffle key
{
  const day = 86_400_000;
  assert.equal(suggestSeed("u", 5 * day), suggestSeed("u", 5 * day + day - 1));
  assert.notEqual(suggestSeed("u", 5 * day), suggestSeed("u", 6 * day));
  assert.equal(shuffleKey("abc"), shuffleKey("abc"));
  assert.ok(shuffleKey("abc") >= 0);
  ok("seed changes at midnight UTC; shuffle key is stable");
}

// 5. Config and texts
{
  const d = socialLimits.discover;
  for (const v of [d.trendingWindowHours, d.trendingMinPeople, d.trendingSize, d.trendingScanLimit, d.suggestSize, d.suggestActiveDays, d.suggestPool]) assert.ok(Number.isInteger(v) && v > 0);
  assert.ok(d.trendingMinPeople >= 2, "one person must never be enough to trend");
  const keys = ["label", "trending.title", "trending.sub", "trending.people.other", "suggest.title", "suggest.sub", "suggest.mutual.other"].map((k) => `social.discover.${k}`);
  for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
    for (const key of keys) assert.ok(typeof (messages as Record<string, unknown>)[key] === "string", `${name} ${key}`);
  }
  ok("limits are sane (a tag needs at least 2 people); texts exist in 6 languages");
}

console.log("\nAll social-discover tests passed.");
