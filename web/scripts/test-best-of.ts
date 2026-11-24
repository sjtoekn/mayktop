// Run: npm run test:best-of   (the fair choice of the "Best of the community" box)
import assert from "node:assert/strict";
import { pickFair, luck, type Candidate } from "../src/lib/best-of-rules";

const cfg = { risingEvery: 4, risingLuck: 2, seedHours: 6 };
const now = Date.UTC(2026, 10, 24, 8, 0, 0);
const c = (key: string, author: string, score: number, isNew = false): Candidate<null> => ({ key, authorKey: author, score, isNew, data: null });

// 1. the best scores first, one place per person
{
  const out = pickFair([c("a", "u1", 5), c("b", "u1", 9), c("c", "u2", 3), c("d", "u3", 1)], 4, now, cfg);
  assert.deepEqual(out.map((i) => i.key), ["b", "c", "d"]); // u1 only once (the better one); nobody else left
}
// 2. the 4th place is a new voice, even with no score yet
{
  const items = [c("a", "u1", 9), c("b", "u2", 8), c("c", "u3", 7), c("d", "u4", 6), c("n", "u5", 0, true)];
  const out = pickFair(items, 4, now, cfg);
  assert.equal(out.length, 4);
  assert.equal(out[3].key, "n");
  assert.deepEqual(out.slice(0, 3).map((i) => i.key), ["a", "b", "c"]);
}
// 3. no new voice around: the 4th place goes on with the next best
{
  const out = pickFair([c("a", "u1", 9), c("b", "u2", 8), c("c", "u3", 7), c("d", "u4", 6)], 4, now, cfg);
  assert.deepEqual(out.map((i) => i.key), ["a", "b", "c", "d"]);
}
// 4. nothing earned at all: nothing from the normal places, new voices may fill (never an old person with 0)
{
  const out = pickFair([c("o", "u1", 0), c("n", "u2", 0, true)], 4, now, cfg);
  assert.deepEqual(out.map((i) => i.key), ["n"]);
}
// 5. same input, same answer; the draw is in [0, 1) and changes only when the window changes
{
  const items = [c("a", "u1", 3), c("n1", "u2", 0, true), c("n2", "u3", 0, true), c("n3", "u4", 0, true), c("b", "u5", 2), c("d", "u6", 1), c("e", "u7", 1)];
  assert.deepEqual(pickFair(items, 4, now, cfg).map((i) => i.key), pickFair(items, 4, now, cfg).map((i) => i.key));
  const l = luck("n1", now, 6);
  assert.ok(l >= 0 && l < 1);
  assert.equal(luck("n1", now + 1000, 6), l);
}
// 6. an abuser with many items still takes only one place
{
  const spam = Array.from({ length: 10 }, (_, i) => c(`s${i}`, "spammer", 100 + i));
  const out = pickFair([...spam, c("x", "u2", 1)], 4, now, cfg);
  assert.equal(out.filter((i) => i.authorKey === "spammer").length, 1);
}
console.log("PASS test-best-of");
