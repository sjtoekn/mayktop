// The numbers behind the Creator Overview page (TODO 12, S5). Pure: no database, no React, so they are easy to test.
// The database part is creator-overview.ts. Money is whole micro-USD (see creator-rules.ts).
import { creatorsConfig as defaultCfg } from "@/config/site";
import { canPayout, earningState, type CreatorsConfig } from "@/lib/creator-rules";

const DAY_MS = 86_400_000;

/** The last `n` UTC days ending on the day of `nowMs` (oldest first), each with its impressions (0 when there is no row). */
export function lastDays(nowMs: number, n: number, byDay: Map<number, number>): { dayMs: number; impressions: number }[] {
  const end = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const out: { dayMs: number; impressions: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dayMs = end - i * DAY_MS;
    out.push({ dayMs, impressions: byDay.get(dayMs) ?? 0 });
  }
  return out;
}

/** Impressions of the current UTC month, from per-day numbers. */
export function monthImpressions(nowMs: number, byDay: Map<number, number>): number {
  const d = new Date(nowMs);
  const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  let sum = 0;
  for (const [day, n] of byDay) if (day >= from && day <= nowMs) sum += n;
  return sum;
}

export type LedgerRow = {
  amountMicroUsd: number; // signed
  status: string; // ACTIVE | VOID
  createdAtMs: number;
  payoutId: number | null;
  payoutStatus: string | null; // PENDING | PAID | FAILED, when the row is in a payout
};

export type Balances = {
  accruedMicro: number; // waiting in the hold period
  payableMicro: number; // can be paid (once the total reaches the minimum)
  heldMicro: number; // kept because payouts are not open for the person's country (never lost)
  inPayoutMicro: number; // in a payout that is made but not marked paid yet
  paidMicro: number; // already paid
  totalOpenMicro: number; // accrued + payable + held + in payout: everything the person still has coming
};

/** Adds the ledger up into the balances the page shows. VOID rows are history only and are ignored. */
export function balancesFrom(rows: LedgerRow[], country: string | null, nowMs: number, cfg: CreatorsConfig = defaultCfg): Balances {
  const b: Balances = { accruedMicro: 0, payableMicro: 0, heldMicro: 0, inPayoutMicro: 0, paidMicro: 0, totalOpenMicro: 0 };
  for (const r of rows) {
    if (r.status !== "ACTIVE") continue;
    if (r.payoutId !== null && r.payoutStatus === "PAID") {
      b.paidMicro += r.amountMicroUsd;
    } else if (r.payoutId !== null && r.payoutStatus === "PENDING") {
      b.inPayoutMicro += r.amountMicroUsd;
    } else {
      const s = earningState(country, r.createdAtMs, nowMs, cfg);
      if (s === "HELD_COUNTRY") b.heldMicro += r.amountMicroUsd;
      else if (s === "ACCRUED") b.accruedMicro += r.amountMicroUsd;
      else b.payableMicro += r.amountMicroUsd;
    }
  }
  b.totalOpenMicro = b.accruedMicro + b.payableMicro + b.heldMicro + b.inPayoutMicro;
  return b;
}

export type NextPayout =
  | { kind: "none-country" } // payouts are not open for the country yet (or no country chosen)
  | { kind: "frozen" } // staff froze the earnings
  | { kind: "no-details" } // no payout method / details saved yet
  | { kind: "details-wait"; untilMs: number } // payment settings changed recently
  | { kind: "need-more"; missingMicro: number } // below the minimum
  | { kind: "ready" }; // payable total reaches the minimum: staff pays it in the next payout round

/** What the person should expect next. Order: country, frozen, details, waiting after a change, minimum. */
export function nextPayout(
  p: { country: string | null; isPayoutCountry: boolean; frozen: boolean; hasDetails: boolean; holdUntilMs: number | null },
  payableMicro: number,
  cfg: CreatorsConfig = defaultCfg,
): NextPayout {
  if (!p.isPayoutCountry) return { kind: "none-country" };
  if (p.frozen) return { kind: "frozen" };
  if (!p.hasDetails) return { kind: "no-details" };
  if (p.holdUntilMs !== null) return { kind: "details-wait", untilMs: p.holdUntilMs };
  if (!canPayout(payableMicro, cfg)) return { kind: "need-more", missingMicro: Math.max(0, cfg.minPayoutMicroUsd - payableMicro) };
  return { kind: "ready" };
}

/** Bar heights in percent (0-100); a day with something is at least 4% tall so it stays visible. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => (v <= 0 ? 0 : Math.max(4, Math.round((v / max) * 100))));
}

export type PageRole = "ASKER" | "ANSWER" | "BOTH";

/** A person may have asked a question and also answered it. */
export function roleOf(asked: boolean, answered: boolean): PageRole {
  return asked && answered ? "BOTH" : asked ? "ASKER" : "ANSWER";
}
