// Tests for the "hidden pending review" rules (TODO 38). Run:  npm run test:review
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { DAY_MS, checkDecide, checkHide, cleanText, excerpt, isOverdue, type Actor } from "../src/lib/review-rules";

function ok(name: string) { console.log("OK  " + name); }

const mod: Actor = { id: "mod1", isAdmin: false, isCommunityModerator: true };
const mod2: Actor = { id: "mod2", isAdmin: false, isCommunityModerator: true };
const admin: Actor = { id: "adm", isAdmin: true, isCommunityModerator: false };
const plain: Actor = { id: "usr", isAdmin: false, isCommunityModerator: false };
const base = { authorId: "author", status: "VISIBLE" as const, erased: false };

// 1. Who may hide.
assert.equal(checkHide({ actor: mod, ...base }), null);
assert.equal(checkHide({ actor: admin, ...base }), null);
assert.equal(checkHide({ actor: plain, ...base }), "allowed");
ok("only a moderator of the community or an admin can hide");

// 2. Nobody acts on their own content.
assert.equal(checkHide({ actor: { ...mod, id: "author" }, ...base }), "self");
assert.equal(checkDecide({ actor: { ...admin, id: "author" }, authorId: "author", hiderId: "mod1", status: "HIDDEN_PENDING_REVIEW" }), "self");
ok("nobody can act on their own post or comment");

// 3. Hide only works on visible, not erased content.
assert.equal(checkHide({ actor: mod, ...base, status: "HIDDEN_PENDING_REVIEW" }), "state");
assert.equal(checkHide({ actor: mod, ...base, status: "REMOVED" }), "state");
assert.equal(checkHide({ actor: mod, ...base, erased: true }), "state");
ok("hide needs visible content that the author has not erased");

// 4. The decision needs a DIFFERENT person than the one who hid it.
const pending = { authorId: "author", status: "HIDDEN_PENDING_REVIEW" as const };
assert.equal(checkDecide({ actor: mod, ...pending, hiderId: "mod1" }), "same");
assert.equal(checkDecide({ actor: mod2, ...pending, hiderId: "mod1" }), null);
assert.equal(checkDecide({ actor: admin, ...pending, hiderId: "mod1" }), null);
ok("the person who hid it cannot decide; a second person can");

// 5. Unknown hider (status set by hand): the other checks still apply.
assert.equal(checkDecide({ actor: mod, ...pending, hiderId: null }), null);
assert.equal(checkDecide({ actor: plain, ...pending, hiderId: null }), "allowed");
ok("an unrecorded hider does not block a deciding moderator, a plain user is still refused");

// 6. Decide needs hidden content.
assert.equal(checkDecide({ actor: mod2, authorId: "author", status: "VISIBLE", hiderId: "mod1" }), "state");
assert.equal(checkDecide({ actor: mod2, authorId: "author", status: "REMOVED", hiderId: "mod1" }), "state");
ok("remove / restore only work on content hidden for review");

// 7. Written text length.
assert.equal(cleanText("   short  ", 20, 1000), null);
assert.equal(cleanText("x".repeat(1001), 20, 1000), null);
assert.equal(cleanText("  " + "x".repeat(20) + "  ", 20, 1000), "x".repeat(20));
ok("a written reason needs a real length (trimmed)");

// 8. Overdue.
const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
assert.equal(isOverdue(new Date(NOW - 6 * DAY_MS), NOW, 7), false);
assert.equal(isOverdue(new Date(NOW - 8 * DAY_MS), NOW, 7), true);
assert.equal(isOverdue(null, NOW, 7), false);
ok("waiting longer than the due days is overdue");

// 9. Excerpt.
assert.equal(excerpt("  Hello\n\n  world  ", 80), "Hello world");
assert.equal(excerpt("a".repeat(100), 20), "a".repeat(17) + "...");
assert.ok(excerpt("a".repeat(100), 20).length <= 20);
ok("the preview is one line and never longer than the limit");

console.log("\nAll review rule tests passed.");
