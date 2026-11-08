// Test: Bookmarks (SOCIAL_TODO B2, patch-social-bookmark). Run:  npm run test:social-bookmark
// Needs no database: the rules are run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialBookmark, eraseSocialBookmarks } from "../src/lib/social-bookmark";
import {
  bookmarkAfterWhere,
  bookmarkCursorToText,
  cleanBookmarkPostId,
  cutBookmarkPage,
  isBookmarkAfterCursor,
  parseBookmarkCursor,
} from "../src/lib/social-bookmark-rules";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = Record<string, unknown>;
const user = (id: string, over: Row = {}): Row => ({ id, username: id, status: "ACTIVE", deletedAt: null, ...over });
const post = (id: number, authorId: string, over: Row = {}): Row => ({ id, authorId, status: "VISIBLE", deletedAt: null, ...over });

function fakeDb(users: Row[], posts: Row[], blocks: Row[] = []) {
  const bookmarks: Row[] = [];
  const same = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value);
  const client = {
    user: { findUnique: async ({ where }: { where: Row }) => users.find((u) => same(u, where)) ?? null },
    socialPost: { findUnique: async ({ where }: { where: Row }) => posts.find((p) => same(p, where)) ?? null },
    socialBlock: {
      findFirst: async ({ where }: { where: { OR: Row[] } }) => blocks.find((b) => where.OR.some((part) => same(b, part))) ?? null,
    },
    socialPostBookmark: {
      findUnique: async ({ where }: { where: { userId_socialPostId: Row } }) =>
        bookmarks.find((b) => same(b, where.userId_socialPostId)) ?? null,
      create: async ({ data }: { data: Row }) => {
        if (bookmarks.some((b) => b.userId === data.userId && b.socialPostId === data.socialPostId)) throw new Error("unique");
        bookmarks.push({ ...data });
        return data;
      },
      delete: async ({ where }: { where: { userId_socialPostId: Row } }) => {
        const i = bookmarks.findIndex((b) => same(b, where.userId_socialPostId));
        if (i < 0) throw new Error("not found");
        return bookmarks.splice(i, 1)[0];
      },
      count: async ({ where }: { where: Row }) => bookmarks.filter((b) => same(b, where)).length,
      deleteMany: async ({ where }: { where: { OR: Array<Row & { socialPost?: { authorId: string } }> } }) => {
        let count = 0;
        for (let i = bookmarks.length - 1; i >= 0; i--) {
          const row = bookmarks[i];
          const hit = where.OR.some((part) =>
            part.socialPost
              ? posts.find((p) => p.id === row.socialPostId)?.authorId === part.socialPost.authorId
              : row.userId === part.userId,
          );
          if (hit) { bookmarks.splice(i, 1); count++; }
        }
        return { count };
      },
    },
  };
  // The code under test only needs these calls; the cast keeps the stand-in small.
  return { db: client as unknown as Parameters<typeof applySocialBookmark>[0], bookmarks };
}

const MAX = 5;
const save = (db: Parameters<typeof applySocialBookmark>[0], userId: string, postId: unknown, bookmark: unknown = true, max = MAX) =>
  applySocialBookmark(db, { userId, postId, bookmark }, max);

