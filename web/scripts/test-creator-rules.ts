// Tests for the creator earnings rules (TODO 12, S1). Run:  npm run test:creator-rules
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import {
  allocate,
  canPayout,
  creatorsConfigIsValid,
  earningState,
  formatUsd,
  isPayoutCountry,
  pageWeights,
  poolMicro,
  settleAd,
  shareKey,
  type PageAuthors,
} from "../src/lib/creator-rules";

function ok(name: string) { console.log("OK  " + name); }
const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
const DAY = 86_400_000;

// 1. The numbers in the config are consistent.
assert.equal(creatorsConfigIsValid(), true);
ok("config numbers are consistent (split adds up to 100)");

// 2. Pool: 50% of $10.00 = $5.00 = 5_000_000 micro-USD. Bad prices give nothing.
assert.equal(poolMicro(1000), 5_000_000);
assert.equal(poolMicro(0), 0);
assert.equal(poolMicro(-5), 0);
assert.equal(poolMicro(12.5), 0);
ok("pool is the share of the ad price; bad prices give 0");

// 3. One page, full case: asker 30, accepted 50, two other answers share 20.
{
  const w = pageWeights({ askerId: "asker", acceptedId: "acc", othersByVotes: ["o1", "o2"] });
  assert.equal(w.get("asker"), 3000);
  assert.equal(w.get("acc"), 5000);
  assert.equal(w.get("o1"), 1000);
  assert.equal(w.get("o2"), 1000);
  assert.equal(sum(w), 10000);
  ok("full page: 30 / 50 / 10 + 10");
}

// 4. No accepted answer: its part goes to the other answers.
{
  const w = pageWeights({ askerId: "asker", acceptedId: null, othersByVotes: ["o1", "o2"] });
  assert.equal(w.get("asker"), 3000);
  assert.equal(w.get("o1"), 3500);
  assert.equal(w.get("o2"), 3500);
  assert.equal(sum(w), 10000);
  ok("no accepted answer: its 50 goes to the other answers");
}

// 5. No other answers: their part goes to the asker. Nobody answered at all: the asker gets everything.
{
  const w = pageWeights({ askerId: "asker", acceptedId: "acc", othersByVotes: [] });
  assert.equal(w.get("asker"), 5000);
  assert.equal(w.get("acc"), 5000);
  const alone = pageWeights({ askerId: "asker", acceptedId: null, othersByVotes: [] });
  assert.equal(alone.get("asker"), 10000);
  assert.equal(alone.size, 1);
  ok("no other answers / no answers: parts fall back to the asker");
}

// 6. Same person in two roles is added up; the accepted writer is not counted twice among the others;
//    only otherAnswersMax others count; a repeated name counts once.
{
  const self = pageWeights({ askerId: "u", acceptedId: "u", othersByVotes: ["u", "x"] });
  assert.equal(self.get("u"), 8000); // asker 30 + accepted 50; the "u" in the others list is skipped
  assert.equal(self.get("x"), 2000);
  const many = pageWeights({ askerId: "a", acceptedId: "c", othersByVotes: ["o1", "o1", "o2", "o3", "o4", "o5"] });
  assert.equal(many.has("o4"), false); // 3 others at most: o1, o2, o3
  assert.equal(sum(many), 10000);
  ok("one person in two roles adds up; extra / repeated answers are ignored");
}

// 7. Uneven split of the "others" part still adds up to 100% and is the same whatever the input order of the Map.
{
  const w = pageWeights({ askerId: "a", acceptedId: "c", othersByVotes: ["o1", "o2", "o3"] });
  assert.equal(sum(w), 10000);
  assert.equal(w.get("o1"), 667); // the leftover point goes to the best-voted answer first
  assert.equal(w.get("o2"), 667);
  assert.equal(w.get("o3"), 666);
  ok("an uneven split of the others part keeps the total at 100%");
}

// 8. allocate: adds up to EXACTLY the total, whatever the order of the input.
{
  const a = allocate(1001, new Map([["b", 1], ["a", 1], ["c", 1]]));
  const b = allocate(1001, new Map([["c", 1], ["b", 1], ["a", 1]]));
  assert.equal(sum(a), 1001);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.equal(allocate(0, new Map([["a", 1]])).size, 0);
  assert.equal(allocate(10, new Map()).size, 0);
  ok("allocate adds up exactly and is order independent");
}

// 9. settleAd: creators can never get more than the pool, and the numbers are right.
{
  const authors: PageAuthors = { askerId: "asker", acceptedId: "acc", othersByVotes: [] };
  // ad price $10 -> pool $5. 1000 impressions in total, 400 on one question page.
  const r = settleAd(1000, 1000, [{ contentId: 1, impressions: 400, authors }]);
  assert.equal(r.poolMicro, 5_000_000);
  assert.equal(r.totalMicro, 2_000_000); // 400/1000 of the pool
  assert.equal(r.byUser.get("asker"), 1_000_000);
  assert.equal(r.byUser.get("acc"), 1_000_000);
  assert.equal(r.byContent.get(1), 2_000_000);
  ok("settleAd: a page gets its share of the pool by impressions");
}

