// The logic of the database rate limiter (SOCIAL_TODO C2), without any database code, so a test can run it with a
// stand-in store. The real store (Prisma) is in rate-limit-db.ts.
import { checkRules, type RateResult, type RateRule } from "@/lib/social-limits";

/** The three things the limiter needs from a store. Times are milliseconds. */
export type RateStore = {
  /** Earlier events of `key` that happened at or after `since`. */
  load(key: string, since: number): Promise<number[]>;
  /** Save one counted event. */
  add(key: string, at: number): Promise<void>;
  /** Forget events of `key` older than `before` (they can never matter again). */
  prune(key: string, before: number): Promise<void>;
};

/** Counts one event for `key` when every rule has room. A refused event is NOT saved. */
export async function takeActionWith(
  store: RateStore,
  key: string,
  rules: RateRule[],
  now: number = Date.now(),
): Promise<RateResult> {
  const longest = Math.max(...rules.map((rule) => rule.windowMs));
  const since = now - longest + 1; // an event is "in the window" while now - time < windowMs
  const times = await store.load(key, since);
  const result = checkRules(times, rules, now);
  if (result.ok) await store.add(key, now);
  await store.prune(key, since);
  return result;
}
