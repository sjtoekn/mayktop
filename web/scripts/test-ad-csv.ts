// Tests for the CSV download of ad numbers (patch-ads-csv). Run:  npm run test:ad-csv   (no database)
import assert from "node:assert/strict";
import { buildAdCsv, buildOverviewCsv, csvCell, csvFileName } from "../src/lib/ad-csv";

function ok(name: string) { console.log("OK  " + name); }

assert.equal(csvCell("hello"), "hello");
assert.equal(csvCell(5), "5");
assert.equal(csvCell('say "hi"'), '"say ""hi"""');
assert.equal(csvCell("a,b"), '"a,b"');
assert.equal(csvCell("line1\nline2"), '"line1 line2"');
ok("quotes, commas and new lines");

for (const bad of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx"]) assert.ok(csvCell(bad).includes("'" + bad.slice(0, 1)), bad);
assert.equal(csvCell("=HYPERLINK(\"x\")").startsWith('"\'='), true);
assert.equal(csvCell("a=b"), "a=b");
ok("a text that starts like a formula is neutralised");

const csv = buildAdCsv([
  { date: new Date("2026-11-07T00:00:00Z"), impressions: 10, clicks: 1 },
  { date: new Date("2026-11-08T00:00:00Z"), impressions: 0, clicks: 0 },
]);
assert.equal(csv, "\uFEFFdate_utc,shown,clicks,click_rate\r\n2026-11-07,10,1,10.0%\r\n2026-11-08,0,0,\r\n");
ok("one row per day with the click rate");

const all = buildOverviewCsv([{ id: 3, title: "=evil()", advertiser: "bob", status: "ACTIVE", slot: "FEED", format: "TEXT", impressions: 5, clicks: 0, ctr: "0.0%", week: 5 }]);
assert.ok(all.includes("3,\"'=evil()\",bob,ACTIVE,FEED,TEXT,5,0,0.0%,5"));
ok("all ads: one row per ad, titles are protected");

assert.equal(csvFileName("Ad 12/../x"), "ad-12----x.csv");
ok("file name is safe");
console.log("All ad csv tests passed.");
