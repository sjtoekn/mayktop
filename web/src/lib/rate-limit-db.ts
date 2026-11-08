// Rate limits kept in the DATABASE (SOCIAL_TODO C2). Replaces the server-memory counter `takeAction` for the Social actions.
//  - Survives a server restart and is right when several servers share one database.
//  - Same rules, same answers as `takeAction` (it uses the same `checkRules`), only the list of earlier events comes from the table.
//  - The logic itself is in rate-limit-store.ts (no Prisma there), so a test can run it with a stand-in store.
//  - `takeActionDb(...)` is what the pages and actions call.
// If the database cannot be reached the limiter does NOT break the page: it falls back to the memory counter for that
// one call (and writes a line to the server log). Hitting the database for a limit that fails means the action itself would fail too.
import { prisma } from "@/lib/prisma";
import { takeActionWith, type RateStore } from "@/lib/rate-limit-store";
import { takeAction, type RateResult, type RateRule } from "@/lib/social-limits";

const SWEEP_AFTER_MS = 2 * 24 * 60 * 60 * 1000; // no rule is longer than a day; 2 days is a safe margin
const SWEEP_CHANCE = 1 / 200; // on average once per 200 calls, delete everybody's old rows

const databaseStore: RateStore = {
  async load(key, since) {
    const rows = await prisma.rateEvent.findMany({
      where: { key, at: { gte: new Date(since) } },
      select: { at: true },
    });
    return rows.map((row) => row.at.getTime());
  },
  async add(key, at) {
    await prisma.rateEvent.create({ data: { key, at: new Date(at) } });
  },
  async prune(key, before) {
    await prisma.rateEvent.deleteMany({ where: { key, at: { lt: new Date(before) } } });
    if (Math.random() < SWEEP_CHANCE) {
      await prisma.rateEvent.deleteMany({ where: { at: { lt: new Date(Date.now() - SWEEP_AFTER_MS) } } });
    }
  },
};

/**
 * Database version of `takeAction`. Use it with `await`:
 *   if (!(await takeActionDb(`like:${viewer.id}`, rules)).ok) ...
 */
export async function takeActionDb(
  key: string,
  rules: RateRule[],
  now: number = Date.now(),
): Promise<RateResult> {
  try {
    return await takeActionWith(databaseStore, key, rules, now);
  } catch (error) {
    console.error("rate limit database failed, using memory for this call:", error);
    return takeAction(key, rules, now);
  }
}
