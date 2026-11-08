// Tests for the database rate limiter (SOCIAL_TODO C2). Run:  npm run test:rate-limit-db
// Needs no database: a stand-in store plays the RateEvent table. Stops at the first failure.
import assert from "node:assert/strict";
import { takeActionWith, type RateStore } from "../src/lib/rate-limit-store";
import type { RateRule } from "../src/lib/social-limits";

function ok(name: string) { console.log("OK  " + name); }

/** A store that lives in an array, like the table. `restart()` does nothing, because a database keeps its rows. */
function makeStore() {
  const rows: { key: string; at: number }[] = [];
  const store: RateStore = {
    async load(key, since) { return rows.filter((r) => r.key === key && r.at >= since).map((r) => r.at); },
    async add(key, at) { rows.push({ key, at }); },
    async prune(key, before) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].key === key && rows[i].at < before) rows.splice(i, 1);
    },
  };
  return { store, rows };
}

const SEC = 1000;
const MIN = 60 * SEC;
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const rules: RateRule[] = [{ max: 3, windowMs: MIN }, { max: 5, windowMs: 10 * MIN }];

async function main() {
  // 1. the first events are allowed, the one after the limit is refused with a wait time
  {
    const { store } = makeStore();
    for (let i = 0; i < 3; i++) assert.equal((await takeActionWith(store, "like:a", rules, NOW + i * SEC)).ok, true);
    const r = await takeActionWith(store, "like:a", rules, NOW + 3 * SEC);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.retryAfterMs, MIN - 3 * SEC); // the oldest event (at NOW) leaves the window at NOW + 60 s
    ok("3 allowed, the 4th refused, wait time = until the oldest event leaves the window");
  }

  // 2. a refused event is not saved (so refusing does not push the wait time further away)
  {
    const { store, rows } = makeStore();
    for (let i = 0; i < 3; i++) await takeActionWith(store, "k", rules, NOW);
    for (let i = 0; i < 10; i++) await takeActionWith(store, "k", rules, NOW + 5 * SEC);
    assert.equal(rows.length, 3);
    assert.equal((await takeActionWith(store, "k", rules, NOW + MIN)).ok, true);
    ok("refused tries are not saved; room appears exactly when the window has passed");
  }

  // 3. the long rule counts too (5 per 10 minutes) even when the short rule has room
  {
    const { store } = makeStore();
    let t = NOW;
    for (let i = 0; i < 5; i++) { assert.equal((await takeActionWith(store, "k", rules, t)).ok, true); t += 61 * SEC; }
    const r = await takeActionWith(store, "k", rules, t);
    assert.equal(r.ok, false);
    ok("the 10-minute rule still refuses when the 1-minute rule has room");
  }

  // 4. people do not share a counter
  {
    const { store } = makeStore();
    for (let i = 0; i < 3; i++) await takeActionWith(store, "like:a", rules, NOW);
    assert.equal((await takeActionWith(store, "like:a", rules, NOW)).ok, false);
    assert.equal((await takeActionWith(store, "like:b", rules, NOW)).ok, true);
    assert.equal((await takeActionWith(store, "follow:a", rules, NOW)).ok, true);
    ok("another person, or another kind of action, has its own counter");
  }

  // 5. a "server restart" or a second server is just another caller of the same store: the count is still there
  {
    const { store } = makeStore();
    for (let i = 0; i < 3; i++) await takeActionWith(store, "k", rules, NOW);
    // (no memory is kept in takeActionWith, so a new process sees exactly the same rows)
    assert.equal((await takeActionWith(store, "k", rules, NOW + SEC)).ok, false);
    ok("the count comes from the store, not from process memory (survives restart, shared by servers)");
  }

  // 6. old rows are removed, rows still inside the longest window are kept
  {
    const { store, rows } = makeStore();
    await takeActionWith(store, "k", rules, NOW);
    await takeActionWith(store, "k", rules, NOW + 9 * MIN);
    await takeActionWith(store, "k", rules, NOW + 11 * MIN); // the first event is now older than 10 minutes
    assert.equal(rows.filter((r) => r.key === "k").length, 2);
    ok("events older than the longest window are pruned");
  }

  // 7. exact edge: an event exactly windowMs old no longer counts
  {
    const { store } = makeStore();
    const one: RateRule[] = [{ max: 1, windowMs: MIN }];
    assert.equal((await takeActionWith(store, "k", one, NOW)).ok, true);
    assert.equal((await takeActionWith(store, "k", one, NOW + MIN - 1)).ok, false);
    assert.equal((await takeActionWith(store, "k", one, NOW + MIN)).ok, true);
    ok("window edge is the same as the memory limiter (now - time < windowMs)");
  }

  console.log("\nAll rate-limit-db checks passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
