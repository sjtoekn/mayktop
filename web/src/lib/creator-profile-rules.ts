// The rules for joining the creator program and saving payout details (TODO 12, S6). No database, no React: easy to test.
// Payout details (a PayPal e-mail or bank details) are the person's own private data:
//   - they are saved ENCRYPTED (AES-256-GCM) with the key in the CREATOR_PAYOUT_KEY setting; without the key nothing is saved;
//   - the app only ever shows a masked form ("ma***@mail.com", "••••1234");
//   - they are erased with the account (src/lib/purge.ts).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { creatorsConfig as defaultCfg } from "@/config/site";

export type CreatorsConfig = typeof defaultCfg;

// ------------------------------------------------------------------ countries

// ISO 3166 codes that are not countries (the browser knows them as "regions", we do not want them in the list).
const NOT_COUNTRIES = new Set(["AC", "CP", "DG", "EA", "EU", "EZ", "IC", "TA", "UN", "XA", "XB", "XK", "ZZ", "QO"]);

let regionNames: Intl.DisplayNames | null = null;
function names(locale: string): Intl.DisplayNames {
  if (locale === "en") {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames;
  }
  return new Intl.DisplayNames([locale, "en"], { type: "region" });
}

/** Is this a real country code (two letters, any case)? */
export function isKnownCountry(code: unknown): boolean {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return false;
  const up = code.toUpperCase();
  if (NOT_COUNTRIES.has(up)) return false;
  try {
    const name = names("en").of(up);
    return !!name && name !== up;
  } catch {
    return false;
  }
}

/** All countries as { code, name } in the language, sorted by name; the payout countries come first. */
export function countryOptions(locale: string, cfg: CreatorsConfig = defaultCfg): { code: string; name: string }[] {
  const dn = names(locale);
  const all: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      if (!isKnownCountry(code)) continue;
      all.push({ code, name: dn.of(code) ?? code });
    }
  }
  const first = (code: string) => (cfg.payoutCountries.includes(code) ? 0 : 1);
  return all.sort((x, y) => first(x.code) - first(y.code) || x.name.localeCompare(y.name, locale));
}

/** How a country can be paid: ["PAYPAL", "BANK_LK"] for Sri Lanka, [] for a country without payouts yet. */
export function methodsFor(country: string | null | undefined, cfg: CreatorsConfig = defaultCfg): readonly string[] {
  if (!country) return [];
  return cfg.payoutMethods[country.trim().toUpperCase()] ?? [];
}

// ------------------------------------------------------------------ payout details

export type BankDetails = { bankName: string; branch: string; holderName: string; accountNumber: string };

const EMAIL_RE = /^[^\s@<>"',;:()\[\]\\]+@[^\s@<>"',;:()\[\]\\]+\.[^\s@<>"',;:()\[\]\\]{2,}$/;

/** A PayPal e-mail: trimmed, lower case, or null when it does not look like an e-mail. */
export function cleanPayPalEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  if (v.length < 6 || v.length > 254 || !EMAIL_RE.test(v) || v.includes("..")) return null;
  return v;
}

const oneLine = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const x = v.replace(/\s+/g, " ").trim();
  return x.length >= 1 && x.length <= max ? x : null;
};

/** Bank details of a Sri Lankan account, or null when something is missing or wrong. The branch is optional. */
export function cleanBank(input: unknown): BankDetails | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const bankName = oneLine(o.bankName, 80);
  const holderName = oneLine(o.holderName, 80);
  const branch = o.branch === undefined || o.branch === "" ? "" : oneLine(o.branch, 80);
  const digits = typeof o.accountNumber === "string" ? o.accountNumber.replace(/[\s-]/g, "") : "";
  if (!bankName || !holderName || branch === null || !/^\d{6,20}$/.test(digits)) return null;
  return { bankName, branch, holderName, accountNumber: digits };
}

export type PayoutInput = { country: unknown; method: unknown; paypalEmail?: unknown; bank?: unknown };
export type PayoutError = "country" | "method" | "paypal" | "bank";
export type PayoutClean = {
  country: string; // upper case ISO code
  method: string | null; // null: payouts are not open for this country yet
  details: string | null; // the plain text to encrypt (an e-mail, or JSON of the bank details); null: nothing given
};

