// Tests for the appeal rules (TODO 40). Run:  npm run test:appeals
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { DAY_MS } from "../src/lib/review-rules";
import { checkDecideAppeal, checkFileContentAppeal, cleanAppealText, isAppealOverdue, type Reviewer } from "../src/lib/appeals-rules";

function ok(name: string) { console.log("OK  " + name); }

const now = Date.UTC(2026, 10, 7);
const fileBase = {
  appellantId: "author", authorId: "author", appellantActive: true, status: "REMOVED" as const, erased: false,
  removedAt: new Date(now - 2 * DAY_MS), now, windowDays: 30, alreadyAppealed: false,
};

// 1. Filing: the happy path, and only the author.
assert.equal(checkFileContentAppeal(fileBase), null);
assert.equal(checkFileContentAppeal({ ...fileBase, appellantId: "someone-else" }), "allowed");
ok("the author of a removed item can appeal; nobody else can");

// 2. Only an active account, only a REMOVED item, nothing erased.
assert.equal(checkFileContentAppeal({ ...fileBase, appellantActive: false }), "actor");
assert.equal(checkFileContentAppeal({ ...fileBase, status: "HIDDEN_PENDING_REVIEW" }), "state");
assert.equal(checkFileContentAppeal({ ...fileBase, status: "VISIBLE" }), "state");
assert.equal(checkFileContentAppeal({ ...fileBase, erased: true }), "state");
ok("only a removed item that the author did not erase, and only from an active account");

// 3. One appeal per decision.
assert.equal(checkFileContentAppeal({ ...fileBase, alreadyAppealed: true }), "exists");
ok("a decision can be appealed only once");

// 4. The window.
assert.equal(checkFileContentAppeal({ ...fileBase, removedAt: new Date(now - 30 * DAY_MS) }), null);
assert.equal(checkFileContentAppeal({ ...fileBase, removedAt: new Date(now - 31 * DAY_MS) }), "window");
assert.equal(checkFileContentAppeal({ ...fileBase, removedAt: null }), null);
ok("the appeal window is respected (30 days inclusive; an unknown removal date does not block)");

// 5. Deciding: who may read a content appeal / an account appeal.
const mod: Reviewer = { id: "mod3", isAdmin: false, isCommunityModerator: true };
const admin: Reviewer = { id: "adm3", isAdmin: true, isCommunityModerator: false };
const plain: Reviewer = { id: "usr", isAdmin: false, isCommunityModerator: false };
const open = { appellantId: "author", deciderIds: ["mod1", "mod2"], status: "OPEN" as const };
assert.equal(checkDecideAppeal({ kind: "content", actor: mod, ...open }), null);
assert.equal(checkDecideAppeal({ kind: "content", actor: admin, ...open }), null);
assert.equal(checkDecideAppeal({ kind: "content", actor: plain, ...open }), "allowed");
assert.equal(checkDecideAppeal({ kind: "account", actor: admin, ...open }), null);
assert.equal(checkDecideAppeal({ kind: "account", actor: mod, ...open }), "allowed");
ok("content appeals: moderator of the community or admin; account appeals: admin only");

// 6. Nobody judges their own case: not the appellant, not anyone who decided the first time.
assert.equal(checkDecideAppeal({ kind: "content", actor: { ...admin, id: "author" }, ...open }), "self");
assert.equal(checkDecideAppeal({ kind: "content", actor: { ...mod, id: "mod1" }, ...open }), "same");
assert.equal(checkDecideAppeal({ kind: "content", actor: { ...admin, id: "mod2" }, ...open }), "same");
assert.equal(checkDecideAppeal({ kind: "account", actor: { ...admin, id: "mod1" }, ...open }), "same");
ok("the appellant and everyone who decided the first time are refused");

// 7. Only an open appeal can be decided.
assert.equal(checkDecideAppeal({ kind: "content", actor: mod, ...open, status: "ACCEPTED" }), "state");
assert.equal(checkDecideAppeal({ kind: "account", actor: admin, ...open, status: "REJECTED" }), "state");
ok("a decided appeal cannot be decided again");

// 8. Written text.
assert.equal(cleanAppealText("   short  ", 20, 2000), null);
assert.equal(cleanAppealText("x".repeat(2001), 20, 2000), null);
assert.equal(cleanAppealText("  " + "y".repeat(20) + "  ", 20, 2000), "y".repeat(20));
ok("written text must have a real length and is trimmed");

// 9. Overdue flag.
assert.equal(isAppealOverdue(new Date(now - 8 * DAY_MS), now, 7), true);
assert.equal(isAppealOverdue(new Date(now - 7 * DAY_MS), now, 7), false);
ok("an appeal waiting longer than the due days is flagged");

console.log("\nAll appeal rule tests passed.");
