// Tests for what an advertiser may do to their own ad (ADS_PLAN Session 4a). Run:  npm run test:ad-own
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { checkOwnEdit, checkOwnEnd, checkOwnPause, checkOwnResume, endedDates, ownActions, wasPausedByAdvertiser } from "../src/lib/ad-own-rules";

function ok(name: string) { console.log("OK  " + name); }

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");
const ad = { status: "ACTIVE", advertiserId: "adv", endDate: null as Date | null };

assert.equal(checkOwnPause(ad, "adv"), null);
assert.equal(checkOwnPause(ad, "someone"), "notfound");
assert.equal(checkOwnPause({ ...ad, status: "PAUSED" }, "adv"), "state");
assert.equal(checkOwnPause({ ...ad, status: "SUBMITTED" }, "adv"), "state");
assert.equal(checkOwnPause({ ...ad, status: "ENDED" }, "adv"), "state");
ok("only the advertiser can pause, and only a running ad");

const paused = { ...ad, status: "PAUSED" };
assert.equal(checkOwnResume(paused, "adv", now, true), null);
assert.equal(checkOwnResume(paused, "someone", now, true), "notfound");
assert.equal(checkOwnResume(paused, "adv", now, false), "staff");
assert.equal(checkOwnResume({ ...paused, endDate: new Date(now.getTime() - DAY) }, "adv", now, true), "expired");
assert.equal(checkOwnResume({ ...paused, endDate: new Date(now.getTime() + DAY) }, "adv", now, true), null);
assert.equal(checkOwnResume(ad, "adv", now, true), "state");
ok("resume: only your own pause, never one made by our team, never after the end date");

assert.equal(wasPausedByAdvertiser({ actorId: "adv" }, "adv"), true);
assert.equal(wasPausedByAdvertiser({ actorId: "admin" }, "adv"), false);
assert.equal(wasPausedByAdvertiser(null, "adv"), false);
ok("who paused it is read from the newest pause record");

assert.deepEqual(ownActions(ad, "adv", now, false), ["pause", "end"]);
assert.deepEqual(ownActions(paused, "adv", now, true), ["resume", "end"]);
assert.deepEqual(ownActions(paused, "adv", now, false), ["end"]);
assert.deepEqual(ownActions({ ...ad, status: "REJECTED" }, "adv", now, false), []);
ok("the buttons shown match the rules");

for (const status of ["SUBMITTED", "APPROVED", "ACTIVE", "PAUSED"]) assert.equal(checkOwnEnd({ ...ad, status }, "adv"), null);
for (const status of ["REJECTED", "ENDED", "DRAFT"]) assert.equal(checkOwnEnd({ ...ad, status }, "adv"), "state");
assert.equal(checkOwnEnd(ad, "someone"), "notfound");
ok("end: withdraw a waiting ad or stop a running / paused one; not twice, not someone else's");

assert.equal(checkOwnEdit({ ...ad, status: "REJECTED" }, "adv"), null);
assert.equal(checkOwnEdit({ ...ad, status: "ACTIVE" }, "adv"), "state");
assert.equal(checkOwnEdit({ ...ad, status: "SUBMITTED" }, "adv"), "state");
assert.equal(checkOwnEdit({ ...ad, status: "REJECTED" }, "someone"), "notfound");
ok("only a rejected ad can be edited and sent again, only by its advertiser");

assert.deepEqual(endedDates({ status: "ACTIVE", endDate: new Date(now.getTime() + DAY) }, now), { endDate: now });
assert.deepEqual(endedDates({ status: "PAUSED", endDate: new Date(now.getTime() - DAY) }, now), {});
assert.deepEqual(endedDates({ status: "SUBMITTED", endDate: null }, now), {});
ok("an ended running ad stops now; an ad that never ran keeps no dates");

console.log("\nAll ad-own tests passed.");