/**
 * Checks what the person typed. A country without payouts yet gets no method and no details (nothing to pay to).
 * For a payout country a method is required; its details are optional here (`needDetails` makes them required),
 * because the person may keep the details they saved before.
 */
export function cleanPayout(
  input: PayoutInput,
  opts: { needDetails?: boolean } = {},
  cfg: CreatorsConfig = defaultCfg,
): { ok: true; value: PayoutClean } | { ok: false; error: PayoutError } {
  if (!isKnownCountry(input.country)) return { ok: false, error: "country" };
  const country = (input.country as string).toUpperCase();
  const allowed = methodsFor(country, cfg);
  if (allowed.length === 0) return { ok: true, value: { country, method: null, details: null } };

  if (typeof input.method !== "string" || !allowed.includes(input.method)) return { ok: false, error: "method" };
  const method = input.method;

  const blank = method === "PAYPAL" ? input.paypalEmail === undefined || input.paypalEmail === "" : input.bank === undefined || input.bank === null || isBlankBank(input.bank);
  if (blank) {
    if (opts.needDetails) return { ok: false, error: method === "PAYPAL" ? "paypal" : "bank" };
    return { ok: true, value: { country, method, details: null } };
  }
  if (method === "PAYPAL") {
    const email = cleanPayPalEmail(input.paypalEmail);
    return email ? { ok: true, value: { country, method, details: email } } : { ok: false, error: "paypal" };
  }
  const bank = cleanBank(input.bank);
  return bank ? { ok: true, value: { country, method, details: JSON.stringify(bank) } } : { ok: false, error: "bank" };
}

function isBlankBank(bank: unknown): boolean {
  if (!bank || typeof bank !== "object") return true;
  return Object.values(bank as Record<string, unknown>).every((v) => typeof v !== "string" || v.trim() === "");
}

// ------------------------------------------------------------------ encryption

/** The 32-byte key from the CREATOR_PAYOUT_KEY setting (64 hex characters, or base64 of 32 bytes). Null: not set / not valid. */
export function payoutKey(raw: string | undefined = process.env.CREATOR_PAYOUT_KEY): Buffer | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  try {
    const b = Buffer.from(v, "base64");
    return b.length === 32 ? b : null;
  } catch {
    return null;
  }
}

/** "v1.<iv>.<tag>.<text>" (base64url). A new random iv every time, so the same e-mail never gives the same text. */
export function encryptDetails(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** The plain text, or null when the key is wrong or the text was changed (GCM checks both). Never throws. */
export function decryptDetails(blob: string | null | undefined, key: Buffer): string | null {
  if (!blob) return null;
  const parts = blob.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    d.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([d.update(Buffer.from(parts[3], "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** What the page may show about saved details: "ma***@mail.com" or "Bank name ••••1234". Never the whole thing. */
export function maskDetails(method: string | null | undefined, plain: string | null | undefined): string | null {
  if (!method || !plain) return null;
  if (method === "PAYPAL") {
    const [name, domain] = plain.split("@");
    if (!name || !domain) return null;
    return `${name.slice(0, Math.min(2, name.length))}***@${domain}`;
  }
  try {
    const b = JSON.parse(plain) as Partial<BankDetails>;
    if (typeof b.accountNumber !== "string" || typeof b.bankName !== "string") return null;
    return `${b.bankName} ••••${b.accountNumber.slice(-4)}`;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ changing details

/** True when the person's payment settings really changed (so the waiting time starts again). Details null = "not given, keep". */
export function payoutChanged(
  before: { country: string | null; method: string | null; details: string | null },
  after: { country: string | null; method: string | null; details: string | null },
): boolean {
  if ((before.country ?? null) !== (after.country ?? null)) return true;
  if ((before.method ?? null) !== (after.method ?? null)) return true;
  return after.details !== null && after.details !== before.details;
}

/** Has the waiting time after a change ended? (S8 checks this before putting a person into a payout.) No change on record = yes. */
export function detailsHoldOver(changedAtMs: number | null, nowMs: number, cfg: CreatorsConfig = defaultCfg): boolean {
  if (changedAtMs === null) return true;
  return nowMs - changedAtMs >= cfg.detailsChangeHoldDays * 86_400_000;
}
