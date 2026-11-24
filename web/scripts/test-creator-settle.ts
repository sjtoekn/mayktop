// Tests for turning a finished ad into ledger rows (TODO 12, S4). Run:  npm run test:creator-settle
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import { pickOtherAnswerAuthors, type PageAuthors } from "../src/lib/creator-rules";
import { buildSettlement, dayStart, type SettleCreator, type SettleInput } from "../src/lib/creator-settle-rules";

function ok(name: string) { console.log("OK  " + name); }
const DAY = 86_400_000;
const D0 = Date.UTC(2026, 10, 1); // 1 Nov 2026
const sum = (rows: { micro: number }[]) => rows.reduce((n, r) => n + r.micro, 0);

const pageA: PageAuthors = { askerId: "asker", acceptedId: "acc", othersByVotes: ["o1"] };
const joined = (id: string, atMs = D0 - 30 * DAY, blocked = false): [string, SettleCreator] => [id, { joinedAtMs: atMs, blocked }];

function base(over: Partial<SettleInput> = {}): SettleInput {
  return {
    adId: 5,
    priceCents: 1000, // pool = $5.00
    adTotalImpressions: 1000,
    periodStartMs: D0,
    days: [{ contentId: 1, dayMs: D0, impressions: 400 }],
    pages: new Map([[1, pageA]]),
    creators: new Map([joined("asker"), joined("acc"), joined("o1")]),
    ...over,
  };
}

// 1. Ranking of the other answers: only positive scores, best first, older first on a tie, one person once.
{
  const r = pickOtherAnswerAuthors([
    { authorId: "x", score: 0, createdAtMs: 1 },
    { authorId: "y", score: 3, createdAtMs: 5 },
    { authorId: "z", score: 3, createdAtMs: 2 },
    { authorId: "y", score: 9, createdAtMs: 9 },
    { authorId: "w", score: -2, createdAtMs: 1 },
    { authorId: "v", score: 1, createdAtMs: 1 },
  ]);
  assert.deepEqual(r, ["y", "z", "v"]);
  assert.deepEqual(pickOtherAnswerAuthors([]), []);
  ok("other answers: only positive scores, best first, one person once");
}

// 2. A normal settlement: 400/1000 of the $5 pool = $2, split 30 / 50 / 20 (the 20 goes to the single other answer).
{
  const s = buildSettlement(base());
  assert.equal(s.poolMicro, 5_000_000);
  assert.equal(s.activeMicro, 2_000_000);
  const by = (id: string) => s.rows.filter((r) => r.userId === id).reduce((n, r) => n + r.micro, 0);
  assert.equal(by("asker"), 600_000);
  assert.equal(by("acc"), 1_000_000);
  assert.equal(by("o1"), 400_000);
  assert.ok(s.rows.every((r) => r.status === "ACTIVE" && r.dedupeKey.startsWith("share:5:2026-11-01:POST:1:")));
  ok("a finished ad becomes one row per person per page, with the right amounts");
}

// 3. People who did not join earn nothing, and their part is NOT given to somebody else.
{
  const s = buildSettlement(base({ creators: new Map([joined("asker")]) }));
  assert.equal(s.rows.length, 1);
  assert.equal(s.rows[0].userId, "asker");
  assert.equal(s.rows[0].micro, 600_000); // still only the 30%
  ok("only people in the program earn; the rest stays with the platform");
}

