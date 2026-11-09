// Tests for the rules of "an admin edits a profile" (admin panel, People). Run:  npm run test:admin-edit
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { confirmMatches, editAuditReason, looksLikeEmail, planEdit, type ProfileInput, type ProfileValues } from "../src/lib/admin-edit-rules";
import { isValidUsername, normalizeUsername } from "../src/lib/username";

function ok(name: string) { console.log("OK  " + name); }

const limits = { maxName: 50, maxBio: 300 };
const now: ProfileValues = { displayName: "Sam Jones", bio: "Hello there", username: "samj", email: "sam@example.com" };
const same: ProfileInput = { displayName: "Sam Jones", bio: "Hello there", username: "samj", email: "sam@example.com" };

// ---- nothing changed
assert.deepEqual(planEdit(now, same, limits), { problem: "nochange" });
assert.deepEqual(planEdit(now, { ...same, displayName: "  Sam Jones  ", username: " SAMJ ", email: " Sam@Example.com " }, limits), { problem: "nochange" });
assert.deepEqual(planEdit({ ...now, displayName: null, bio: null }, { ...same, displayName: "", bio: "  " }, limits), { problem: "nochange" });
ok("the same values (also with spaces and capitals) are no change at all");

// ---- only what changed is written
const bioOnly = planEdit(now, { ...same, bio: "New bio" }, limits);
assert.equal(bioOnly.problem, null);
if (bioOnly.problem === null) {
  assert.deepEqual(bioOnly.changed, ["bio"]);
  assert.deepEqual(bioOnly.data, { bio: "New bio" });
}
ok("one changed field gives one change");

const all = planEdit(now, { displayName: "S", bio: "", username: "Sam_2", email: "NEW@Example.com" }, limits);
assert.equal(all.problem, null);
if (all.problem === null) {
  assert.deepEqual(all.changed, ["displayName", "bio", "username", "email"]);
  assert.deepEqual(all.data, { displayName: "S", bio: null, username: "sam_2", email: "new@example.com" });
}
ok("username and email are saved in lower case, an empty bio becomes none");

const cleared = planEdit(now, { ...same, displayName: "" }, limits);
assert.equal(cleared.problem, null);
if (cleared.problem === null) assert.deepEqual(cleared.data, { displayName: null });
ok("an admin can clear a display name");

// ---- username
for (const bad of ["ab", "a".repeat(21), "has space", "dash-name", "admin", "Moderator", "deleted", "ünï", ""]) {
  assert.deepEqual(planEdit(now, { ...same, username: bad }, limits), { problem: "username" }, bad);
}
ok("a username must follow the sign-up rule and cannot be reserved");
assert.equal(isValidUsername(normalizeUsername("  Sam_2 ")), true);
ok("the sign-up rule and the admin edit use the same username file");

// an old account whose username the rules would refuse today can still have its bio edited
const legacy: ProfileValues = { ...now, username: "ab" };
const legacyEdit = planEdit(legacy, { ...same, username: "ab", bio: "x" }, limits);
assert.equal(legacyEdit.problem, null);
ok("an unchanged username is not checked again");

// ---- email
for (const bad of ["", "plain", "a@b", "a b@c.com", "@x.com", "a@@b.com", "x".repeat(250) + "@a.com"]) {
  assert.deepEqual(planEdit(now, { ...same, email: bad }, limits), { problem: "email" }, bad);
}
assert.equal(looksLikeEmail("a@b.co"), true);
ok("an email must look like an email");

// ---- name and bio limits (characters, not bytes)
assert.deepEqual(planEdit(now, { ...same, displayName: "x".repeat(51) }, limits), { problem: "name" });
assert.equal(planEdit(now, { ...same, displayName: "x".repeat(50) }, limits).problem, null);
assert.equal(planEdit(now, { ...same, displayName: "ස".repeat(50) }, limits).problem, null);
assert.equal(planEdit(now, { ...same, displayName: "😀".repeat(50) }, limits).problem, null);
assert.deepEqual(planEdit(now, { ...same, displayName: "😀".repeat(51) }, limits), { problem: "name" });
assert.deepEqual(planEdit(now, { ...same, displayName: "two\nlines" }, limits), { problem: "name" });
assert.deepEqual(planEdit(now, { ...same, displayName: "bell\u0007" }, limits), { problem: "name" });
assert.deepEqual(planEdit(now, { ...same, bio: "y".repeat(301) }, limits), { problem: "bio" });
assert.equal(planEdit(now, { ...same, bio: "y".repeat(300) }, limits).problem, null);
assert.equal(planEdit(now, { ...same, bio: "line one\nline two" }, limits).problem, null);
assert.deepEqual(planEdit(now, { ...same, bio: "bad\u0000char" }, limits), { problem: "bio" });
ok("name and bio have a length limit in characters; a bio may have line breaks, a name may not");

// ---- the confirmation of an erasure
assert.equal(confirmMatches("samj", "samj"), true);
assert.equal(confirmMatches("@samj", "samj"), true);
assert.equal(confirmMatches("  @SamJ ", "samj"), true);
assert.equal(confirmMatches("sam", "samj"), false);
assert.equal(confirmMatches("", "samj"), false);
assert.equal(confirmMatches("@@samj", "samj"), false);
ok("erasing needs the username typed (with or without @), nothing else counts");

// ---- the audit row names the fields, never the values
const reason = editAuditReason(["username", "email"], "Impersonating a staff member in the profile.");
assert.equal(reason, "Profile edited (username, email): Impersonating a staff member in the profile.");
assert.ok(!reason.includes("sam_2") && !reason.includes("example.com"));
ok("the audit text lists the names of the fields and the reason, no old or new value");

console.log("\nAll admin edit rule tests passed.");
