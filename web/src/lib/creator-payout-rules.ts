// The rules of paying creators (TODO 12, S8). Pure: no database, no React, so they are easy to test.
// The database part is creator-payouts.ts. Money is whole micro-USD (see creator-rules.ts).
// Nothing here pays anyone: it only decides WHO may be put into a payout round and WHAT goes into the CSV an admin pays from.
import { creatorsConfig as defaultCfg } from "@/config/site";
import { canPayout, earningState, formatUsd, isPayoutCountry, type CreatorsConfig } from "@/lib/creator-rules";
import { detailsHoldOver, methodsFor, type BankDetails } from "@/lib/creator-profile-rules";

/** One open ledger row: ACTIVE, not in any payout yet. */
export type OpenRow = { id: number; amountMicroUsd: number; createdAtMs: number };

export type CreatorForPayout = {
  userId: string;
  username: string;
  accountActive: boolean; // false: banned / suspended / deleted: staff must look at the money by hand
  country: string | null;
  method: string | null;
  hasDetails: boolean;
  frozen: boolean; // staff froze the earnings
  detailsChangedAtMs: number | null;
  rows: OpenRow[];
};

/** Why a person with money to pay is NOT in the round. */
export type Blocker = "account" | "frozen" | "no-method" | "no-details" | "details-wait" | "minimum";

export type ReadyPayout = {
  userId: string;
  username: string;
  country: string; // upper case
  method: string;
  rowIds: number[];
  amountMicro: number; // the sum of rowIds: always >= minPayoutMicroUsd
};

export type BlockedCreator = { userId: string; username: string; country: string | null; payableMicro: number; reason: Blocker };

/**
 * What can be paid now: rows that are PAYABLE (hold period over, payout country) plus every negative row
 * (a reversal or an ad paid with credit lowers the payout at once, it does not wait in the hold period).
 * Money of other countries is never counted: it is kept (HELD_COUNTRY).
 */
export function payableRows(country: string | null, rows: OpenRow[], nowMs: number, cfg: CreatorsConfig = defaultCfg): OpenRow[] {
  if (!isPayoutCountry(country, cfg)) return [];
  return rows.filter((r) => r.amountMicroUsd < 0 || earningState(country, r.createdAtMs, nowMs, cfg) === "PAYABLE");
}

export function sumMicro(rows: OpenRow[]): number {
  return rows.reduce((n, r) => n + r.amountMicroUsd, 0);
}

/**
 * Decides one round. A person is READY when: the account is active, the country is a payout country, the earnings are not frozen,
 * a method that is allowed for the country AND saved details exist, the waiting time after a change of details is over,
 * and the payable total reaches the minimum. Everyone with payable money who is not ready is listed with ONE reason (first match).
 * Persons whose money is only waiting (hold days) or kept (other country) are not listed at all.
 */
export function planPayouts(
  creators: CreatorForPayout[],
  nowMs: number,
  cfg: CreatorsConfig = defaultCfg,
): { ready: ReadyPayout[]; blocked: BlockedCreator[] } {
  const ready: ReadyPayout[] = [];
  const blocked: BlockedCreator[] = [];
  for (const c of creators) {
    const rows = payableRows(c.country, c.rows, nowMs, cfg);
    const total = sumMicro(rows);
    const positive = rows.some((r) => r.amountMicroUsd > 0);
    // A suspended / banned account with money in ANY country needs a human look (staff reverse it or release it).
    const anyOpen = sumMicro(c.rows) > 0;
    const note = (reason: Blocker, payableMicro = total) =>
      blocked.push({ userId: c.userId, username: c.username, country: c.country, payableMicro, reason });

    if (!c.accountActive) {
      if (anyOpen) note("account", sumMicro(c.rows));
      continue;
    }
    if (!positive || total <= 0) continue;
    if (c.frozen) { note("frozen"); continue; }
    const country = (c.country ?? "").trim().toUpperCase();
    if (!c.method || !methodsFor(country, cfg).includes(c.method)) { note("no-method"); continue; }
    if (!c.hasDetails) { note("no-details"); continue; }
    if (!detailsHoldOver(c.detailsChangedAtMs, nowMs, cfg)) { note("details-wait"); continue; }
    if (!canPayout(total, cfg)) { note("minimum"); continue; }
    ready.push({ userId: c.userId, username: c.username, country, method: c.method, rowIds: rows.map((r) => r.id), amountMicro: total });
  }
  ready.sort((a, b) => a.country.localeCompare(b.country) || a.username.localeCompare(b.username));
  return { ready, blocked };
}

/** The words a payout round may be filtered by (admin screen): all, or one payout country. */
export function parseCountryFilter(raw: unknown, cfg: CreatorsConfig = defaultCfg): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toUpperCase();
  return cfg.payoutCountries.includes(v) ? v : null;
}

// ------------------------------------------------------------------ marking paid

/** The reference an admin writes down (PayPal transaction id / bank transfer number). One line, 3-80 characters. */
export function cleanReference(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\s+/g, " ").trim();
  return v.length >= 3 && v.length <= 80 ? v : null;
}

/** The note an admin must write for a freeze / reversal / failed payout (min 10, max 300 characters). */
export function cleanReason(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.replace(/\s+/g, " ").trim();
  return v.length >= 10 && v.length <= 300 ? v : null;
}

// ------------------------------------------------------------------ CSV for the admin who pays

export type CsvPayout = { payoutId: number; username: string; amountMicro: number; details: string | null }; // details: the DECRYPTED text

/** The text the admin puts in the PayPal / bank "reference" box, so the paid line can be matched to the payout. */
export function payoutRef(payoutId: number): string {
  return `FALV-${payoutId}`;
}

/** One CSV cell. Quotes are doubled; a cell that starts like a spreadsheet formula gets a leading ' so Excel never runs it. */
export function csvCell(value: string | number): string {
  let s = String(value).replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const line = (cells: (string | number)[]) => cells.map(csvCell).join(",");

/**
 * The CSV for ONE method. The amount is rounded DOWN to cents (never pays more than the ledger says; a part of a cent stays recorded
 * as paid in the ledger, it is below one cent). Rows whose details cannot be read are returned in `missing` and left out of the file.
 * PAYPAL columns follow PayPal's mass-payment file: e-mail, amount, currency, reference, note.
 */
export function payoutCsv(method: string, payouts: CsvPayout[], cfg: CreatorsConfig = defaultCfg): { csv: string; missing: number[] } {
  const missing: number[] = [];
  const out: string[] = [];
  out.push(
    method === "PAYPAL"
      ? line(["Email", "Amount", "Currency", "Reference", "Note"])
      : line(["Reference", "Account holder", "Bank", "Branch", "Account number", "Amount", "Currency"]),
  );
  for (const p of payouts) {
    if (!p.details) { missing.push(p.payoutId); continue; }
    const amount = formatUsd(p.amountMicro);
    if (method === "PAYPAL") {
      out.push(line([p.details, amount, cfg.currency, payoutRef(p.payoutId), "Creator earnings"]));
      continue;
    }
    let bank: Partial<BankDetails> | null = null;
    try { bank = JSON.parse(p.details) as Partial<BankDetails>; } catch { bank = null; }
    if (!bank || typeof bank.accountNumber !== "string" || typeof bank.holderName !== "string" || typeof bank.bankName !== "string") {
      missing.push(p.payoutId);
      continue;
    }
    out.push(line([payoutRef(p.payoutId), bank.holderName, bank.bankName, bank.branch ?? "", bank.accountNumber, amount, cfg.currency]));
  }
  return { csv: out.join("\r\n") + "\r\n", missing };
}