async function main() {
  // 1. Input cleaning
  assert.equal(cleanBookmarkPostId(7), 7);
  for (const bad of [0, -1, 1.5, NaN, "3", null, undefined, Number.MAX_SAFE_INTEGER + 2]) assert.equal(cleanBookmarkPostId(bad), null);
  ok("post number: only whole numbers of 1 or more");

  // 2. Paging cursor
  assert.deepEqual(parseBookmarkCursor("1762560000000.42"), { ms: 1762560000000, id: 42 });
  assert.equal(bookmarkCursorToText({ ms: 1762560000000, id: 42 }), "1762560000000.42");
  for (const bad of [undefined, null, "", "abc", "1.2.3", "1762560000000", "1762560000000.0", "-1.5", "1e9.5", " 1.5", "1.5 ", ["1.5"]]) {
    assert.equal(parseBookmarkCursor(bad), null, String(bad));
  }
  ok("cursor: round trip, everything else is ignored");

  const cursor = { ms: 1000, id: 10 };
  assert.equal(isBookmarkAfterCursor(cursor, { savedAtMs: 999, id: 50 }), true);
  assert.equal(isBookmarkAfterCursor(cursor, { savedAtMs: 1001, id: 1 }), false);
  assert.equal(isBookmarkAfterCursor(cursor, { savedAtMs: 1000, id: 9 }), true);
  assert.equal(isBookmarkAfterCursor(cursor, { savedAtMs: 1000, id: 10 }), false);
  assert.equal(isBookmarkAfterCursor(cursor, { savedAtMs: 1000, id: 11 }), false);
  assert.deepEqual(bookmarkAfterWhere(null), {});
  assert.deepEqual(bookmarkAfterWhere(cursor), {
    OR: [{ createdAt: { lt: new Date(1000) } }, { createdAt: new Date(1000), socialPostId: { lt: 10 } }],
  });
  ok("cursor: strictly after the last bookmark shown, also at the same moment");

  // Paging walks a list with equal times: nothing skipped, nothing twice.
  const all = [
    { savedAtMs: 500, id: 3 }, { savedAtMs: 500, id: 2 }, { savedAtMs: 500, id: 1 },
    { savedAtMs: 400, id: 9 }, { savedAtMs: 300, id: 8 }, { savedAtMs: 300, id: 4 }, { savedAtMs: 100, id: 5 },
  ];
  const seen: number[] = [];
  let at: ReturnType<typeof parseBookmarkCursor> = null;
  for (let guard = 0; guard < 10; guard++) {
    const rest = all.filter((item) => !at || isBookmarkAfterCursor(at, item)).slice(0, 3 + 1);
    const { items, next } = cutBookmarkPage(rest, 3);
    seen.push(...items.map((item) => item.id));
    if (!next) break;
    at = next;
  }
  assert.deepEqual(seen, [3, 2, 1, 9, 8, 4, 5]);
  assert.deepEqual(cutBookmarkPage([], 3), { items: [], next: null });
  assert.deepEqual(cutBookmarkPage(all.slice(0, 3), 3).next, null);
  ok("paging: every bookmark once, in order, equal times included");

  // 3. Save and remove
  {
    const { db, bookmarks } = fakeDb([user("a"), user("b")], [post(1, "b")]);
    assert.deepEqual(await save(db, "a", 1), { ok: true, bookmarked: true, changed: true });
    assert.equal(bookmarks.length, 1);
    assert.deepEqual(await save(db, "a", 1), { ok: true, bookmarked: true, changed: false });
    assert.equal(bookmarks.length, 1);
    assert.deepEqual(await save(db, "a", 1, false), { ok: true, bookmarked: false, changed: true });
    assert.equal(bookmarks.length, 0);
    assert.deepEqual(await save(db, "a", 1, false), { ok: true, bookmarked: false, changed: false });
    ok("save and remove: twice changes nothing, no error");
  }

  // 4. Who and what may be saved
  {
    const { db, bookmarks } = fakeDb(
      [user("a"), user("b"), user("pending", { status: "DELETION_PENDING" }), user("gone", { status: "DELETED", deletedAt: new Date() }), user("susp", { status: "SUSPENDED" })],
      [
        post(1, "b"), post(2, "a"), post(3, "b", { status: "HIDDEN_PENDING_REVIEW" }), post(4, "b", { status: "REMOVED" }),
        post(5, "b", { deletedAt: new Date() }), post(6, "pending"), post(7, "gone"), post(8, "susp"), post(9, "nobody"),
      ],
    );
    assert.equal((await save(db, "a", 2)).ok, true); // own post
    assert.equal((await save(db, "a", 8)).ok, true); // suspended author: posts are still shown (3.8)
    for (const id of [3, 4, 5, 6, 7, 9, 99]) {
      assert.deepEqual(await save(db, "a", id), { ok: false, reason: "notfound" }, "post " + id);
    }
    assert.equal(bookmarks.length, 2);
    for (const bad of ["1", 0, 1.5, null]) assert.deepEqual(await save(db, "a", bad), { ok: false, reason: "error" });
    assert.deepEqual(await save(db, "a", 1, "yes"), { ok: false, reason: "error" });
    assert.deepEqual(await save(db, "", 1), { ok: false, reason: "error" });
    ok("save: only a visible post of an account that may be shown; bad input is an error");
  }

  // 5. Block: refused in both directions, remove always works; mute changes nothing here
  {
    const { db, bookmarks } = fakeDb(
      [user("a"), user("b"), user("c")],
      [post(1, "b"), post(2, "a"), post(3, "c")],
      [{ blockerId: "a", blockedId: "b" }, { blockerId: "c", blockedId: "a" }],
    );
    assert.deepEqual(await save(db, "a", 1), { ok: false, reason: "notfound" }); // a blocked b
    assert.deepEqual(await save(db, "a", 3), { ok: false, reason: "notfound" }); // c blocked a
    assert.deepEqual(await save(db, "b", 2), { ok: false, reason: "notfound" }); // b is blocked by a
    // A bookmark made before the block can still be removed.
    bookmarks.push({ userId: "a", socialPostId: 1 });
    assert.deepEqual(await save(db, "a", 1, false), { ok: true, bookmarked: false, changed: true });
    assert.equal(bookmarks.length, 0);
    ok("block: saving is refused both ways with the same \"not found\"; removing always works");
  }

  // 6. A bookmark of a post that is no longer shown can still be removed
  {
    const { db, bookmarks } = fakeDb([user("a"), user("b")], [post(1, "b", { status: "REMOVED" })]);
    bookmarks.push({ userId: "a", socialPostId: 1 });
    assert.deepEqual(await save(db, "a", 1, false), { ok: true, bookmarked: false, changed: true });
    ok("remove: allowed for a hidden or removed post");
  }

  // 7. The list is limited; removing and re-saving an existing one still work when full
  {
    const { db, bookmarks } = fakeDb([user("a"), user("b")], [post(1, "b"), post(2, "b"), post(3, "b")]);
    assert.equal((await save(db, "a", 1, true, 2)).ok, true);
    assert.equal((await save(db, "a", 2, true, 2)).ok, true);
    assert.deepEqual(await save(db, "a", 3, true, 2), { ok: false, reason: "full" });
    assert.deepEqual(await save(db, "a", 2, true, 2), { ok: true, bookmarked: true, changed: false }); // already saved
    assert.deepEqual(await save(db, "a", 1, false, 2), { ok: true, bookmarked: false, changed: true });
    assert.equal((await save(db, "a", 3, true, 2)).ok, true);
    assert.equal(bookmarks.length, 2);
    // Another person's list is separate.
    assert.equal((await save(db, "b", 1, true, 2)).ok, true);
    ok("limit: full list refuses a new bookmark, removing works, lists are per person");
  }

  // 8. Final erasure
  {
    const { db, bookmarks } = fakeDb([user("a"), user("b"), user("c")], [post(1, "a"), post(2, "b"), post(3, "c")]);
    await save(db, "a", 2); await save(db, "a", 3); // a saved two posts
    await save(db, "b", 1); await save(db, "c", 1); await save(db, "c", 2); // b and c saved a's post / b's post
    assert.equal(bookmarks.length, 5);
    assert.equal(await eraseSocialBookmarks(db, "a"), 4); // a's own 2 + the 2 on a's post
    assert.deepEqual(bookmarks, [{ userId: "c", socialPostId: 2 }]);
    assert.equal(await eraseSocialBookmarks(db, "a"), 0); // safe to run twice
    ok("erasure: bookmarks made and bookmarks of the person's posts go, others stay");
  }

  // 9. Config and texts
  assert.ok(socialLimits.maxBookmarks >= 100 && Number.isInteger(socialLimits.maxBookmarks));
  assert.ok(socialLimits.bookmarks.length >= 1 && socialLimits.bookmarks.every((rule) => rule.max > 0 && rule.windowSeconds > 0));
  const keys = [
    "social.bookmark.save", "social.bookmark.saved", "social.bookmark.save.title", "social.bookmark.saved.title",
    "social.bookmark.login", "social.bookmark.toomany", "social.bookmark.full", "social.bookmark.error",
    "social.tabs.bookmarks", "social.bookmarks.title", "social.bookmarks.sub", "social.bookmarks.empty",
  ];
  for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
    for (const key of keys) {
      const value = (messages as Record<string, string>)[key];
      assert.ok(typeof value === "string" && value.length > 0, `${name} is missing ${key}`);
    }
  }
  ok("limits and the 12 texts exist in all six languages");

  console.log("\nAll bookmark checks passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
