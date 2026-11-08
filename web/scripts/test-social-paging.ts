// Test: paging of the Social feeds (SOCIAL_TODO 4). Run:  npm run test:social-paging
// Needs no database: the paging rules are plain functions (src/lib/social-paging.ts).
import assert from "node:assert/strict";
import { afterCursorWhere, comparePageItems, cursorToText, cutPage, isAfterCursor, parseCursor, type PageItem } from "../src/lib/social-paging";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

// ---- the cursor text
assert.deepEqual(parseCursor("1700000000000.0.12"), { ms: 1700000000000, rank: 0, id: 12 });
assert.deepEqual(parseCursor("1700000000000.1.3"), { ms: 1700000000000, rank: 1, id: 3 });
for (const bad of [undefined, null, 5, "", "abc", "1.2.3", "1.0", "1.0.2.3", "-1.0.2", "1.0.-2", " 1.0.2", "1.0.2 ", "1e5.0.2", "9999999999999999999.0.1", ["1.0.2"]]) {
  assert.equal(parseCursor(bad), null, String(bad));
}
assert.equal(cursorToText({ ms: 5, rank: 1, id: 9 }), "5.1.9");
assert.deepEqual(parseCursor(cursorToText({ ms: 123456789, rank: 1, id: 77 })), { ms: 123456789, rank: 1, id: 77 });
ok("cursor: only digits and dots are accepted, anything else means the first page");

// ---- paging walks through every item exactly once, also when many have the same time
function makeItems(): PageItem[] {
  const items: PageItem[] = [];
  let post = 1;
  let repost = 1;
  for (let i = 0; i < 60; i++) {
    const createdAtMs = 1_700_000_000_000 - Math.floor(i / 4) * 1000; // four items share every moment
    if (i % 3 === 0) items.push({ createdAtMs, rank: 1, id: repost++ });
    else items.push({ createdAtMs, rank: 0, id: post++ });
  }
  return items;
}
{
  const all = makeItems().sort(comparePageItems);
  for (const size of [1, 3, 7, 10, 59, 60, 100]) {
    const seen: PageItem[] = [];
    let cursor = null as ReturnType<typeof parseCursor>;
    for (let guard = 0; guard < 200; guard++) {
      // what the database does: each table is read after the cursor, `size + 1` rows each, then merged
      const rows = all.filter((item) => (cursor ? isAfterCursor(cursor, item) : true)).sort(comparePageItems);
      const { items, next } = cutPage(rows, size);
      seen.push(...items);
      if (!next) break;
      cursor = parseCursor(cursorToText(next)); // through the URL text, as the page does
      assert.ok(cursor);
    }
    assert.deepEqual(seen, all, `size ${size}`);
  }
}
ok("paging: every item once, none skipped or repeated (also with the same time and with reposts), for several page sizes");

// ---- the order of one moment: post first, then repost, then the higher id first
{
  const sorted = [
    { createdAtMs: 10, rank: 1 as const, id: 5 },
    { createdAtMs: 10, rank: 0 as const, id: 2 },
    { createdAtMs: 10, rank: 0 as const, id: 9 },
    { createdAtMs: 11, rank: 1 as const, id: 1 },
  ].sort(comparePageItems);
  assert.deepEqual(sorted.map((i) => `${i.createdAtMs}.${i.rank}.${i.id}`), ["11.1.1", "10.0.9", "10.0.2", "10.1.5"]);
}
ok("order: newest first, a post before a repost at the same moment, then the higher id first");

// ---- the last page has no next cursor; an exactly full last page is not followed by an empty page
assert.equal(cutPage(makeItems().sort(comparePageItems).slice(0, 10), 10).next, null);
assert.equal(cutPage([], 10).next, null);
assert.equal(cutPage(makeItems().sort(comparePageItems).slice(0, 11), 10).items.length, 10);
ok("last page: no next cursor, and no empty page after a full last page");

// ---- the database condition says the same as isAfterCursor
{
  const cursor = { ms: 5000, rank: 0 as const, id: 8 };
  assert.deepEqual(afterCursorWhere(null, 0), {});
  assert.deepEqual(afterCursorWhere(cursor, 0), { OR: [{ createdAt: { lt: new Date(5000) } }, { createdAt: new Date(5000), id: { lt: 8 } }] });
  assert.deepEqual(afterCursorWhere(cursor, 1), { OR: [{ createdAt: { lt: new Date(5000) } }, { createdAt: new Date(5000) }] });
  const repostCursor = { ms: 5000, rank: 1 as const, id: 8 };
  assert.deepEqual(afterCursorWhere(repostCursor, 0), { OR: [{ createdAt: { lt: new Date(5000) } }] });
  assert.deepEqual(afterCursorWhere(repostCursor, 1), { OR: [{ createdAt: { lt: new Date(5000) } }, { createdAt: new Date(5000), id: { lt: 8 } }] });
}
ok("database condition: older, or the same moment and later in the order");

// ---- texts
const keys = ["social.feed.older", "social.feed.newest", "social.feed.end", "social.feed.pageLabel"];
for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
  for (const key of keys) assert.ok((messages as Record<string, string>)[key], `${name}: ${key}`);
}
ok("the new texts exist in all six languages");

console.log(`\n${count} groups of checks passed.`);
