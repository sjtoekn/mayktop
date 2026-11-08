// Tests for the fair ranking (TODO 37). Run:  npm run test:ranking
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { rankingConfig as cfg } from "../src/config/site";
import { baseScore, isNewVoice, jitter, rankPopular, rankPopularDetailed, type RankItem } from "../src/lib/ranking";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);

let nextId = 1;
function post(o: Partial<RankItem> & { ageHours?: number; accountDays?: number } = {}): RankItem {
  return {
    id: o.id ?? nextId++,
    authorKey: o.authorKey ?? `author-${nextId}`,
    createdAtMs: o.createdAtMs ?? NOW - (o.ageHours ?? 5) * HOUR,
    votes: o.votes ?? 0,
    authorCreatedAtMs: o.authorCreatedAtMs ?? NOW - (o.accountDays ?? 400) * DAY,
    authorPosts: o.authorPosts ?? 50, // an established author by default
  };
}
const rank = (items: RankItem[]) => rankPopular(items, NOW, cfg);
function ok(name: string) { console.log("OK  " + name); }

// 1. Every post appears exactly once, nothing is hidden by ranking.
{
  const items = Array.from({ length: 40 }, (_, i) => post({ votes: i % 7, authorKey: `a${i % 9}`, ageHours: i * 3 }));
  const out = rank(items);
  assert.equal(out.length, items.length);
  assert.equal(new Set(out).size, items.length);
  ok("every post appears exactly once");
}

// 2. Same input, same order (no hidden randomness).
{
  const items = Array.from({ length: 30 }, (_, i) => post({ votes: (i * 5) % 11, authorKey: `a${i % 6}`, ageHours: i }));
  assert.deepEqual(rank(items), rank([...items].reverse()));
  ok("same posts give the same order, whatever order the database returned");
}

// 3. Diminishing returns + decay: a fresh 5-vote post beats a 30-day-old 1000-vote post.
{
  const old = post({ votes: 1000, ageHours: 30 * 24, authorKey: "old" });
  const fresh = post({ votes: 5, ageHours: 1, authorKey: "fresh" });
  assert.ok(baseScore(fresh, NOW, cfg) > baseScore(old, NOW, cfg));
  const out = rank([old, fresh]);
  assert.equal(out[0], fresh.id);
  // the 1000th vote counts far less than the 10th
  const v10 = baseScore(post({ votes: 10, ageHours: 0 }), NOW, cfg);
  const v1000 = baseScore(post({ votes: 1000, ageHours: 0 }), NOW, cfg);
  assert.ok(v1000 < v10 * 4);
  ok("votes have diminishing returns and fade with age");
}

// 4. One popular author cannot fill the top: 10 posts by "star" (100 votes) vs 10 other authors (20 votes each).
{
  const star = Array.from({ length: 10 }, () => post({ votes: 100, authorKey: "star", ageHours: 5 }));
  const others = Array.from({ length: 10 }, (_, i) => post({ votes: 20, authorKey: `other-${i}`, ageHours: 5 }));
  const out = rank([...star, ...others]);
  const starIds = new Set(star.map((p) => p.id));
  const starInTop8 = out.slice(0, 8).filter((id) => starIds.has(id)).length;
  assert.ok(starInTop8 <= 3, `star has ${starInTop8} of the first 8 places`);
  assert.ok(starIds.has(out[0])); // the best post still comes first
  ok("one account cannot fill the top of the page");
}

// 5. New voices get a reserved place: position 4 is a recent new-voice post, even with 0 votes.
{
  const veterans = Array.from({ length: 12 }, (_, i) => post({ votes: 30 - i, authorKey: `vet-${i}`, ageHours: 10 }));
  const newbie = post({ votes: 0, ageHours: 2, authorKey: "newbie", accountDays: 2, authorPosts: 1 });
  const out = rank([...veterans, newbie]);
  assert.equal(out.indexOf(newbie.id) + 1, cfg.risingEvery);
  ok(`a new voice gets place ${cfg.risingEvery} even with no votes yet`);
}

// 6. A downvoted new-voice post gets no reserved place, and downvoted posts come last.
{
  const veterans = Array.from({ length: 10 }, (_, i) => post({ votes: 30 - i, authorKey: `vet-${i}` }));
  const bad = post({ votes: -3, ageHours: 2, authorKey: "bad", accountDays: 2, authorPosts: 1 });
  const worse = post({ votes: -8, authorKey: "worse" });
  const out = rank([bad, worse, ...veterans]);
  assert.notEqual(out.indexOf(bad.id) + 1, cfg.risingEvery);
  assert.deepEqual(out.slice(-2), [bad.id, worse.id]); // -3 before -8
  ok("downvoted posts never use the reserved places and come last (not hidden)");
}

