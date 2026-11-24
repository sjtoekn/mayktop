// Tests for counting ad impressions on a page (TODO 12, S3). Run:  npm run test:creator-collect
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import { allowContentCount, parseImpressionBody, postIdFromPath, viewerIsOwner } from "../src/lib/creator-collect-rules";

function ok(name: string) { console.log("OK  " + name); }

// 1. Only a question page gives a page id.
assert.equal(postIdFromPath("/post/123"), 123);
assert.equal(postIdFromPath("/post/123/"), 123);
for (const bad of ["/", "/post", "/post/", "/post/abc", "/post/0", "/post/-4", "/post/12/edit", "/c/design", "/u/sam", "/post/1234567890", "/social/post/5", "/post/12?x=1"]) {
  assert.equal(postIdFromPath(bad), null, bad);
}
ok("only /post/<number> is a question page");

// 2. The request body: the old shape still works; a bad ad id is refused; a bad post is ignored (the ad is still counted).
assert.deepEqual(parseImpressionBody({ id: 12 }), { id: 12, post: null });
assert.deepEqual(parseImpressionBody({ id: 12, post: 345 }), { id: 12, post: 345 });
assert.deepEqual(parseImpressionBody({ id: 12, post: "345" }), { id: 12, post: null });
assert.deepEqual(parseImpressionBody({ id: 12, post: -1 }), { id: 12, post: null });
assert.deepEqual(parseImpressionBody({ id: 12, post: 1.5 }), { id: 12, post: null });
for (const bad of [null, undefined, 5, "x", [], {}, { id: "12" }, { id: 0 }, { id: -3 }, { id: 1.2 }, { post: 5 }]) {
  assert.equal(parseImpressionBody(bad), null, JSON.stringify(bad));
}
ok("request body: old shape works, bad ad id refused, bad post ignored");

// 3. Own views are not counted.
assert.equal(viewerIsOwner(null, ["a", "b"]), false);
assert.equal(viewerIsOwner("a", ["a", "b"]), true);
assert.equal(viewerIsOwner("b", ["a", undefined, "b"]), true);
assert.equal(viewerIsOwner("c", ["a", null, undefined]), false);
ok("an author's own view of their page is recognised; visitors who are not logged in are never owners");

// 4. Per-page per-minute limit, then a fresh window.
{
  const t = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(allowContentCount(900001, t + i, 5), true);
  assert.equal(allowContentCount(900001, t + 10, 5), false);
  assert.equal(allowContentCount(900002, t + 10, 5), true); // another page has its own count
  assert.equal(allowContentCount(900001, t + 60_000, 5), true); // a minute later: new window
  ok("per-page per-minute limit, separate per page, resets after a minute");
}

console.log("\nAll creator collect tests passed.");
