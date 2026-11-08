// Tests for the ad review rules (TODO 48 Part 8). Run:  npm run test:ad-review
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { checkApprove, checkPaid, checkPause, checkReject, checkRestore, ctrText, isPolicyRule, runDates } from "../src/lib/ad-review-rules";

function ok(name: string) { console.log("OK  " + name); }

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");
const ad = { status: "SUBMITTED", paymentStatus: "UNPAID", advertiserId: "adv", endDate: null as Date | null };

assert.equal(checkApprove(ad, "admin"), null);
assert.equal(checkApprove(ad, "adv"), "self");
assert.equal(checkApprove({ ...ad, status: "APPROVED" }, "admin"), "state");
assert.equal(checkApprove({ ...ad, status: "REJECTED" }, "admin"), "state");
ok("only a submitted ad can be approved, never by its own advertiser");

assert.equal(checkReject(ad, "admin", "MISLEADING"), null);
assert.equal(checkReject(ad, "admin", ""), "rule");
assert.equal(checkReject(ad, "admin", "NOT_A_RULE"), "rule");
assert.equal(checkReject(ad, "adv", "MISLEADING"), "self");
assert.equal(isPolicyRule("TECHNICAL"), true);
assert.equal(isPolicyRule("technical"), false);
ok("a rejection needs one of the ad policy rules");

assert.equal(checkPause({ ...ad, status: "ACTIVE" }), null);
assert.equal(checkPause({ ...ad, status: "PAUSED" }), "state");
assert.equal(checkPause({ ...ad, status: "SUBMITTED" }), "state");
ok("only a running ad can be paused");

const paused = { ...ad, status: "PAUSED" };
assert.equal(checkRestore(paused, "admin", now), null);
assert.equal(checkRestore(paused, "adv", now), "self");
assert.equal(checkRestore({ ...paused, endDate: new Date(now.getTime() - DAY) }, "admin", now), "expired");
assert.equal(checkRestore({ ...paused, endDate: new Date(now.getTime() + DAY) }, "admin", now), null);
assert.equal(checkRestore({ ...ad, status: "ACTIVE" }, "admin", now), "state");
ok("a paused ad comes back, unless it is yours or its end date has passed");

const approved = { ...ad, status: "APPROVED" };
assert.equal(checkPaid(approved, "admin", now), null);
assert.equal(checkPaid(approved, "adv", now), "self");
assert.equal(checkPaid({ ...approved, paymentStatus: "PAID" }, "admin", now), "state");
assert.equal(checkPaid({ ...ad, status: "SUBMITTED" }, "admin", now), "state");
assert.equal(checkPaid({ ...approved, endDate: new Date(now.getTime() - 1) }, "admin", now), "expired");
ok("payment is marked only after approval, once, and not by the advertiser");

let d = runDates({ startDate: null, endDate: null }, now, 30);
assert.equal(d.startDate.getTime(), now.getTime());
assert.equal(d.endDate.getTime(), now.getTime() + 30 * DAY);
ok("no dates asked: starts now and runs the standard period");

const future = new Date(now.getTime() + 5 * DAY);
d = runDates({ startDate: future, endDate: null }, now, 30);
assert.equal(d.startDate.getTime(), future.getTime());
assert.equal(d.endDate.getTime(), future.getTime() + 30 * DAY);
d = runDates({ startDate: new Date(now.getTime() - 3 * DAY), endDate: new Date(now.getTime() + 10 * DAY) }, now, 30);
assert.equal(d.startDate.getTime(), now.getTime());
assert.equal(d.endDate.getTime(), now.getTime() + 10 * DAY);
ok("a later start and a later end date the advertiser asked for are kept");

assert.equal(ctrText(0, 0), "-");
assert.equal(ctrText(200, 5), "2.5%");
ok("click-through rate text");

console.log("\nAll ad review rule tests passed.");
