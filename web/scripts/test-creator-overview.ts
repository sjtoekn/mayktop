// Tests for the Creator Overview numbers (TODO 12, S5). Run:  npm run test:creator-overview
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import { balancesFrom, barHeights, lastDays, monthImpressions, nextPayout, roleOf, type LedgerRow } from "../src/lib/creator-overview-rules";
import { creatorsConfig } from "../src/config/site";

function ok(name: string) { console.log("OK  " + name); }
const DAY = 86_400_000;
const now = Date.UTC(2026, 11, 15, 10); // 15 Dec 2026, 10:00 UTC
const today = Date.UTC(2026, 11, 15);

// 1. Days
const by = new Map<number, number>([[today, 7], [today - 2 * DAY, 3], [today - 40 * DAY, 99]]);
const days = lastDays(now, 30, by);
assert.equal(days.length, 30);
assert.equal(days[29].dayMs, today);
assert.equal(days[0].dayMs, today - 29 * DAY);
assert.equal(days[29].impressions, 7);
assert.equal(days[27].impressions, 3);
assert.equal(days.reduce((n, d) => n + d.impressions, 0), 10); // the day 40 days ago is outside
assert.equal(monthImpressions(now, by), 10); // 1-15 Dec only
assert.equal(monthImpressions(now, new Map([[Date.UTC(2026, 10, 30), 5], [today, 2]])), 2); // November is not this month
ok("last 30 days and this month's impressions");

// 2. Bars
assert.deepEqual(barHeights([0, 0]), [0, 0]);
assert.deepEqual(barHeights([]), []);
assert.deepEqual(barHeights([1, 100, 0]), [4, 100, 0]);
ok("bar heights");

// 3. Balances
const hold = creatorsConfig.holdDays * DAY;
const rows: LedgerRow[] = [
  { amountMicroUsd: 5_000_000, status: "ACTIVE", createdAtMs: now - hold - DAY, payoutId: null, payoutStatus: null }, // payable (LK)
  { amountMicroUsd: 2_000_000, status: "ACTIVE", createdAtMs: now - DAY, payoutId: null, payoutStatus: null }, // accrued
  { amountMicroUsd: -500_000, status: "ACTIVE", createdAtMs: now - hold - 2 * DAY, payoutId: null, payoutStatus: null }, // reversal
  { amountMicroUsd: 9_000_000, status: "VOID", createdAtMs: now - hold - DAY, payoutId: null, payoutStatus: null }, // ignored
  { amountMicroUsd: 4_000_000, status: "ACTIVE", createdAtMs: now - 100 * DAY, payoutId: 1, payoutStatus: "PAID" },
  { amountMicroUsd: 1_000_000, status: "ACTIVE", createdAtMs: now - 100 * DAY, payoutId: 2, payoutStatus: "PENDING" },
  { amountMicroUsd: 3_000_000, status: "ACTIVE", createdAtMs: now - 100 * DAY, payoutId: 3, payoutStatus: "FAILED" }, // not paid: back to the normal state
];
let b = balancesFrom(rows, "LK", now);
assert.deepEqual(b, { accruedMicro: 2_000_000, payableMicro: 5_000_000 - 500_000 + 3_000_000, heldMicro: 0, inPayoutMicro: 1_000_000, paidMicro: 4_000_000, totalOpenMicro: 2_000_000 + 7_500_000 + 1_000_000 });
b = balancesFrom(rows, "US", now); // no payouts for this country: everything unpaid is kept, nothing is lost
assert.equal(b.heldMicro, 2_000_000 + 4_500_000 + 3_000_000);
assert.equal(b.payableMicro + b.accruedMicro, 0);
assert.equal(b.paidMicro, 4_000_000);
assert.equal(balancesFrom(rows, null, now).heldMicro, b.heldMicro);
assert.equal(balancesFrom([], "LK", now).totalOpenMicro, 0);
ok("balances: accrued / payable / held / in payout / paid; VOID ignored; a failed payout is not paid");

// 4. Next payout
const base = { country: "LK", isPayoutCountry: true, frozen: false, hasDetails: true, holdUntilMs: null };
const min = creatorsConfig.minPayoutMicroUsd;
assert.deepEqual(nextPayout({ ...base, isPayoutCountry: false }, min), { kind: "none-country" });
assert.deepEqual(nextPayout({ ...base, frozen: true }, min), { kind: "frozen" });
assert.deepEqual(nextPayout({ ...base, hasDetails: false }, min), { kind: "no-details" });
assert.deepEqual(nextPayout({ ...base, holdUntilMs: now + DAY }, min), { kind: "details-wait", untilMs: now + DAY });
assert.deepEqual(nextPayout(base, min - 1), { kind: "need-more", missingMicro: 1 });
assert.deepEqual(nextPayout(base, min), { kind: "ready" });
assert.deepEqual(nextPayout(base, 0), { kind: "need-more", missingMicro: min });
ok("next payout: country, frozen, details, waiting after a change, minimum");

// 5. Roles
assert.equal(roleOf(true, false), "ASKER");
assert.equal(roleOf(false, true), "ANSWER");
assert.equal(roleOf(true, true), "BOTH");
ok("page roles");
console.log("All creator-overview tests passed.");
