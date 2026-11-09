// Test: saved photos (patch-photo-save). Run:  npm run test:photo-bookmark
// Needs no database: the rules are run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applyPhotoBookmark, erasePhotoBookmarks } from "../src/lib/photo-bookmark";
import { isPhotoSavedAfterCursor, parsePhotoSavedCursor, photoSavedAfterWhere, photoSavedCursorToText } from "../src/lib/photo-bookmark-rules";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = Record<string, unknown>;
const user = (id: string, over: Row = {}): Row => ({ id, username: id, status: "ACTIVE", deletedAt: null, ...over });
const photo = (id: number, ownerId: string, over: Row = {}): Row => ({ id, ownerId, status: "VISIBLE", deletedAt: null, ...over });

function fakeDb(users: Row[], photos: Row[], blocks: Row[] = []) {
  const marks: Row[] = [];
  const same = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
  const client = {
    user: { findUnique: async ({ where }: { where: Row }) => users.find((u) => same(u, where)) ?? null },
    photo: { findUnique: async ({ where }: { where: Row }) => photos.find((p) => same(p, where)) ?? null },
    socialBlock: {
      findFirst: async ({ where }: { where: { OR: Row[] } }) => blocks.find((b) => where.OR.some((part) => same(b, part))) ?? null,
    },
    photoBookmark: {
      findUnique: async ({ where }: { where: { userId_photoId: Row } }) => marks.find((b) => same(b, where.userId_photoId)) ?? null,
      create: async ({ data }: { data: Row }) => {
        if (marks.some((b) => b.userId === data.userId && b.photoId === data.photoId)) throw new Error("unique");
        marks.push({ ...data });
        return data;
      },
      delete: async ({ where }: { where: { userId_photoId: Row } }) => {
        const i = marks.findIndex((b) => same(b, where.userId_photoId));
        if (i < 0) throw new Error("not found");
        return marks.splice(i, 1)[0];
      },
      count: async ({ where }: { where: Row }) => marks.filter((b) => same(b, where)).length,
      deleteMany: async ({ where }: { where: { OR: Array<Row & { photo?: { ownerId: string } }> } }) => {
        let count = 0;
        for (let i = marks.length - 1; i >= 0; i--) {
          const row = marks[i];
          const hit = where.OR.some((part) =>
            part.photo ? photos.find((p) => p.id === row.photoId)?.ownerId === part.photo.ownerId : row.userId === part.userId,
          );
          if (hit) { marks.splice(i, 1); count++; }
        }
        return { count };
      },
    },
  };
  return { db: client as unknown as Parameters<typeof applyPhotoBookmark>[0], marks };
}

const MAX = 3;
const save = (db: Parameters<typeof applyPhotoBookmark>[0], userId: string, photoId: unknown, bookmark: unknown = true, max = MAX) =>
  applyPhotoBookmark(db, { userId, photoId, bookmark }, max);

