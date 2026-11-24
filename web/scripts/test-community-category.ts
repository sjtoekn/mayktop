// Test: the topic of a community request (SITE_PLAN A2). Run:  npm run test:community-category
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { communityCategories } from "../src/config/site";
import { checkRequestInput } from "../src/lib/community-request-rules";

function ok(name: string) { console.log("OK  " + name); }

const rules = [1, 2, 3].map((n) => ({ title: `Rule ${n}`, text: `Be kind, number ${n}.` }));
const base = { name: "Easy Healthy Food", slug: "easy-healthy-food", description: "Simple food ideas for every day.", rules };

assert.ok(communityCategories.includes("other"), "the list always has an \"other\"");
assert.equal(new Set(communityCategories).size, communityCategories.length, "no topic twice");
ok("the topic list: has \"other\", no duplicates");

const good = checkRequestInput({ ...base, category: "health" });
assert.ok("ok" in good && good.value.category === "health");
ok("a known topic is accepted and kept");

for (const bad of [undefined, "", "Health", "weapons", 5, null]) {
  const result = checkRequestInput({ ...base, category: bad });
  assert.deepEqual(result, { error: "category" }, `topic ${String(bad)} is refused`);
}
ok("a missing or unknown topic is refused");

assert.deepEqual(checkRequestInput({ ...base, category: "health", name: "ab" }), { error: "name" }, "the other checks still come first");
ok("the other checks still work");
console.log("\nAll community-topic tests passed.");
