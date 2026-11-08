// Stricter rate limits for new accounts (SOCIAL_TODO C2, part 2). Pure functions: no database, so a test can run them.
// An account younger than `days` gets `factor` of every limit (rounded down, never less than 1).
// The numbers live in `newAccountLimits` in src/config/site.ts.
import type { RateRule } from "@/lib/social-limits";

export type NewAccountConfig = { days: number; factor: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** True while the account is younger than `days` days. An unknown or future creation time counts as NOT new (never blocks by mistake). */
export function isNewAccount(createdAtMs: number | null | undefined, config: NewAccountConfig, now: number = Date.now()): boolean {
  if (typeof createdAtMs !== "number" || !Number.isFinite(createdAtMs)) return false;
  const age = now - createdAtMs;
  return age >= 0 && age < config.days * DAY_MS;
}

/** The rules to use for this account: the normal ones, or a smaller copy while the account is new. */
export function rulesForAccount(
  rules: RateRule[],
  createdAtMs: number | null | undefined,
  config: NewAccountConfig,
  now: number = Date.now(),
): RateRule[] {
  if (!isNewAccount(createdAtMs, config, now)) return rules;
  return rules.map((rule) => ({ max: Math.max(1, Math.floor(rule.max * config.factor)), windowMs: rule.windowMs }));
}
