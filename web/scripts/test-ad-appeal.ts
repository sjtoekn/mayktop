// Tests for the ad appeal rules and the "ending soon" rule (ADS_PLAN Session 4c). Run:  npm run test:ad-appeal
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { adAppealState, checkFileAdAppeal } from "../src/lib/ad-appeal-rules";
import { daysLeft, isEndingSoon } from "../src/lib/ad-notice-rules";
import { checkDecideAppeal } from "../src/lib/appeals-rules";
import { checkOwnEdit } from "../src/lib/ad-own-rules";

function ok(name: string) { console.log("OK  " + name); }

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");
const base = {
  appellantId: "adv", advertiserId: "adv", appellantActive: true, status: "REJECTED",
  rejectedAt: new Date(now.getTime() - 2 * DAY), now: now.getTime(), windowDays: 30, alreadyAppealed: false,
};

// ---- filing
assert.equal(checkFileAdAppeal(base), null);
assert.equal(checkFileAdAppeal({ ...base, appellantId: "someone" }), "notfound");
assert.equal(checkFileAdAppeal({ ...base, appellantActive: false }), "actor");
for (const status of ["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "PAUSED", "ENDED"]) {
  assert.equal(checkFileAdAppeal({ ...base, status }), "state", status);
}
assert.equal(checkFileAdAppeal({ ...base, alreadyAppealed: true }), "exists");
assert.equal(checkFileAdAppeal({ ...base, rejectedAt: new Date(now.getTime() - 31 * DAY) }), "window");
assert.equal(checkFileAdAppeal({ ...base, rejectedAt: new Date(now.getTime() - 30 * DAY) }), null);
assert.equal(checkFileAdAppeal({ ...base, rejectedAt: null }), null);
ok("only the advertiser, only a REJECTED ad, once per rejection, inside the window");

// someone else is told \"notfound\" before anything else is checked (we never admit the ad exists)
assert.equal(checkFileAdAppeal({ ...base, appellantId: "someone", status: "ACTIVE", appellantActive: false }), "notfound");
ok("a stranger always gets \"notfound\"");

// ---- state shown on My ads
assert.equal(adAppealState(null, null), "can");
assert.equal(adAppealState(null, "window"), "none");
assert.equal(adAppealState({ status: "OPEN" }, "exists"), "open");
assert.equal(adAppealState({ status: "ACCEPTED" }, "exists"), "accepted");
assert.equal(adAppealState({ status: "REJECTED" }, "exists"), "rejected");
ok("appeal state for the page");

// ---- deciding: admins only, never the advertiser, never someone who decided the ad before
const admin = { id: "a1", isAdmin: true, isCommunityModerator: false };
const mod = { id: "m1", isAdmin: false, isCommunityModerator: true };
const decide = (actor: typeof admin, deciderIds: string[], status: "OPEN" | "ACCEPTED" | "REJECTED" = "OPEN") =>
  checkDecideAppeal({ kind: "ad", actor, appellantId: "adv", deciderIds, status });
assert.equal(decide(admin, ["a0"]), null);
assert.equal(decide(mod, ["a0"]), "allowed");
assert.equal(decide({ ...admin, id: "adv" }, ["a0"]), "self");
assert.equal(decide(admin, ["a1"]), "same");
assert.equal(decide(admin, ["a0"], "ACCEPTED"), "state");
ok("ad appeals: admin only, not the advertiser, not the first reviewer, only while open");

// the older kinds still behave as before
assert.equal(checkDecideAppeal({ kind: "content", actor: mod, appellantId: "x", deciderIds: [], status: "OPEN" }), null);
assert.equal(checkDecideAppeal({ kind: "account", actor: mod, appellantId: "x", deciderIds: [], status: "OPEN" }), "allowed");
ok("content and account appeals unchanged");

// ---- editing is blocked while an appeal is open
const rejectedAd = { status: "REJECTED", advertiserId: "adv", endDate: null as Date | null };
assert.equal(checkOwnEdit(rejectedAd, "adv"), null);
assert.equal(checkOwnEdit(rejectedAd, "adv", false), null);
assert.equal(checkOwnEdit(rejectedAd, "adv", true), "state");
assert.equal(checkOwnEdit(rejectedAd, "someone", true), "notfound");
ok("no edit-and-resend while an appeal is open");

// ---- ending soon
const running = { status: "ACTIVE", endDate: new Date(now.getTime() + 2 * DAY), endingSoonNoticeAt: null as Date | null };
assert.equal(isEndingSoon(running, now, 3), true);
assert.equal(isEndingSoon({ ...running, endDate: new Date(now.getTime() + 3 * DAY) }, now, 3), true);
assert.equal(isEndingSoon({ ...running, endDate: new Date(now.getTime() + 3 * DAY + 1) }, now, 3), false);
assert.equal(isEndingSoon({ ...running, endDate: new Date(now.getTime() - 1) }, now, 3), false);
assert.equal(isEndingSoon({ ...running, endDate: null }, now, 3), false);
assert.equal(isEndingSoon({ ...running, endingSoonNoticeAt: now }, now, 3), false);
assert.equal(isEndingSoon({ ...running, status: "PAUSED" }, now, 3), true);
for (const status of ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ENDED"]) {
  assert.equal(isEndingSoon({ ...running, status }, now, 3), false, status);
}
ok("ending soon: once, only running / paused, only inside the last days, never after the end");

assert.equal(daysLeft(new Date(now.getTime() + 2 * DAY), now), 2);
assert.equal(daysLeft(new Date(now.getTime() + 2 * DAY - 1000), now), 2);
assert.equal(daysLeft(new Date(now.getTime() + 3600 * 1000), now), 1);
assert.equal(daysLeft(new Date(now.getTime() - DAY), now), 1);
ok("days left is rounded up and never below 1");

console.log("\nAll ad appeal tests passed.");
