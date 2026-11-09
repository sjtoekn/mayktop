// Test: profile and sign-in security rules (patch-profile-security). Run:  npm run test:profile
// Needs no database and no network: the save is run against a small stand-in for the database.
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyProfile, type ProfileDb } from "../src/lib/profile";
import {
  checkNewPassword, cleanBio, cleanDisplayName, cleanNewEmail, RESERVED_DISPLAY_NAMES, squashName,
} from "../src/lib/profile-rules";
import { profileConfig } from "../src/config/site";

function ok(name: string) { console.log("OK  " + name); }

async function main() {
  // 1. Display name
  assert.deepEqual(cleanDisplayName("  Nimal   Perera \n"), { ok: true, name: "Nimal Perera" });
  assert.deepEqual(cleanDisplayName("   "), { ok: true, name: null });
  assert.deepEqual(cleanDisplayName("\u200B\u200D"), { ok: true, name: null });
  assert.deepEqual(cleanDisplayName("a\u202Eb"), { ok: true, name: "a b" }); // bidi override removed
  assert.deepEqual(cleanDisplayName("ශ්‍රී ලංකා"), { ok: true, name: "ශ්‍රී ලංකා" }); // the Sinhala joiner stays
  for (const bad of [null, undefined, 5, {}, ["a"]]) assert.deepEqual(cleanDisplayName(bad), { ok: false, reason: "type" });
  assert.deepEqual(cleanDisplayName("x".repeat(profileConfig.displayNameMax + 1)), { ok: false, reason: "long" });
  assert.equal(cleanDisplayName("x".repeat(profileConfig.displayNameMax)).ok, true);
  assert.equal(cleanDisplayName("😀".repeat(profileConfig.displayNameMax)).ok, true); // an emoji is one character
  ok("display name: one line, cleaned, empty = none, length counted in visible characters");

  // 2. Reserved names
  for (const word of ["Admin", "A d m i n", "M.O.D.E.R.A.T.O.R", "ＭａｙｋＴｏｐ", "Support"]) {
    assert.deepEqual(cleanDisplayName(word), { ok: false, reason: "reserved" }, word);
    assert.equal(cleanDisplayName(word, true).ok, true, word + " (staff)");
  }
  assert.equal(cleanDisplayName("Admin Kumara").ok, true); // only the whole name is reserved
  assert.equal(squashName("Ａdmin!"), "admin");
  ok("names that look like staff or the site are refused for ordinary people, allowed for staff");

  // 3. The reserved list is the same as the username list in auth.ts
  const authSource = fs.readFileSync("src/lib/auth.ts", "utf8");
  for (const word of RESERVED_DISPLAY_NAMES) assert.ok(authSource.includes(`"${word}"`), `${word} is missing in auth.ts`);
  const block = authSource.match(/RESERVED_USERNAMES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
  assert.equal((block.match(/"[a-z]+"/g) ?? []).length, RESERVED_DISPLAY_NAMES.length);
  ok("reserved words equal RESERVED_USERNAMES in auth.ts");

  // 4. Bio
  assert.deepEqual(cleanBio("  Hello\r\n\r\n\r\n\r\nworld  "), { ok: true, bio: "Hello\n\nworld" });
  assert.deepEqual(cleanBio("line  \nnext"), { ok: true, bio: "line\nnext" });
  assert.deepEqual(cleanBio(" \n \u200B "), { ok: true, bio: null });
  assert.deepEqual(cleanBio("a\u0000b\u202Ec"), { ok: true, bio: "abc" });
  assert.deepEqual(cleanBio("y".repeat(profileConfig.bioMax + 1)), { ok: false, reason: "long" });
  assert.equal(cleanBio("y".repeat(profileConfig.bioMax)).ok, true);
  assert.deepEqual(cleanBio("z".repeat(6000)), { ok: false, reason: "long" });
  assert.deepEqual(cleanBio(12), { ok: false, reason: "type" });
  ok("bio: line breaks kept, control and bidi-override characters removed, empty = none, length limit");

  // 5. Password input
  assert.equal(checkNewPassword("old-password", "new-password-1"), null);
  assert.equal(checkNewPassword("old-password", "short"), "short");
  assert.equal(checkNewPassword("old-password", "x".repeat(129)), "long");
  assert.equal(checkNewPassword("same-password", "same-password"), "same");
  assert.equal(checkNewPassword(1, "new-password-1"), "type");
  assert.equal(checkNewPassword("old-password", null), "type");
  ok("new password: 8-128 characters, not the same as the old one");

  // 6. Email input
  assert.deepEqual(cleanNewEmail("  New.Name@Example.COM ", "old@example.com"), { ok: true, email: "new.name@example.com" });
  assert.deepEqual(cleanNewEmail("OLD@example.com", "old@example.com"), { ok: false, reason: "same" });
  for (const bad of ["", "no-at-sign", "a@b", "a b@example.com", "a@@example.com", "<x>@example.com", "a@example.com,b@example.com", "x".repeat(250) + "@example.com"]) {
    assert.deepEqual(cleanNewEmail(bad, "old@example.com"), { ok: false, reason: "invalid" }, bad);
  }
  assert.deepEqual(cleanNewEmail(null, "old@example.com"), { ok: false, reason: "type" });
  ok("new email: trimmed, lower case, plausible shape, different from the current one");

  // 7. Saving
  const rows = new Map<string, { role: string; displayName: string | null; bio: string | null }>([
    ["u1", { role: "USER", displayName: "Old", bio: "old bio" }],
    ["a1", { role: "ADMIN", displayName: null, bio: null }],
  ]);
  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (rows.has(where.id) ? { role: rows.get(where.id)!.role } : null),
      update: async ({ where, data }: { where: { id: string }; data: { displayName: string | null; bio: string | null } }) => {
        Object.assign(rows.get(where.id)!, data);
      },
    },
  } as unknown as ProfileDb;
  assert.deepEqual(await applyProfile(db, { userId: "u1", displayName: " Nimal ", bio: "Hi" }), { ok: true, displayName: "Nimal", bio: "Hi" });
  assert.equal(rows.get("u1")!.displayName, "Nimal");
  assert.deepEqual(await applyProfile(db, { userId: "u1", displayName: "", bio: "" }), { ok: true, displayName: null, bio: null });
  assert.equal(rows.get("u1")!.bio, null);
  const before = { ...rows.get("u1")! };
  assert.deepEqual(await applyProfile(db, { userId: "u1", displayName: "Admin", bio: "x" }), { ok: false, error: "name-reserved" });
  assert.deepEqual(await applyProfile(db, { userId: "u1", displayName: "ok", bio: "q".repeat(400) }), { ok: false, error: "bio-long" });
  assert.deepEqual(await applyProfile(db, { userId: "u1", displayName: 5, bio: "x" }), { ok: false, error: "input" });
  assert.deepEqual(rows.get("u1"), before); // a refused save changes nothing
  assert.deepEqual(await applyProfile(db, { userId: "a1", displayName: "Admin", bio: "" }), { ok: true, displayName: "Admin", bio: null });
  assert.deepEqual(await applyProfile(db, { userId: "nobody", displayName: "x", bio: "y" }), { ok: false, error: "missing" });
  ok("saving: cleaned values are written; a refused save writes nothing; staff may use reserved names");

  console.log("\nAll profile tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
