// Tests for the tabs / number range / paging of /advertise/my (patch-ads-my-list). Run:  npm run test:ad-mine-list   (no database)
import assert from "node:assert/strict";
import { MY_PAGE_SIZE, MY_VIEWS, MY_VIEW_STATUSES, countsByView, myLink, myPageInfo, parseMyQuery, rangeStartDay, statusesFor } from "../src/lib/ad-mine-list-rules";

function ok(name: string) { console.log("OK  " + name); }

// parsing: unknown / hostile values are ignored
assert.deepEqual(parseMyQuery({}), { view: "all", range: "7", page: 1 });
assert.equal(parseMyQuery({ view: "ended" }).view, "ended");
assert.equal(parseMyQuery({ view: "drop table" }).view, "all");
assert.equal(parseMyQuery({ range: "30" }).range, "30");
assert.equal(parseMyQuery({ range: "all" }).range, "all");
for (const bad of ["1", "365", "abc", "", "7d"]) assert.equal(parseMyQuery({ range: bad }).range, "7", bad);
assert.equal(parseMyQuery({ page: "4" }).page, 4);
for (const bad of ["0", "-1", "x", "1.5", "999999999"]) assert.equal(parseMyQuery({ page: bad }).page, 1, bad);
assert.equal(parseMyQuery({ view: ["rejected", "ended"] }).view, "rejected");
ok("address is parsed safely");

// every status is in exactly one named tab; "all" has no filter
const seen = new Map<string, string>();
for (const view of MY_VIEWS) {
  if (view === "all") { assert.equal(statusesFor(view), null); continue; }
  for (const s of MY_VIEW_STATUSES[view]) { assert.equal(seen.has(s), false, s + " is in two tabs"); seen.set(s, view); }
}
assert.deepEqual([...seen.keys()].sort(), ["ACTIVE", "APPROVED", "DRAFT", "ENDED", "PAUSED", "REJECTED", "SUBMITTED"]);
ok("each status is in one tab");

// counts
assert.deepEqual(countsByView([]), { all: 0, running: 0, waiting: 0, rejected: 0, ended: 0 });
assert.deepEqual(
  countsByView([{ status: "ACTIVE", count: 2 }, { status: "PAUSED", count: 1 }, { status: "SUBMITTED", count: 3 }, { status: "APPROVED", count: 1 }, { status: "REJECTED", count: 4 }, { status: "ENDED", count: 5 }, { status: "DRAFT", count: 1 }]),
  { all: 17, running: 3, waiting: 5, rejected: 4, ended: 5 },
);
ok("tab counts");

// range start (today = 2026-11-08 UTC midnight)
const today = new Date("2026-11-08T00:00:00Z");
assert.equal(rangeStartDay("7", today)?.toISOString(), "2026-11-02T00:00:00.000Z");
assert.equal(rangeStartDay("30", today)?.toISOString(), "2026-10-10T00:00:00.000Z");
assert.equal(rangeStartDay("90", today)?.toISOString(), "2026-08-11T00:00:00.000Z");
assert.equal(rangeStartDay("all", today), null);
ok("range start days (today included)");

// paging
assert.equal(MY_PAGE_SIZE, 10);
assert.deepEqual(myPageInfo(0, 1), { pages: 1, page: 1, skip: 0, from: 0, to: 0 });
assert.deepEqual(myPageInfo(11, 2), { pages: 2, page: 2, skip: 10, from: 11, to: 11 });
assert.equal(myPageInfo(25, 99).page, 3);
ok("paging maths");

// links keep the range when the tab changes, and the tab when the range changes; defaults are left out
const base = parseMyQuery({});
assert.equal(myLink(base), "/advertise/my");
assert.equal(myLink(base, { view: "running" }), "/advertise/my?view=running");
const q = parseMyQuery({ view: "ended", range: "30", page: "2" });
assert.equal(myLink(q), "/advertise/my?view=ended&range=30&page=2");
assert.equal(myLink(q, { view: "running", page: 1 }), "/advertise/my?view=running&range=30");
assert.equal(myLink(q, { range: "7", page: 1 }), "/advertise/my?view=ended");
ok("links keep tab and range");

console.log("All /advertise/my list tests passed.");