// 10. settleAd: never above the pool, even with inconsistent counters and awkward numbers.
{
  const mk = (id: number, impressions: number): { contentId: number; impressions: number; authors: PageAuthors } => ({
    contentId: id,
    impressions,
    authors: { askerId: `a${id}`, acceptedId: `c${id}`, othersByVotes: [`o${id}`, `p${id}`] },
  });
  const all = settleAd(1000, 3, [mk(1, 1), mk(2, 1), mk(3, 1)]);
  assert.ok(all.totalMicro <= all.poolMicro);
  assert.equal(sum(all.byUser), all.totalMicro);
  const wrong = settleAd(1000, 10, [mk(1, 7), mk(2, 9)]); // pages claim more impressions than the ad total
  assert.ok(wrong.totalMicro <= wrong.poolMicro);
  assert.equal(sum(wrong.byUser), wrong.totalMicro);
  for (const n of [1, 7, 333, 99_999]) {
    const r = settleAd(1000, n * 3, [mk(1, n), mk(2, n), mk(3, n)]);
    assert.ok(r.totalMicro <= r.poolMicro, `pool exceeded for n=${n}`);
  }
  ok("settleAd never pays more than the pool; the parts add up");
}

// 11. settleAd: removed/hidden pages (authors null), no impressions, and zero totals earn nothing.
{
  const gone = settleAd(1000, 100, [{ contentId: 1, impressions: 50, authors: null }]);
  assert.equal(gone.totalMicro, 0);
  assert.equal(gone.byUser.size, 0);
  const none = settleAd(1000, 0, []);
  assert.equal(none.totalMicro, 0);
  const noPrice = settleAd(0, 100, [{ contentId: 1, impressions: 50, authors: { askerId: "a", acceptedId: null, othersByVotes: [] } }]);
  assert.equal(noPrice.totalMicro, 0);
  ok("pages that are not visible, no impressions or no price earn nothing");
}

// 12. Payout countries: LK and IN only (any case, spaces ignored); empty = no.
assert.equal(isPayoutCountry("LK"), true);
assert.equal(isPayoutCountry(" in "), true);
assert.equal(isPayoutCountry("US"), false);
assert.equal(isPayoutCountry(""), false);
assert.equal(isPayoutCountry(null), false);
ok("payouts open only for Sri Lanka and India");

// 13. Earning state: other countries are held (never lost); LK / IN wait 30 days, then become payable.
{
  const t0 = Date.UTC(2026, 10, 24);
  assert.equal(earningState("US", t0, t0 + 365 * DAY), "HELD_COUNTRY");
  assert.equal(earningState(null, t0, t0 + 365 * DAY), "HELD_COUNTRY");
  assert.equal(earningState("LK", t0, t0 + 29 * DAY), "ACCRUED");
  assert.equal(earningState("LK", t0, t0 + 30 * DAY), "PAYABLE");
  assert.equal(earningState("IN", t0, t0 + 31 * DAY), "PAYABLE");
  ok("held for other countries; 30 days hold for LK / IN");
}

// 14. Minimum payout $10, and money text rounds down.
assert.equal(canPayout(9_999_999), false);
assert.equal(canPayout(10_000_000), true);
assert.equal(formatUsd(0), "0.00");
assert.equal(formatUsd(12_345_678), "12.34");
assert.equal(formatUsd(9_999), "0.00");
assert.equal(formatUsd(-5), "0.00");
ok("minimum payout is USD 10; money text rounds down");

// 15. The ledger rows of a settlement add up to the totals (per user, per page); the dedupe key is stable.
{
  const r = settleAd(1000, 1000, [
    { contentId: 7, impressions: 300, authors: { askerId: "a", acceptedId: "c", othersByVotes: ["o"] } },
    { contentId: 8, impressions: 200, authors: { askerId: "a", acceptedId: null, othersByVotes: [] } },
  ]);
  assert.equal(r.entries.reduce((n, e) => n + e.micro, 0), r.totalMicro);
  const a = r.entries.filter((e) => e.userId === "a").reduce((n, e) => n + e.micro, 0);
  assert.equal(a, r.byUser.get("a"));
  assert.equal(r.entries.filter((e) => e.contentId === 8).reduce((n, e) => n + e.micro, 0), r.byContent.get(8));
  const t = Date.UTC(2026, 10, 24, 15, 0, 0);
  assert.equal(shareKey(3, t, "POST", 7, "u1"), "share:3:2026-11-24:POST:7:u1");
  assert.equal(shareKey(3, t, "POST", 7, "u1"), shareKey(3, t + 3_600_000, "POST", 7, "u1")); // same UTC day, same key
  ok("ledger rows add up to the totals; dedupe key is stable");
}

console.log("\nAll creator rules tests passed.");