// 4. Earnings count only from the day the person joined (D4).
{
  const days = [
    { contentId: 1, dayMs: D0, impressions: 100 },
    { contentId: 1, dayMs: D0 + DAY, impressions: 100 },
    { contentId: 1, dayMs: D0 + 2 * DAY, impressions: 100 },
  ];
  const lateJoiner = joined("acc", D0 + DAY + 5 * 3_600_000); // joins during day 2
  const s = buildSettlement(base({ days, creators: new Map([joined("asker"), lateJoiner]) }));
  const acc = s.rows.filter((r) => r.userId === "acc").reduce((n, r) => n + r.micro, 0);
  const asker = s.rows.filter((r) => r.userId === "asker").reduce((n, r) => n + r.micro, 0);
  assert.equal(asker, 3 * 150_000); // 100/1000 x $5 = $0.50 per day; the asker's 30% = 150_000, all three days
  assert.equal(acc, 2 * 250_000); // the accepted writer's 50% = 250_000, only day 2 and 3
  assert.equal(dayStart(D0 + DAY + 5 * 3_600_000), D0 + DAY);
  ok("earnings start on the day the person joined");
}

// 5. Banned / erased people: their rows are VOID and not part of activeMicro.
{
  const s = buildSettlement(base({ creators: new Map([joined("asker"), joined("acc", D0 - DAY, true), joined("o1")]) }));
  const acc = s.rows.filter((r) => r.userId === "acc");
  assert.ok(acc.length === 1 && acc[0].status === "VOID");
  assert.equal(s.voidMicro, 1_000_000);
  assert.equal(s.activeMicro, 600_000 + 400_000);
  ok("banned / erased people get VOID rows that are never paid");
}

// 6. Pages that are not visible earn nothing; a page missing from the list too.
{
  const s = buildSettlement(base({ pages: new Map([[1, null]]) }));
  assert.equal(s.rows.length, 0);
  const s2 = buildSettlement(base({ pages: new Map() }));
  assert.equal(s2.rows.length, 0);
  ok("pages that are hidden, removed or unknown earn nothing");
}

// 7. The total is never more than the pool: many pages, many days, awkward numbers, lying counters.
{
  const pages = new Map<number, PageAuthors | null>();
  const creators = new Map<string, SettleCreator>();
  const days = [];
  for (let c = 1; c <= 40; c++) {
    pages.set(c, { askerId: `a${c}`, acceptedId: `c${c % 7}`, othersByVotes: [`o${c % 5}`, `p${c % 3}`, `q${c}`] });
    for (let d = 0; d < 5; d++) days.push({ contentId: c, dayMs: D0 + d * DAY, impressions: 1 + ((c * 7 + d * 13) % 31) });
  }
  for (let i = 0; i <= 45; i++) for (const p of ["a", "o", "p", "q"]) creators.set(`${p}${i}`, { joinedAtMs: D0 - DAY, blocked: false });
  for (let i = 0; i <= 7; i++) creators.set(`c${i}`, { joinedAtMs: D0 - DAY, blocked: false });
  const attributed = days.reduce((n, d) => n + d.impressions, 0);
  for (const total of [attributed, attributed + 1, attributed * 3, 10, 1]) {
    const s = buildSettlement(base({ pages, creators, days, adTotalImpressions: total }));
    assert.ok(s.activeMicro + s.voidMicro <= s.poolMicro, `pool exceeded for total=${total}`);
    assert.equal(sum(s.rows), s.activeMicro + s.voidMicro);
  }
  ok("rows never add up to more than the pool of the ad");
}

// 8. Same input twice gives the same rows and the same dedupe keys (so a repeated run cannot pay twice).
{
  const a = buildSettlement(base());
  const b = buildSettlement(base({ creators: new Map([joined("o1"), joined("acc"), joined("asker")]) })); // other order
  assert.deepEqual(a.rows, b.rows);
  assert.equal(new Set(a.rows.map((r) => r.dedupeKey)).size, a.rows.length);
  ok("same input, same rows and unique dedupe keys");
}

// 9. Nothing to settle: no price, no impressions.
{
  assert.equal(buildSettlement(base({ priceCents: 0 })).rows.length, 0);
  assert.equal(buildSettlement(base({ days: [] })).rows.length, 0);
  assert.equal(buildSettlement(base({ adTotalImpressions: 0, days: [] })).activeMicro, 0);
  ok("no price or no page impressions: nothing is written");
}

console.log("\nAll creator settle tests passed.");
