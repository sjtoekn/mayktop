// Rate limits for Social actions (SOCIAL_TODO 10). Pure functions: no database, no imports, so a test can run them.
//  - checkRules: given the times of the person's earlier events, may one more happen now?
//  - takeAction: the same, for events kept in this server process's memory (used for likes).
// Posts are counted from the database (the posts are already saved there, so the count survives a restart and
// is right with several servers). Likes are not worth a table: they are counted in memory, like src/lib/ad-guard.ts.
// With several servers a shared limiter is needed (TODO 50).
// The numbers live in `socialLimits` in src/config/site.ts.

export type RateRule = { max: number; windowMs: number };
export type RateResult = { ok: true } | { ok: false; retryAfterMs: number };

/**
 * `times` = milliseconds timestamps of the earlier events (any order). The event is refused when ANY rule is
 * full; `retryAfterMs` is how long until every full rule has room again (always at least 1).
 */
export function checkRules(times: number[], rules: RateRule[], now: number): RateResult {
  let retryAfterMs = 0;
  for (const rule of rules) {
    const inWindow = times.filter((time) => now - time < rule.windowMs).sort((a, b) => a - b);
    if (inWindow.length >= rule.max) {
      // Room appears when enough of the oldest events have left the window.
      const mustLeave = inWindow[inWindow.length - rule.max];
      retryAfterMs = Math.max(retryAfterMs, mustLeave + rule.windowMs - now);
    }
  }
  return retryAfterMs > 0 ? { ok: false, retryAfterMs: Math.max(1, retryAfterMs) } : { ok: true };
}

const events = new Map<string, number[]>();
const SWEEP_AT = 5000; // when this many people are tracked, forget everyone whose events have all expired

/** Counts one event for `key` (for example "like:<userId>"). Returns { ok: false } when a rule is full. */
export function takeAction(key: string, rules: RateRule[], now: number = Date.now()): RateResult {
  const longest = Math.max(...rules.map((rule) => rule.windowMs));
  const recent = (events.get(key) ?? []).filter((time) => now - time < longest);
  const result = checkRules(recent, rules, now);
  if (result.ok) {
    recent.push(now);
    events.set(key, recent);
  } else if (recent.length > 0) {
    events.set(key, recent);
  } else {
    events.delete(key);
  }
  if (events.size > SWEEP_AT) {
    for (const [k, list] of events) {
      if (list.every((time) => now - time >= longest)) events.delete(k);
    }
  }
  return result;
}

/** Test helper: forget everything. */
export function resetActionLimits(): void {
  events.clear();
}
