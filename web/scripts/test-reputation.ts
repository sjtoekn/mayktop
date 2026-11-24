// Test: reputation, privileges, bounties and accepted answers (SITE_PLAN B4-B6). Run:  npm run test:reputation
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { bountyConfig, reputationConfig } from "../src/config/site";
import {
  bountyExpiry, checkAccept, checkBountyOffer, computeReputation, containsLink, hasPrivilege, heldPoints, isBountyActive,
} from "../src/lib/reputation-rules";

function ok(name: string) { console.log("OK  " + name); }
const zero = { answerUp: 0, answerDown: 0, postUp: 0, postDown: 0, accepted: 0, held: 0, won: 0 };
const NOW = new Date("2026-11-24T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

// ---- reputation
assert.equal(computeReputation(zero), 0);
assert.equal(computeReputation({ ...zero, answerUp: 3 }), 3 * reputationConfig.points.answerUp);
assert.equal(computeReputation({ ...zero, answerUp: 2, accepted: 1, postUp: 1 }), 2 * 10 + 15 + 5);
assert.equal(computeReputation({ ...zero, answerDown: 50 }), 0, "never below 0");
assert.equal(computeReputation({ ...zero, answerUp: 10, held: 60, won: 20 }), 100 - 60 + 20);
assert.equal(computeReputation({ ...zero, held: 500 }), 0);
ok("reputation: votes, accepted answers, held and won bounty points, never below 0");

// ---- privileges
const need = reputationConfig.privileges;
assert.ok(need.link < need.video, "links come first, videos later");
assert.equal(hasPrivilege(0, "link"), false);
assert.equal(hasPrivilege(need.link - 1, "link"), false);
assert.equal(hasPrivilege(need.link, "link"), true);
assert.equal(hasPrivilege(need.video - 1, "video"), false);
assert.equal(hasPrivilege(0, "video", true), true, "staff always may");
ok("privileges: the thresholds, and staff may always");

// ---- links
for (const yes of ["see https://example.com", "http://a.b", "go to www.example.org now", "visit example.com/page", "my site: shop.lk", "HTTPS://X.IO"]) {
  assert.equal(containsLink(yes), true, yes);
}
for (const no of ["no link here", "Version 2.5 is out", "the price is 3.50 dollars", "e.g. this works", "Hello, world.", ""]) {
  assert.equal(containsLink(no), false, no);
}
ok("a link is found, plain text and numbers are not");

// ---- bounty state
const open = { amount: 50, status: "OPEN", expiresAt: new Date(NOW.getTime() + DAY) };
const ran = { amount: 50, status: "OPEN", expiresAt: new Date(NOW.getTime() - DAY) };
const paid = { amount: 50, status: "AWARDED", expiresAt: new Date(NOW.getTime() - 5 * DAY) };
assert.equal(isBountyActive(open, NOW), true);
assert.equal(isBountyActive(ran, NOW), false);
assert.equal(isBountyActive(paid, NOW), false);
assert.equal(isBountyActive(null, NOW), false);
assert.equal(heldPoints([open, ran, paid], NOW), 100, "a running one and a paid one are held; one that ran out is free again");
assert.equal(bountyExpiry(NOW).getTime() - NOW.getTime(), bountyConfig.days * DAY);
ok("a bounty that ran out frees its points, a paid one stays spent");

// ---- offering a bounty
const base = { amount: 50, postKind: "question", hasAcceptedAnswer: false, existing: null, available: 200, now: NOW };
assert.deepEqual(checkBountyOffer(base), { ok: true, amount: 50 });
assert.deepEqual(checkBountyOffer({ ...base, postKind: "article" }), { ok: false, error: "kind" });
assert.deepEqual(checkBountyOffer({ ...base, hasAcceptedAnswer: true }), { ok: false, error: "accepted" });
assert.deepEqual(checkBountyOffer({ ...base, existing: open }), { ok: false, error: "exists" });
assert.deepEqual(checkBountyOffer({ ...base, existing: paid }), { ok: false, error: "exists" });
assert.deepEqual(checkBountyOffer({ ...base, existing: ran }), { ok: true, amount: 50 });
for (const bad of [bountyConfig.min - 1, bountyConfig.max + 1, 30.5, "50", null, NaN]) {
  assert.deepEqual(checkBountyOffer({ ...base, amount: bad }), { ok: false, error: "amount" }, String(bad));
}
assert.deepEqual(checkBountyOffer({ ...base, available: need.bounty - 1, amount: bountyConfig.min }), { ok: false, error: "reputation" });
assert.deepEqual(checkBountyOffer({ ...base, available: need.bounty, amount: need.bounty + 1 }), { ok: false, error: "points" });
assert.deepEqual(checkBountyOffer({ ...base, available: 0, staff: true }), { ok: true, amount: 50 });
ok("a bounty: only on a question, one at a time, a fair amount, enough reputation and points");

// ---- accepting an answer
const acc = { postKind: "question", postAuthorId: "asker", actorId: "asker", commentAuthorId: "helper", commentIsTopLevel: true, commentVisible: true, bountyPaid: false };
assert.deepEqual(checkAccept(acc), { ok: true });
assert.deepEqual(checkAccept({ ...acc, postKind: "article" }), { ok: false, error: "kind" });
assert.deepEqual(checkAccept({ ...acc, actorId: "someone" }), { ok: false, error: "owner" });
assert.deepEqual(checkAccept({ ...acc, commentAuthorId: "asker" }), { ok: false, error: "self" });
assert.deepEqual(checkAccept({ ...acc, commentIsTopLevel: false }), { ok: false, error: "answer" });
assert.deepEqual(checkAccept({ ...acc, commentVisible: false }), { ok: false, error: "answer" });
assert.deepEqual(checkAccept({ ...acc, bountyPaid: true }), { ok: false, error: "paid" });
ok("accepting: only the asker, only on a question, not your own comment, final once a bounty was paid");

console.log("\nAll reputation tests passed.");