// 7. Old posts and established authors do not get the reserved places.
{
  const veterans = Array.from({ length: 10 }, (_, i) => post({ votes: 30 - i, authorKey: `vet-${i}` }));
  const oldNew = post({ votes: 0, ageHours: cfg.risingWindowHours + 5, authorKey: "slow", accountDays: 2, authorPosts: 1 });
  const established = post({ votes: 0, ageHours: 2, authorKey: "est" });
  const out = rank([...veterans, oldNew, established]);
  assert.ok(out.indexOf(oldNew.id) + 1 > cfg.risingEvery);
  assert.ok(out.indexOf(established.id) + 1 > cfg.risingEvery);
  ok("the reserved places are only for recent posts by new voices");
}

// 8. Abuse is capped: 60 fresh new-account posts take at most one place in `risingEvery` among the first 20.
{
  const veterans = Array.from({ length: 30 }, (_, i) => post({ votes: 40 - i, authorKey: `vet-${i}`, ageHours: 8 }));
  const spam = Array.from({ length: 60 }, (_, i) => post({ votes: 0, authorKey: `bot-${i}`, ageHours: 1, accountDays: 1, authorPosts: 1 }));
  const out = rank([...veterans, ...spam]);
  const spamIds = new Set(spam.map((p) => p.id));
  const spamInTop20 = out.slice(0, 20).filter((id) => spamIds.has(id)).length;
  assert.ok(spamInTop20 <= Math.floor(20 / cfg.risingEvery), `${spamInTop20} spam posts in the first 20`);
  ok("a flood of new accounts takes at most its fixed share");
}

// 9. One new voice cannot take two reserved places.
{
  const veterans = Array.from({ length: 20 }, (_, i) => post({ votes: 30 - i, authorKey: `vet-${i}` }));
  const same = Array.from({ length: 5 }, () => post({ votes: 0, ageHours: 2, authorKey: "same-newbie", accountDays: 2, authorPosts: 1 }));
  const out = rank([...veterans, ...same]);
  const sameIds = new Set(same.map((p) => p.id));
  assert.equal(out.slice(0, 16).filter((id) => sameIds.has(id)).length, 1);
  ok("one new voice gets at most one reserved place");
}

// 10. The draw is stable inside a seed window and changes between windows.
{
  const id = 4242;
  const t0 = Math.floor(NOW / (cfg.seedHours * HOUR)) * cfg.seedHours * HOUR;
  assert.equal(jitter(id, t0, cfg), jitter(id, t0 + cfg.seedHours * HOUR - 1, cfg));
  const values = new Set(Array.from({ length: 20 }, (_, k) => jitter(id, t0 + k * cfg.seedHours * HOUR, cfg)));
  assert.ok(values.size > 15);
  for (const v of values) assert.ok(v >= 0 && v < 1);
  ok("the fair draw is stable for the window and then changes");
}

// 11. Big lists work (more posts than maxCandidates) and keep every post once.
{
  const items = Array.from({ length: 1200 }, (_, i) => post({ votes: i % 17, authorKey: `a${i % 40}`, ageHours: i % 200 }));
  const out = rank(items);
  assert.equal(out.length, 1200);
  assert.equal(new Set(out).size, 1200);
  ok("lists bigger than maxCandidates keep every post once");
}

// 12. Empty list, single post.
{
  assert.deepEqual(rank([]), []);
  const one = post({});
  assert.deepEqual(rank([one]), [one.id]);
  assert.equal(isNewVoice(post({ accountDays: 5, authorPosts: 99 }), NOW, cfg), true);
  assert.equal(isNewVoice(post({ accountDays: 400, authorPosts: 2 }), NOW, cfg), true);
  assert.equal(isNewVoice(post({ accountDays: 400, authorPosts: 50 }), NOW, cfg), false);
  ok("empty list, one post, and who counts as a new voice");
}

// 13. Only posts that really took a reserved place are marked (for the "New voice" label).
{
  const veterans = Array.from({ length: 12 }, (_, i) => post({ votes: 30 - i, authorKey: `vet-${i}`, ageHours: 10 }));
  const newbie = post({ votes: 0, ageHours: 2, authorKey: "newbie", accountDays: 2, authorPosts: 1 });
  const { ids, rising } = rankPopularDetailed([...veterans, newbie], NOW, cfg);
  assert.deepEqual(ids, rank([...veterans, newbie]));
  assert.deepEqual([...rising], [newbie.id]);
  // a new voice who ranks high on votes alone, without using a reserved place, is NOT marked
  const strong = post({ votes: 500, ageHours: 1, authorKey: "strong", accountDays: 2, authorPosts: 1 });
  const r2 = rankPopularDetailed([...veterans, strong], NOW, cfg);
  assert.equal(r2.ids[0], strong.id);
  assert.equal(r2.rising.has(strong.id), false);
  ok("only posts in a reserved place are marked as new voices");
}

console.log("\nAll ranking tests passed.");
