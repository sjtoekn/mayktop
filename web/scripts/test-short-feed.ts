// npm run test:short-feed  (no database). Checks the pure rules of the Shorts feed.
import {
  encodeShortCursor, fitMode, formatClock, parseShortCursor, progressPermille, seekTarget, shouldLoadMore, spreadCreators, stepIndex,
} from "../src/lib/short-feed-rules";

let failed = 0;
function check(name: string, ok: boolean) {
  if (!ok) { failed += 1; console.error("FAIL:", name); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// cursor
check("cursor round trip", same(parseShortCursor(encodeShortCursor({ createdAtMs: 1762650000000, id: 42 })), { createdAtMs: 1762650000000, id: 42 }));
for (const bad of [null, undefined, 5, "", "abc", "1.2.3", "1762650000000", "-1.5", "1.-5", "1e5.2", "1.2 ", " 1.2", "99999999999999999.1", "1.99999999999"]) {
  check(`cursor rejects ${String(bad)}`, parseShortCursor(bad) === null);
}

// spreadCreators: nothing lost, nothing added, no needless repeats, order kept when already fine
const mk = (...owners: string[]) => owners.map((ownerId, i) => ({ ownerId, n: i }));
const sorted = (xs: { n: number }[]) => xs.map((x) => x.n).sort((a, b) => a - b);
{
  const input = mk("a", "a", "b", "a", "c", "c");
  const out = spreadCreators(input);
  check("spread keeps every item", same(sorted(out), sorted(input)) && out.length === input.length);
  let repeats = 0;
  for (let i = 1; i < out.length; i++) if (out[i].ownerId === out[i - 1].ownerId) repeats++;
  check("spread removes avoidable repeats", repeats === 0);
  check("spread first item is the newest", out[0].n === 0);
}
check("spread leaves a fine order alone", same(spreadCreators(mk("a", "b", "c")).map((x) => x.n), [0, 1, 2]));
check("spread: only one creator keeps order", same(spreadCreators(mk("a", "a", "a")).map((x) => x.n), [0, 1, 2]));
check("spread: empty", spreadCreators([]).length === 0);
check("spread does not change its input", (() => { const i = mk("a", "a", "b"); spreadCreators(i); return same(i.map((x) => x.n), [0, 1, 2]); })());

// fitMode
check("9:16 covers", fitMode(1080, 1920, 0.5, 0.62) === "cover");
check("16:9 contains", fitMode(1920, 1080, 0.5, 0.62) === "contain");
check("square contains", fitMode(1000, 1000, 0.5, 0.62) === "contain");
check("unknown size contains", fitMode(null, null, 0.5, 0.62) === "contain");
check("zero size contains", fitMode(0, 100, 0.5, 0.62) === "contain");

// clock
check("clock 0", formatClock(0) === "0:00");
check("clock 75.4", formatClock(75.4) === "1:15");
check("clock 59.99", formatClock(59.99) === "0:59");
check("clock NaN", formatClock(NaN) === "0:00");
check("clock negative", formatClock(-5) === "0:00");

// seek
check("seek +10", seekTarget(20, 10, 60) === 30);
check("seek past end", seekTarget(55, 10, 60) === 60);
check("seek before start", seekTarget(4, -10, 60) === 0);
check("seek unknown duration", seekTarget(4, 10, NaN) === 14);

// step
check("step down", stepIndex(0, 1, 5) === 1);
check("step up at top stays", stepIndex(0, -1, 5) === 0);
check("step down at end stays", stepIndex(4, 1, 5) === 4);
check("step empty list", stepIndex(0, 1, 0) === 0);

// load more
check("load more near end", shouldLoadMore(6, 8, true, false, 3) === true);
check("no load when far", shouldLoadMore(2, 8, true, false, 3) === false);
check("no load while loading", shouldLoadMore(7, 8, true, true, 3) === false);
check("no load without more", shouldLoadMore(7, 8, false, false, 3) === false);
check("no load for empty list", shouldLoadMore(0, 0, true, false, 3) === false);

// progress
check("progress half", progressPermille(15, 30) === 500);
check("progress end", progressPermille(99, 30) === 1000);
check("progress unknown", progressPermille(5, NaN) === 0);
check("progress start", progressPermille(0, 30) === 0);

if (failed > 0) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log("test:short-feed OK");
