// Test: deleting your own Social post (SOCIAL_TODO 13). Run:  npm run test:social-delete
// Needs no database: applySocialDelete() is run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialDelete } from "../src/lib/social-delete";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = { id: number; authorId: string; body: string; mediaUrl: string | null; status: string; deletedAt: Date | null };

function fakeDb(rows: Row[]) {
  const match = (r: Row, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => (r as Record<string, unknown>)[k] === v);
  return {
    rows,
    socialPost: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
}
const row = (over: Partial<Row> = {}): Row => ({
  id: 1, authorId: "me", body: "secret text", mediaUrl: "https://x.invalid/a.png", status: "VISIBLE", deletedAt: null, ...over,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (db: ReturnType<typeof fakeDb>, input: { id: number; authorId: string }) => applySocialDelete(db as any, input);

async function main() {
  let db = fakeDb([row()]);
  let r = await run(db, { id: 1, authorId: "me" });
  assert.deepEqual(r, { ok: true });
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].body, "");
  assert.equal(db.rows[0].mediaUrl, null);
  assert.ok(db.rows[0].deletedAt instanceof Date);
  ok("the author can delete: text and picture link erased, deletedAt set, the row stays");

  r = await run(db, { id: 1, authorId: "me" });
  assert.deepEqual(r, { ok: false, reason: "notfound" });
  ok("deleting twice is refused (nothing changes)");

  db = fakeDb([row({ authorId: "other" })]);
  r = await run(db, { id: 1, authorId: "me" });
  assert.deepEqual(r, { ok: false, reason: "notfound" });
  assert.equal(db.rows[0].body, "secret text");
  ok("nobody can delete another person's post");

  for (const status of ["HIDDEN_PENDING_REVIEW", "REMOVED"]) {
    db = fakeDb([row({ status })]);
    r = await run(db, { id: 1, authorId: "me" });
    assert.deepEqual(r, { ok: false, reason: "notfound" });
    assert.equal(db.rows[0].body, "secret text");
    assert.equal(db.rows[0].deletedAt, null);
  }
  ok("a hidden or removed post cannot be deleted by its author (the evidence stays for the review)");

  for (const id of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(await run(db, { id, authorId: "me" }), { ok: false, reason: "error" });
  }
  ok("bad post numbers are refused");

  const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
  const keys = Object.keys(en).filter((k) => k === "social.delete" || k.startsWith("social.delete."));
  assert.equal(keys.length, 7);
  for (const [lang, m] of Object.entries(languages)) {
    for (const k of keys) {
      assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
      assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
      if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
    }
    assert.ok((m["social.delete.toomany"] as string).includes("{minutes}"), `${lang}: {minutes} lost`);
  }
  ok("all 7 delete texts exist in six languages and {minutes} is kept");

  console.log("\nAll social delete tests passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
