// Test: profile and sign-in security rules (patch-profile-security). Run:  npm run test:profile
// Needs no database and no network: the save is run against a small stand-in for the database.
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyProfile, type ProfileDb } from "../src/lib/profile";
import {
  checkNewPassword, cleanBio, cleanDisplayName, cleanNewEmail, RESERVED_DISPLAY_NAMES, squashName,
  cleanProfession, cleanProfileVideo, cleanQualifications, cleanSocialLinks, cleanWebsite, parseSocialLinks, serialiseSocialLinks,
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
  const authSource = fs.readFileSync("src/lib/username.ts", "utf8");
  for (const word of RESERVED_DISPLAY_NAMES) assert.ok(authSource.includes(`"${word}"`), `${word} is missing in username.ts`);
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

  // 8. Professional profile (SITE_PLAN C7): profession, qualifications, website, social links
  assert.deepEqual(cleanProfession("  Civil   engineer \n"), { ok: true, value: "Civil engineer" });
  assert.deepEqual(cleanProfession("  "), { ok: true, value: null });
  assert.deepEqual(cleanProfession("x".repeat(profileConfig.professionMax + 1)), { ok: false, reason: "long" });
  assert.deepEqual(cleanProfession(7), { ok: false, reason: "type" });
  assert.equal(cleanProfession("Admin").ok, true); // a profession is not a name: no reserved-word check
  assert.deepEqual(cleanQualifications("BSc\r\n\r\n\r\n\r\nChartered  \nMSc"), { ok: true, value: "BSc\n\nChartered\nMSc" });
  assert.deepEqual(cleanQualifications("q".repeat(profileConfig.qualificationsMax + 1)), { ok: false, reason: "long" });
  assert.deepEqual(cleanQualifications(null), { ok: false, reason: "type" });
  ok("profession and qualifications: cleaned, empty = none, length limits");

  assert.deepEqual(cleanWebsite("example.com"), { ok: true, url: "https://example.com" });
  assert.deepEqual(cleanWebsite(" https://Example.com/ "), { ok: true, url: "https://example.com" });
  assert.deepEqual(cleanWebsite("http://example.com/me?x=1"), { ok: true, url: "https://example.com/me?x=1" }); // upgraded to https
  assert.deepEqual(cleanWebsite("example.com:8080/a"), { ok: true, url: "https://example.com:8080/a" });
  assert.deepEqual(cleanWebsite(""), { ok: true, url: null });
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", "https://user:pw@example.com", "https://localhost", "https://127.0.0.1", "https://[::1]/", "https://nodot", "two words.com", "https://example."]) {
    assert.deepEqual(cleanWebsite(bad), { ok: false, reason: "invalid" }, bad);
  }
  assert.deepEqual(cleanWebsite("https://example.com/" + "a".repeat(profileConfig.websiteMax)), { ok: false, reason: "long" });
  assert.deepEqual(cleanWebsite(3), { ok: false, reason: "type" });
  ok("website: https only, scheme added or upgraded, no scripts, no credentials, no IP or localhost");

  assert.deepEqual(
    cleanSocialLinks([{ kind: "github", url: "github.com/nimal" }, { kind: "linkedin", url: "https://www.linkedin.com/in/nimal" }, { kind: "x", url: "" }]),
    { ok: true, links: [{ kind: "linkedin", url: "https://www.linkedin.com/in/nimal" }, { kind: "github", url: "https://github.com/nimal" }] }, // order of the config, empty dropped
  );
  assert.deepEqual(cleanSocialLinks([{ kind: "x", url: "https://twitter.com/nimal" }, { kind: "x", url: "https://x.com/other" }]), { ok: true, links: [{ kind: "x", url: "https://twitter.com/nimal" }] }); // one per kind, first wins
  assert.deepEqual(cleanSocialLinks([{ kind: "linkedin", url: "https://evil.com/linkedin.com" }]), { ok: false, reason: "invalid" }); // wrong site
  assert.deepEqual(cleanSocialLinks([{ kind: "linkedin", url: "https://notlinkedin.com/in/x" }]), { ok: false, reason: "invalid" }); // look-alike host
  assert.deepEqual(cleanSocialLinks([{ kind: "tiktok", url: "https://tiktok.com/@x" }]), { ok: false, reason: "invalid" }); // unknown kind
  assert.deepEqual(cleanSocialLinks([{ kind: "__proto__", url: "https://x.com/a" }]), { ok: false, reason: "invalid" });
  assert.deepEqual(cleanSocialLinks("nope"), { ok: false, reason: "type" });
  assert.deepEqual(cleanSocialLinks([{ kind: "x" }]), { ok: false, reason: "type" });
  assert.deepEqual(cleanSocialLinks([]), { ok: true, links: [] });
  ok("social links: each link must be on its own site, one per kind, empty dropped, unknown kinds refused");

  const stored = serialiseSocialLinks([{ kind: "github", url: "https://github.com/nimal" }]);
  assert.deepEqual(parseSocialLinks(stored), [{ kind: "github", url: "https://github.com/nimal" }]);
  assert.equal(serialiseSocialLinks([]), null);
  assert.deepEqual(parseSocialLinks(null), []);
  assert.deepEqual(parseSocialLinks("not json"), []);
  assert.deepEqual(parseSocialLinks('[{"kind":"github","url":"javascript:alert(1)"}]'), []); // bad stored text is never shown
  ok("stored social links are read back safely");

  // 9. Saving the professional fields
  const pro = new Map<string, Record<string, unknown>>([["p1", { role: "USER", displayName: "Old", bio: "b", profession: "Keep", website: "https://keep.example", verifiedAt: "2026-11-01" }]]);
  const proDb = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (pro.has(where.id) ? { role: pro.get(where.id)!.role } : null),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { Object.assign(pro.get(where.id)!, data); },
    },
  } as unknown as ProfileDb;
  const saved = await applyProfile(proDb, {
    userId: "p1", displayName: "Nimal", bio: "Hi", profession: " Engineer ", qualifications: "BSc", website: "nimal.dev",
    socialLinks: [{ kind: "github", url: "github.com/nimal" }],
  });
  assert.deepEqual(saved, { ok: true, displayName: "Nimal", bio: "Hi", profession: "Engineer", qualifications: "BSc", website: "https://nimal.dev", socialLinks: [{ kind: "github", url: "https://github.com/nimal" }] });
  assert.equal(pro.get("p1")!.socialLinks, '[{"kind":"github","url":"https://github.com/nimal"}]');
  assert.equal(pro.get("p1")!.verifiedAt, "2026-11-01"); // saving a profile never touches the verified badge
  const proBefore = { ...pro.get("p1")! };
  assert.deepEqual(await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "", website: "javascript:alert(1)" }), { ok: false, error: "website-invalid" });
  assert.deepEqual(await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "", socialLinks: [{ kind: "github", url: "https://evil.com" }] }), { ok: false, error: "links-invalid" });
  assert.deepEqual(await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "", profession: "x".repeat(200) }), { ok: false, error: "profession-long" });
  assert.deepEqual(await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "", qualifications: "q".repeat(900) }), { ok: false, error: "qualifications-long" });
  assert.deepEqual(pro.get("p1"), proBefore); // a refused save changes nothing
  await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "" }); // old callers: the professional fields stay as they are
  assert.equal(pro.get("p1")!.profession, "Engineer");
  await applyProfile(proDb, { userId: "p1", displayName: "N", bio: "", profession: "", website: "", socialLinks: [] }); // empty = remove
  assert.equal(pro.get("p1")!.profession, null);
  assert.equal(pro.get("p1")!.website, null);
  assert.equal(pro.get("p1")!.socialLinks, null);
  ok("saving: professional fields cleaned and written, a refused save writes nothing, empty removes, the verified badge is never touched");

  // 10. Profile video (YouTube only) and the reputation gate on links and video (SITE_PLAN D)
  assert.deepEqual(cleanProfileVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { ok: true, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  assert.deepEqual(cleanProfileVideo("youtu.be/dQw4w9WgXcQ?t=90"), { ok: true, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90" });
  assert.deepEqual(cleanProfileVideo("  "), { ok: true, url: null });
  for (const bad of ["https://example.com/watch?v=dQw4w9WgXcQ", "https://vimeo.com/123", "javascript:alert(1)", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "two words", "https://www.youtube.com/watch?v=bad"]) {
    assert.deepEqual(cleanProfileVideo(bad), { ok: false, reason: "invalid" }, bad);
  }
  assert.deepEqual(cleanProfileVideo(7), { ok: false, reason: "type" });
  ok("profile video: only a real YouTube video, stored in one normal form");

  const gated = new Map<string, Record<string, unknown>>([["g1", { role: "USER", website: "https://keep.example", socialLinks: null, profileVideo: null }]]);
  const gatedDb = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (gated.has(where.id) ? { ...gated.get(where.id)! } : null),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { Object.assign(gated.get(where.id)!, data); },
    },
  } as unknown as ProfileDb;
  const base = { userId: "g1", displayName: "G", bio: "", allowLinks: false, allowVideo: false };
  assert.deepEqual(await applyProfile(gatedDb, { ...base, website: "https://new.example" }), { ok: false, error: "links-locked" });
  assert.deepEqual(await applyProfile(gatedDb, { ...base, socialLinks: [{ kind: "github", url: "github.com/g" }] }), { ok: false, error: "links-locked" });
  assert.deepEqual(await applyProfile(gatedDb, { ...base, profileVideo: "https://youtu.be/dQw4w9WgXcQ" }), { ok: false, error: "video-locked" });
  assert.equal(gated.get("g1")!.website, "https://keep.example"); // a refused save changes nothing
  assert.equal((await applyProfile(gatedDb, { ...base, website: "https://keep.example" })).ok, true); // keeping what is there is fine
  assert.equal((await applyProfile(gatedDb, { ...base, website: "", socialLinks: [], profileVideo: "" })).ok, true); // removing is always fine
  assert.equal(gated.get("g1")!.website, null);
  assert.equal((await applyProfile(gatedDb, { ...base, allowLinks: true, allowVideo: true, website: "https://new.example", profileVideo: "https://youtu.be/dQw4w9WgXcQ" })).ok, true); // enough reputation
  assert.equal(gated.get("g1")!.profileVideo, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  ok("profile links and video: adding or changing needs the privilege; keeping and removing never does");

  // 11. A web address typed into the bio, profession or qualifications is a link too (SITE_PLAN D9)
  const texty = new Map<string, Record<string, unknown>>([["t1", { role: "USER", bio: "Old bio www.old.example", profession: null, qualifications: null, website: null, socialLinks: null, profileVideo: null }]]);
  const textyDb = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => (texty.has(where.id) ? { ...texty.get(where.id)! } : null),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { Object.assign(texty.get(where.id)!, data); },
    },
  } as unknown as ProfileDb;
  const tb = { userId: "t1", displayName: "T", allowLinks: false };
  assert.deepEqual(await applyProfile(textyDb, { ...tb, bio: "Visit https://spam.example now" }), { ok: false, error: "links-locked" });
  assert.deepEqual(await applyProfile(textyDb, { ...tb, bio: "ok", profession: "Buy at shop.xyz" }), { ok: false, error: "links-locked" });
  assert.deepEqual(await applyProfile(textyDb, { ...tb, bio: "ok", qualifications: "see www.me.com/cv" }), { ok: false, error: "links-locked" });
  assert.equal(texty.get("t1")!.bio, "Old bio www.old.example"); // a refused save changes nothing
  assert.equal((await applyProfile(textyDb, { ...tb, bio: "Old bio www.old.example" })).ok, true); // an old text that is kept is fine
  assert.equal((await applyProfile(textyDb, { ...tb, bio: "I teach maths in Kandy", profession: "Teacher", qualifications: "BSc" })).ok, true); // no link: fine
  assert.equal((await applyProfile(textyDb, { ...tb, bio: "" })).ok, true); // removing the link is fine
  assert.equal((await applyProfile(textyDb, { ...tb, allowLinks: true, bio: "Visit https://ok.example" })).ok, true); // enough reputation
  ok("profile bio, profession and qualifications: a new web address needs the link privilege; keeping or removing one never does");

  console.log("\nAll profile tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