async function main() {
  const users = [user("ann"), user("bob"), user("cat", { status: "DELETION_PENDING" }), user("dan", { deletedAt: new Date() })];
  const photos = [photo(1, "bob"), photo(2, "bob", { status: "HIDDEN" }), photo(3, "bob", { deletedAt: new Date() }), photo(4, "cat"), photo(5, "dan"), photo(6, "ann"), photo(7, "bob")];

  // save, twice, remove
  {
    const { db, marks } = fakeDb(users, photos);
    assert.deepEqual(await save(db, "ann", 1), { ok: true, bookmarked: true, changed: true });
    assert.deepEqual(await save(db, "ann", 1), { ok: true, bookmarked: true, changed: false });
    assert.equal(marks.length, 1);
    assert.deepEqual(await save(db, "ann", 1, false), { ok: true, bookmarked: false, changed: true });
    assert.deepEqual(await save(db, "ann", 1, false), { ok: true, bookmarked: false, changed: false });
    assert.equal(marks.length, 0);
    ok("save, save again (no second row), remove, remove again");
  }
  // own photo
  {
    const { db } = fakeDb(users, photos);
    assert.equal((await save(db, "ann", 6)).ok, true);
    ok("a person can save their own photo");
  }
  // photos that may not be shown
  {
    const { db, marks } = fakeDb(users, photos);
    for (const id of [2, 3, 4, 5, 999]) assert.deepEqual(await save(db, "ann", id), { ok: false, reason: "notfound" });
    assert.equal(marks.length, 0);
    ok("hidden, deleted, owner who asked to delete, erased owner and missing photo cannot be saved");
  }
  // block, both ways; removing still works
  {
    const a = fakeDb(users, photos, [{ blockerId: "bob", blockedId: "ann" }]);
    assert.deepEqual(await save(a.db, "ann", 1), { ok: false, reason: "notfound" });
    const b = fakeDb(users, photos, [{ blockerId: "ann", blockedId: "bob" }]);
    assert.deepEqual(await save(b.db, "ann", 1), { ok: false, reason: "notfound" });
    const c = fakeDb(users, photos);
    await save(c.db, "ann", 1);
    c.marks.length = 1;
    const blocked = fakeDb(users, photos, [{ blockerId: "bob", blockedId: "ann" }]);
    blocked.marks.push({ userId: "ann", photoId: 1 });
    assert.deepEqual(await save(blocked.db, "ann", 1, false), { ok: true, bookmarked: false, changed: true });
    ok("a block in either direction refuses saving; removing always works");
  }
  // removing a save of a photo that is hidden now
  {
    const { db, marks } = fakeDb(users, photos);
    marks.push({ userId: "ann", photoId: 2 });
    assert.deepEqual(await save(db, "ann", 2, false), { ok: true, bookmarked: false, changed: true });
    ok("a save of a photo that is hidden now can still be removed");
  }
  // limit
  {
    const { db } = fakeDb(users, photos);
    for (const id of [1, 6, 7]) assert.equal((await save(db, "ann", id)).ok, true);
    assert.deepEqual(await save(db, "bob", 1), { ok: true, bookmarked: true, changed: true }); // other people have their own count
    const { db: db2 } = fakeDb(users, [...photos, photo(8, "bob")]);
    for (const id of [1, 6, 7]) await save(db2, "ann", id);
    assert.deepEqual(await save(db2, "ann", 8), { ok: false, reason: "full" });
    assert.deepEqual(await save(db2, "ann", 1), { ok: true, bookmarked: true, changed: false }); // already saved: not "full"
    assert.deepEqual(await save(db2, "ann", 1, false), { ok: true, bookmarked: false, changed: true });
    assert.equal((await save(db2, "ann", 8)).ok, true);
    ok("the limit refuses a new save when full; removing always works");
  }
  // bad input
  {
    const { db } = fakeDb(users, photos);
    for (const bad of [0, -1, 1.5, "1", null, undefined, NaN, 2 ** 40]) assert.deepEqual(await save(db, "ann", bad), { ok: false, reason: "error" });
    assert.deepEqual(await save(db, "ann", 1, "yes"), { ok: false, reason: "error" });
    assert.deepEqual(await save(db, "", 1), { ok: false, reason: "error" });
    ok("bad photo numbers, bad flag and empty user are refused");
  }
  // erasure
  {
    const { db, marks } = fakeDb(users, photos);
    marks.push({ userId: "ann", photoId: 1 }, { userId: "ann", photoId: 6 }, { userId: "bob", photoId: 6 }, { userId: "bob", photoId: 1 });
    assert.equal(await erasePhotoBookmarks(db, "ann"), 3); // ann's own two + bob's save of ann's photo 6
    assert.deepEqual(marks, [{ userId: "bob", photoId: 1 }]);
    assert.equal(await erasePhotoBookmarks(db, "ann"), 0);
    ok("final erasure removes saves made by the person and saves of the person's photos; twice is safe");
  }
  // cursor and paging rule
  {
    assert.equal(photoSavedCursorToText({ ms: 1700000000000, id: 42 }), "1700000000000.42");
    assert.deepEqual(parsePhotoSavedCursor("1700000000000.42"), { ms: 1700000000000, id: 42 });
    for (const bad of [undefined, "", "12", "1.0", "a.b", "-1.5", "1.2.3", ["1.2"], "1700000000000.0"]) assert.equal(parsePhotoSavedCursor(bad), null);
    const c = { ms: 1000, id: 5 };
    assert.equal(isPhotoSavedAfterCursor(c, { savedAtMs: 999, id: 9 }), true);
    assert.equal(isPhotoSavedAfterCursor(c, { savedAtMs: 1000, id: 4 }), true);
    assert.equal(isPhotoSavedAfterCursor(c, { savedAtMs: 1000, id: 5 }), false);
    assert.equal(isPhotoSavedAfterCursor(c, { savedAtMs: 1001, id: 1 }), false);
    assert.deepEqual(photoSavedAfterWhere(null), {});
    const w = photoSavedAfterWhere(c);
    assert.deepEqual(w.OR?.[1], { createdAt: new Date(1000), photoId: { lt: 5 } });
    ok("paging cursor: text, parsing, order and database filter agree");
  }
  // texts
  {
    const keys = [
      "photo.bookmark.save", "photo.bookmark.saved", "photo.bookmark.save.title", "photo.bookmark.saved.title", "photo.bookmark.login",
      "photo.bookmark.toomany", "photo.bookmark.full", "photo.bookmark.error",
      "photo.saved.title", "photo.saved.sub", "photo.saved.empty", "photo.saved.browse", "photo.saved.all", "photo.saved.newest",
      "photo.saved.loginRequired", "photo.saved.link",
    ];
    const langs: Record<string, Record<string, string>> = { en, es, fr, zh, hi, ar } as never;
    for (const [lang, msgs] of Object.entries(langs)) {
      for (const k of keys) assert.ok(typeof msgs[k] === "string" && msgs[k].trim() !== "", `${lang} is missing "${k}"`);
    }
    ok("all 16 texts exist in the 6 languages");
  }
  console.log("\nAll photo-bookmark checks passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
