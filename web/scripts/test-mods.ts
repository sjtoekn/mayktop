// Tests for the "shared power" rules (TODO 42). Run:  npm run test:mods
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { checkAppoint, checkRemove, isLarge, isOverLimit } from "../src/lib/moderators-rules";

function ok(name: string) { console.log("OK  " + name); }

assert.equal(isLarge(999, 1000), false);
assert.equal(isLarge(1000, 1000), true);
ok("a community is large from the threshold on");

const base = { targetActive: true, alreadyModerator: false, communityIsLarge: true, largeLed: 0, max: 3 };
assert.equal(checkAppoint(base), null);
assert.equal(checkAppoint({ ...base, largeLed: 2 }), null);
assert.equal(checkAppoint({ ...base, largeLed: 3 }), "limit");
assert.equal(checkAppoint({ ...base, largeLed: 7 }), "limit");
ok("a person can lead up to the maximum of large communities, not one more");

assert.equal(checkAppoint({ ...base, communityIsLarge: false, largeLed: 3 }), null);
assert.equal(checkAppoint({ ...base, communityIsLarge: false, largeLed: 50 }), null);
ok("small communities are never limited");

assert.equal(checkAppoint({ ...base, targetActive: false }), "target");
assert.equal(checkAppoint({ ...base, alreadyModerator: true }), "already");
ok("only an active person, and not twice");

assert.equal(checkRemove({ isModerator: true, moderatorCount: 2 }), null);
assert.equal(checkRemove({ isModerator: true, moderatorCount: 1 }), "last");
assert.equal(checkRemove({ isModerator: false, moderatorCount: 3 }), "notmod");
ok("a moderator can be removed unless they are the last one");

assert.equal(isOverLimit(3, 3), false);
assert.equal(isOverLimit(4, 3), true);
ok("over the limit means more than the maximum (those people are listed, never silently demoted)");

console.log("\nAll moderator rule tests passed.");
