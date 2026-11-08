// Test: editing your own Social post (SOCIAL_TODO 12). Run:  npm run test:social-edit
// Needs no database: applySocialEdit() is run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialEdit } from "../src/lib/social-edit";
import { checkRules } from "../src/lib/social-limits";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = { id: number; authorId: string; body: string; status: string; deletedAt: Date | null; editedAt: Date | null };

// Just enough of Prisma's socialPost.findFirst / updateMany for the rules in social-edit.ts.
function fakeDb(rows: Row[]) {
  const match = (r: Row, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => (r as Record<string, unknown>)[k] === v);
  return {
    rows,
    socialPost: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => match(r, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
}
const row = (over: Partial<Row> = {}): Row => ({
  id: 1, authorId: "me", body: "first text", status: "VISIBLE", deletedAt: null, editedAt: null, ...over,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (db: ReturnType<typeof fakeDb>, input: { id: number; authorId: string; body: unknown }) => applySocialEdit(db as any, input);

async function main() {
  // 1. author edits own visible post
  let db = fakeDb([row()]);
  let r = await run(db, { id: 1, authorId: "me", body: "  second\r\ntext  " });
  assert.deepEqual(r, { ok: true, changed: true });
  assert.equal(db.rows[0].body, "second\ntext");
  assert.ok(db.rows[0].editedAt instanceof Date);
  ok("the author can edit; text is cleaned like a new post; editedAt is set");

  // 2. same text: nothing changes, no "Edited" label
  db = fakeDb([row()]);
  r = await run(db, { id: 1, authorId: "me", body: "first text" });
  assert.deepEqual(r, { ok: true, changed: false });
  assert.equal(db.rows[0].editedAt, null);
  ok("saving the same text changes nothing and does not mark the post as edited");

  // 3. someone else's post
  db = fakeDb([row({ authorId: "other" })]);
  r = await run(db, { id: 1, authorId: "me", body: "hacked" });
  assert.deepEqual(r, { ok: false, reason: "notfound" });
  assert.equal(db.rows[0].body, "first text");
  ok("nobody can edit another person's post");

  // 4. hidden / removed / deleted posts
  for (const over of [{ status: "HIDDEN_PENDING_REVIEW" }, { status: "REMOVED" }, { deletedAt: new Date() }]) {
    db = fakeDb([row(over)]);
    r = await run(db, { id: 1, authorId: "me", body: "changed" });
    assert.deepEqual(r, { ok: false, reason: "notfound" });
    assert.equal(db.rows[0].body, "first text");
  }
  ok("a hidden, removed or deleted post cannot be edited");

  // 5. bad text
  db = fakeDb([row()]);
  for (const body of ["", "   \n ", "\u200B\u200D", "x".repeat(5001)]) {
    r = await run(db, { id: 1, authorId: "me", body });
    assert.deepEqual(r, { ok: false, reason: "invalid" });
  }
  r = await run(db, { id: 1, authorId: "me", body: 42 });
  assert.deepEqual(r, { ok: false, reason: "error" });
  assert.equal(db.rows[0].body, "first text");
  ok("empty, invisible-only, too long and non-text input are refused; the post is untouched");

  // 6. bad ids
  for (const id of [0, -1, 1.5, Number.NaN]) {
    r = await run(db, { id, authorId: "me", body: "ok" });
    assert.deepEqual(r, { ok: false, reason: "error" });
  }
  ok("bad post numbers are refused");

  // 7. 5,000 characters is allowed
  r = await run(db, { id: 1, authorId: "me", body: "y".repeat(5000) });
  assert.deepEqual(r, { ok: true, changed: true });
  ok("exactly 5,000 characters is allowed");

  // 8. rate limit numbers
  const rules = [{ max: socialLimits.edits.max, windowMs: socialLimits.edits.windowMinutes * 60_000 }];
  const now = 1_000_000;
  const times = Array.from({ length: socialLimits.edits.max }, (_, i) => now - i * 1000);
  assert.equal(checkRules(times, rules, now).ok, false);
  assert.equal(checkRules(times.slice(1), rules, now).ok, true);
  ok(`edit limit: ${socialLimits.edits.max} per ${socialLimits.edits.windowMinutes} minutes`);

  // 9. texts
  const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
  const keys = Object.keys(en).filter((k) => k.startsWith("social.edit."))
    .concat("social.edit");
  assert.equal(keys.length, 9);
  for (const [lang, m] of Object.entries(languages)) {
    for (const k of keys) {
      assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
      assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
      if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
    }
    assert.ok((m["social.edit.toomany"] as string).includes("{minutes}"), `${lang}: {minutes} lost`);
  }
  ok("all 9 edit texts exist in six languages and {minutes} is kept");

  console.log("\nAll social edit tests passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
