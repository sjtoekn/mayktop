// Tests for the paged / searchable /admin/ads screen (patch-ads-list). Run:  npm run test:ad-list   (no database)
import assert from "node:assert/strict";
import { ADS_PAGE_SIZE, ADS_VIEW_STATUSES, ADS_VIEWS, adNumberFromSearch, adsLink, pageInfo, parseAdsQuery } from "../src/lib/admin-ads-list-rules";

function ok(name: string) { console.log("OK  " + name); }

// parsing: unknown / hostile values are ignored
assert.deepEqual(parseAdsQuery({}), { view: "queue", q: "", slot: "", format: "", page: 1 });
assert.equal(parseAdsQuery({ view: "history" }).view, "history");
assert.equal(parseAdsQuery({ view: "drop table" }).view, "queue");
assert.equal(parseAdsQuery({ slot: "FEED" }).slot, "FEED");
assert.equal(parseAdsQuery({ slot: "NOPE" }).slot, "");
assert.equal(parseAdsQuery({ format: "VIDEO" }).format, "VIDEO");
assert.equal(parseAdsQuery({ format: "video" }).format, "");
assert.equal(parseAdsQuery({ page: "3" }).page, 3);
for (const bad of ["0", "-2", "abc", "1.5", "999999999", ""]) assert.equal(parseAdsQuery({ page: bad }).page, 1, bad);
assert.equal(parseAdsQuery({ q: "  anna  " }).q, "anna");
assert.equal(parseAdsQuery({ q: "x".repeat(500) }).q.length, 100);
assert.equal(parseAdsQuery({ view: ["history", "queue"] }).view, "history"); // repeated parameter: the first one
ok("address is parsed safely");

// every status has exactly one tab, and nothing is in two tabs
const seen = new Map<string, string>();
for (const view of ADS_VIEWS) for (const s of ADS_VIEW_STATUSES[view]) {
  assert.equal(seen.has(s), false, s + " is in two tabs");
  seen.set(s, view);
}
assert.deepEqual([...seen.keys()].sort(), ["ACTIVE", "APPROVED", "ENDED", "PAUSED", "REJECTED", "SUBMITTED"]);
assert.equal(seen.has("DRAFT"), false); // a draft is not for the admin to see
ok("each status is in one tab; DRAFT is in none");

// search by ad number
assert.equal(adNumberFromSearch("12"), 12);
assert.equal(adNumberFromSearch("#12"), 12);
assert.equal(adNumberFromSearch(" # 7 "), 7);
assert.equal(adNumberFromSearch("anna"), null);
assert.equal(adNumberFromSearch("12 anna"), null);
assert.equal(adNumberFromSearch("1234567890"), null); // too long for a number: search as words
assert.equal(adNumberFromSearch(""), null);
ok("ad number search");

// paging
assert.deepEqual(pageInfo(0, 1), { pages: 1, page: 1, skip: 0, from: 0, to: 0 });
assert.deepEqual(pageInfo(5, 1), { pages: 1, page: 1, skip: 0, from: 1, to: 5 });
assert.deepEqual(pageInfo(ADS_PAGE_SIZE, 1), { pages: 1, page: 1, skip: 0, from: 1, to: ADS_PAGE_SIZE });
assert.deepEqual(pageInfo(ADS_PAGE_SIZE + 1, 2), { pages: 2, page: 2, skip: ADS_PAGE_SIZE, from: ADS_PAGE_SIZE + 1, to: ADS_PAGE_SIZE + 1 });
assert.equal(pageInfo(45, 99).page, 3); // past the end -> last page
assert.equal(pageInfo(45, 0).page, 1);
assert.equal(pageInfo(45, 3).to, 45);
ok("paging maths");

// links keep the search and filters; defaults are left out
const base = parseAdsQuery({});
assert.equal(adsLink(base), "/admin/ads");
assert.equal(adsLink(base, { view: "history" }), "/admin/ads?view=history");
const q = parseAdsQuery({ view: "active", q: "anna smith", slot: "FEED", format: "IMAGE", page: "2" });
assert.equal(adsLink(q), "/admin/ads?view=active&q=anna+smith&slot=FEED&format=IMAGE&page=2");
assert.equal(adsLink(q, { view: "paused", page: 1 }), "/admin/ads?view=paused&q=anna+smith&slot=FEED&format=IMAGE");
assert.equal(adsLink(q, { page: 3 }).endsWith("page=3"), true);
ok("tab and page links keep the search");

console.log("All /admin/ads list tests passed.");
