// Test: editing your own Social post (SOCIAL_TODO 12) with the edit window and the edit history (item 6). Run:  npm run test:social-edit
// Needs no database: applySocialEdit() is run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialEdit } from "../src/lib/social-edit";
import { checkRules } from "../src/lib/social-limits";
import { socialEdit, socialLimits } from "../src/config/site";
import { checkEditAllowed, editsLeft, editWindowEndsAtMs } from "../src/lib/social-edit-rules";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = { id: number; authorId: string; body: string; status: string; deletedAt: Date | null; editedAt: Date | null; createdAt: Date };
type EditRow = { socialPostId: number; body: string; writtenAt: Date };

// Just enough of Prisma's socialPost.findFirst / updateMany and socialPostEdit.count / create for the rules in social-edit.ts.
// `beforeUpdate` lets a test change the row between "read" and "save", the way a second edit at the same moment would.
function fakeDb(rows: Row[], edits: EditRow[] = [], hooks: { beforeUpdate?: () => void } = {}) {
  const match = (r: Row, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => (r as Record<string, unknown>)[k] === v);
  return {
    rows,
    edits,
    socialPost: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const hit = rows.find((r) => match(r, where));
        return hit ? { ...hit } : null; // a copy, like a real read
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        hooks.beforeUpdate?.();
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
    socialPostEdit: {
      count: async ({ where }: { where: { socialPostId: number } }) => edits.filter((e) => e.socialPostId === where.socialPostId).length,
      create: async ({ data }: { data: EditRow }) => { edits.push({ ...data }); return data; },
    },
  };
}
const MIN = 60_000;
const row = (over: Partial<Row> = {}): Row => ({
  id: 1, authorId: "me", body: "first text", status: "VISIBLE", deletedAt: null, editedAt: null, createdAt: new Date(), ...over,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (db: ReturnType<typeof fakeDb>, input: { id: number; authorId: string; body: unknown; now?: Date }) => applySocialEdit(db as any, input);

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
  const keys = Object.keys(en).filter((k) => k.startsWith("social.edit.") || k.startsWith("social.history."))
    .concat("social.edit");
  assert.equal(keys.length, 20); // 9 old edit texts + 3 new edit texts + 8 history texts
  for (const [lang, m] of Object.entries(languages)) {
    for (const k of keys) {
      assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
      assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
      if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
    }
    const has = (k: string, token: string) => assert.ok((m[k] as string).includes(token), `${lang}: ${token} lost in ${k}`);
    has("social.edit.toomany", "{minutes}");
    has("social.edit.window", "{minutes}");
    has("social.edit.limit", "{max}");
    has("social.edit.hint", "{left}");
    has("social.edit.hint", "{max}");
    has("social.history.current", "{time}");
    has("social.history.earlier", "{time}");
  }
  ok("all 20 edit and history texts exist in six languages and their {placeholders} are kept");

  // 10. EDIT WINDOW: counted from when the post was written, never restarted by an edit
  const T0 = new Date("2026-11-19T10:00:00Z");
  const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);
  db = fakeDb([row({ createdAt: T0 })]);
  r = await run(db, { id: 1, authorId: "me", body: "late edit", now: at(socialEdit.windowMinutes + 1) });
  assert.deepEqual(r, { ok: false, reason: "window" });
  assert.equal(db.rows[0].body, "first text");
  assert.equal(db.rows[0].editedAt, null);
  assert.equal(db.edits.length, 0);
  ok(`after ${socialEdit.windowMinutes} minutes an edit is refused ("window"); the post and its history are untouched`);

  db = fakeDb([row({ createdAt: T0 })]);
  r = await run(db, { id: 1, authorId: "me", body: "on time", now: at(socialEdit.windowMinutes) });
  assert.deepEqual(r, { ok: true, changed: true });
  ok("exactly at the end of the window the edit is still allowed");

  db = fakeDb([row({ createdAt: T0 })]);
  await run(db, { id: 1, authorId: "me", body: "edit one", now: at(socialEdit.windowMinutes - 1) });
  r = await run(db, { id: 1, authorId: "me", body: "edit two", now: at(socialEdit.windowMinutes + 5) });
  assert.deepEqual(r, { ok: false, reason: "window" });
  ok("an edit does not restart the window");

  db = fakeDb([row({ createdAt: T0 })]);
  r = await run(db, { id: 1, authorId: "me", body: "first text", now: at(socialEdit.windowMinutes + 500) });
  assert.deepEqual(r, { ok: true, changed: false });
  ok("saving the same text after the window is not an error: nothing changes");

  // 11. EDIT COUNT
  const priorEdits = (n: number): EditRow[] => Array.from({ length: n }, (_, i) => ({ socialPostId: 1, body: `v${i}`, writtenAt: T0 }));
  db = fakeDb([row({ createdAt: T0 })], priorEdits(socialEdit.maxEdits));
  r = await run(db, { id: 1, authorId: "me", body: "one too many", now: at(1) });
  assert.deepEqual(r, { ok: false, reason: "limit" });
  assert.equal(db.rows[0].body, "first text");
  assert.equal(db.edits.length, socialEdit.maxEdits);
  ok(`after ${socialEdit.maxEdits} edits the next one is refused ("limit")`);

  db = fakeDb([row({ createdAt: T0 })], priorEdits(socialEdit.maxEdits - 1));
  r = await run(db, { id: 1, authorId: "me", body: "the last one", now: at(1) });
  assert.deepEqual(r, { ok: true, changed: true });
  assert.equal(db.edits.length, socialEdit.maxEdits);
  ok("the last allowed edit works");

  // 12. EDIT HISTORY: the replaced text is saved, with the time it was written
  db = fakeDb([row({ createdAt: T0, body: "original" })]);
  await run(db, { id: 1, authorId: "me", body: "second", now: at(10) });
  await run(db, { id: 1, authorId: "me", body: "third", now: at(20) });
  assert.deepEqual(db.edits.map((e) => e.body), ["original", "second"]);
  assert.equal(db.edits[0].writtenAt.getTime(), T0.getTime());
  assert.equal(db.edits[1].writtenAt.getTime(), at(10).getTime());
  assert.equal(db.rows[0].body, "third");
  assert.equal(db.rows[0].editedAt?.getTime(), at(20).getTime());
  ok("every edit saves the text it replaced, with when that text was written");

  db = fakeDb([row({ createdAt: T0 })]);
  await run(db, { id: 1, authorId: "me", body: "first text", now: at(1) }); // same text
  await run(db, { id: 1, authorId: "me", body: "   ", now: at(1) }); // refused
  assert.equal(db.edits.length, 0);
  ok("a click that changes nothing, or is refused, saves no history");

  // 13. two edits at the same moment: the second one finds the text changed and is refused
  db = fakeDb([row({ createdAt: T0 })], [], { beforeUpdate: () => { rowsRef.body = "changed by the other edit"; } });
  const rowsRef = db.rows[0];
  r = await run(db, { id: 1, authorId: "me", body: "mine", now: at(1) });
  assert.deepEqual(r, { ok: false, reason: "notfound" });
  assert.equal(db.edits.length, 0);
  ok("an edit made at the same moment as another cannot slip past the count");

  // 14. the pure rules
  const cfg = { windowMinutes: 60, maxEdits: 5 };
  assert.deepEqual(checkEditAllowed({ createdAtMs: 0, nowMs: 60 * MIN, editsMade: 4 }, cfg), { ok: true });
  assert.deepEqual(checkEditAllowed({ createdAtMs: 0, nowMs: 60 * MIN + 1, editsMade: 0 }, cfg), { ok: false, reason: "window" });
  assert.deepEqual(checkEditAllowed({ createdAtMs: 0, nowMs: 1, editsMade: 5 }, cfg), { ok: false, reason: "limit" });
  assert.deepEqual(checkEditAllowed({ createdAtMs: 100, nowMs: 50, editsMade: 0 }, cfg), { ok: true }); // a clock a little behind
  assert.equal(editsLeft(0, cfg), 5);
  assert.equal(editsLeft(3, cfg), 2);
  assert.equal(editsLeft(9, cfg), 0);
  assert.equal(editWindowEndsAtMs(1000, cfg), 1000 + 60 * MIN);
  assert.ok(socialEdit.windowMinutes > 0 && socialEdit.maxEdits >= 1);
  ok(`rules: window ${socialEdit.windowMinutes} min, ${socialEdit.maxEdits} edits (boundaries, edits left, end of window)`);

  console.log("\nAll social edit tests passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
