// Tests for the payout rules (TODO 12, S8). Run:  npm run test:creator-payouts
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import { cleanReason, cleanReference, csvCell, parseCountryFilter, payableRows, payoutCsv, payoutRef, planPayouts, type CreatorForPayout } from "../src/lib/creator-payout-rules";
import { creatorsConfig } from "../src/config/site";

function ok(name: string) { console.log("OK  " + name); }
const DAY = 86_400_000;
const now = Date.UTC(2027, 0, 31, 10);
const old = now - 40 * DAY; // past the 30 day hold
const fresh = now - 5 * DAY; // still in the hold period
const USD = 1_000_000;

const base = (over: Partial<CreatorForPayout> & { userId: string }): CreatorForPayout => ({
  username: over.userId, accountActive: true, country: "LK", method: "PAYPAL", hasDetails: true, frozen: false,
  detailsChangedAtMs: null, rows: [{ id: 1, amountMicroUsd: 12 * USD, createdAtMs: old }], ...over,
});

// 1. A normal creator is ready; the rows are the payable ones only
let plan = planPayouts([base({ userId: "a", rows: [{ id: 1, amountMicroUsd: 8 * USD, createdAtMs: old }, { id: 2, amountMicroUsd: 5 * USD, createdAtMs: old }, { id: 3, amountMicroUsd: 9 * USD, createdAtMs: fresh }] })], now);
assert.equal(plan.ready.length, 1);
assert.deepEqual(plan.ready[0].rowIds, [1, 2]);
assert.equal(plan.ready[0].amountMicro, 13 * USD);
ok("ready: only rows past the hold period are taken");

// 2. Below the minimum, hold period, other country
plan = planPayouts([base({ userId: "b", rows: [{ id: 1, amountMicroUsd: 9 * USD, createdAtMs: old }] })], now);
assert.equal(plan.ready.length, 0);
assert.deepEqual(plan.blocked.map((x) => x.reason), ["minimum"]);
plan = planPayouts([base({ userId: "c", rows: [{ id: 1, amountMicroUsd: 50 * USD, createdAtMs: fresh }] })], now);
assert.equal(plan.ready.length + plan.blocked.length, 0); // only waiting: not listed
plan = planPayouts([base({ userId: "d", country: "US", method: null, rows: [{ id: 1, amountMicroUsd: 50 * USD, createdAtMs: old }] })], now);
assert.equal(plan.ready.length + plan.blocked.length, 0); // kept (HELD_COUNTRY), never paid, never lost
assert.deepEqual(payableRows("US", [{ id: 1, amountMicroUsd: 5, createdAtMs: old }], now), []);
ok("minimum / hold period / country not open");

// 3. Blockers, first match
const reasons = (c: CreatorForPayout) => planPayouts([c], now).blocked.map((x) => x.reason);
assert.deepEqual(reasons(base({ userId: "e", frozen: true })), ["frozen"]);
assert.deepEqual(reasons(base({ userId: "f", method: null })), ["no-method"]);
assert.deepEqual(reasons(base({ userId: "g", method: "BANK_LK", country: "IN" })), ["no-method"]); // India has PayPal only
assert.deepEqual(reasons(base({ userId: "h", hasDetails: false })), ["no-details"]);
assert.deepEqual(reasons(base({ userId: "i", detailsChangedAtMs: now - 2 * DAY })), ["details-wait"]);
assert.equal(planPayouts([base({ userId: "j", detailsChangedAtMs: now - 8 * DAY })], now).ready.length, 1);
assert.deepEqual(reasons(base({ userId: "k", accountActive: false })), ["account"]);
ok("frozen / no method / no details / waiting after a change / banned account");

// 4. A reversal (negative row) lowers the payout at once, even when it is new
plan = planPayouts([base({ userId: "l", rows: [{ id: 1, amountMicroUsd: 15 * USD, createdAtMs: old }, { id: 2, amountMicroUsd: -6 * USD, createdAtMs: now - DAY }] })], now);
assert.equal(plan.ready.length, 0); // 9 < 10
assert.deepEqual(plan.blocked.map((x) => x.reason), ["minimum"]);
plan = planPayouts([base({ userId: "m", rows: [{ id: 1, amountMicroUsd: 15 * USD, createdAtMs: old }, { id: 2, amountMicroUsd: -2 * USD, createdAtMs: now - DAY }] })], now);
assert.equal(plan.ready[0].amountMicro, 13 * USD);
assert.deepEqual(plan.ready[0].rowIds, [1, 2]);
ok("reversals are netted at once");

// 5. Sorted by country, then name; the sum of the plan equals the sum of the payable rows
plan = planPayouts([base({ userId: "z", country: "LK" }), base({ userId: "y", country: "IN" }), base({ userId: "a2", country: "LK" })], now);
assert.deepEqual(plan.ready.map((p) => `${p.country}:${p.username}`), ["IN:y", "LK:a2", "LK:z"]);
ok("order");

// 6. Config filter, reference, reason
assert.equal(parseCountryFilter("lk"), "LK");
assert.equal(parseCountryFilter("US"), null);
assert.equal(parseCountryFilter(undefined), null);
assert.equal(cleanReference("  PP  123 "), "PP 123");
assert.equal(cleanReference("ab"), null);
assert.equal(cleanReference("x".repeat(81)), null);
assert.equal(cleanReason("too short"), null);
assert.equal(cleanReason("bad traffic from one IP"), "bad traffic from one IP");
ok("filter, reference, reason");

// 7. CSV
assert.equal(csvCell('a"b'), '"a""b"');
assert.equal(csvCell("=SUM(A1)"), `"'=SUM(A1)"`);
assert.equal(csvCell("line\nbreak"), '"line break"');
const pp = payoutCsv("PAYPAL", [
  { payoutId: 7, username: "a", amountMicro: 12_345_678, details: "me@mail.com" },
  { payoutId: 8, username: "b", amountMicro: 10 * USD, details: null },
]);
assert.deepEqual(pp.missing, [8]);
assert.ok(pp.csv.includes(`"me@mail.com","12.34","${creatorsConfig.currency}","${payoutRef(7)}"`)); // rounded DOWN to cents
assert.ok(!pp.csv.includes("FALV-8"));
const bank = payoutCsv("BANK_LK", [
  { payoutId: 9, username: "c", amountMicro: 20 * USD, details: JSON.stringify({ bankName: "BOC", branch: "Colombo", holderName: "A B", accountNumber: "123456789" }) },
  { payoutId: 10, username: "d", amountMicro: 20 * USD, details: "not json" },
]);
assert.deepEqual(bank.missing, [10]);
assert.ok(bank.csv.includes('"FALV-9","A B","BOC","Colombo","123456789","20.00"'));
ok("CSV (rounded down, formula-safe, unreadable details left out)");

console.log("All payout rule tests passed.");
