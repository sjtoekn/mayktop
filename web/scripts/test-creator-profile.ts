// Tests for joining the creator program and payout details (TODO 12, S6). Run:  npm run test:creator-profile
// Needs no database. Prints "OK" lines and stops with an error at the first failure.
import assert from "node:assert/strict";
import {
  cleanBank,
  cleanPayPalEmail,
  cleanPayout,
  countryOptions,
  decryptDetails,
  detailsHoldOver,
  encryptDetails,
  isKnownCountry,
  maskDetails,
  methodsFor,
  payoutChanged,
  payoutKey,
} from "../src/lib/creator-profile-rules";
import { creatorsConfig } from "../src/config/site";

function ok(name: string) { console.log("OK  " + name); }
const DAY = 86_400_000;

// 1. Countries
assert.equal(isKnownCountry("LK"), true);
assert.equal(isKnownCountry("in"), true);
assert.equal(isKnownCountry("US"), true);
for (const bad of ["ZZ", "XX", "EU", "UN", "L", "LKA", "", "1K", null, 5]) assert.equal(isKnownCountry(bad), false, String(bad));
const list = countryOptions("en");
assert.deepEqual(list.slice(0, 2).map((c) => c.code).sort(), ["IN", "LK"]); // payout countries first
assert.ok(list.length > 200 && list.length < 300);
assert.ok(list.every((c) => c.name && c.name !== c.code));
assert.ok(countryOptions("fr").length === list.length);
ok("country codes are checked; payout countries are listed first");

// 2. Methods per country
assert.deepEqual([...methodsFor("LK")], ["PAYPAL", "BANK_LK"]);
assert.deepEqual([...methodsFor("in")], ["PAYPAL"]);
assert.deepEqual([...methodsFor("US")], []);
assert.deepEqual([...methodsFor(null)], []);
// every payout country has at least one method, and every method is one the ledger knows
for (const c of creatorsConfig.payoutCountries) assert.ok(methodsFor(c).length > 0, c);
ok("payout methods per country");

// 3. PayPal e-mail and bank details
assert.equal(cleanPayPalEmail("  Maya@Example.COM "), "maya@example.com");
for (const bad of ["", "maya", "a@b", "a b@c.com", "a@@c.com", "a..b@c.com", "<x>@c.com", 5, "a".repeat(250) + "@c.com"]) assert.equal(cleanPayPalEmail(bad), null, String(bad));
const bank = { bankName: " Bank of Ceylon ", branch: "", holderName: "A  B Perera", accountNumber: "1234-5678 90" };
assert.deepEqual(cleanBank(bank), { bankName: "Bank of Ceylon", branch: "", holderName: "A B Perera", accountNumber: "1234567890" });
for (const bad of [null, {}, { ...bank, accountNumber: "12ab56" }, { ...bank, accountNumber: "123" }, { ...bank, holderName: "" }, { ...bank, bankName: "x".repeat(81) }]) assert.equal(cleanBank(bad), null);
ok("PayPal e-mail and bank details are checked and cleaned");

// 4. cleanPayout
let r = cleanPayout({ country: "lk", method: "PAYPAL", paypalEmail: "A@b.lk" }, { needDetails: true });
assert.deepEqual(r, { ok: true, value: { country: "LK", method: "PAYPAL", details: "a@b.lk" } });
r = cleanPayout({ country: "LK", method: "BANK_LK", bank }, { needDetails: true });
assert.ok(r.ok && r.value.method === "BANK_LK" && JSON.parse(r.value.details as string).accountNumber === "1234567890");
r = cleanPayout({ country: "IN", method: "BANK_LK", bank }); // no bank payouts to India
assert.deepEqual(r, { ok: false, error: "method" });
r = cleanPayout({ country: "LK", method: undefined });
assert.deepEqual(r, { ok: false, error: "method" });
r = cleanPayout({ country: "IN", method: "PAYPAL" }); // details may be left out (kept as saved)
assert.deepEqual(r, { ok: true, value: { country: "IN", method: "PAYPAL", details: null } });
r = cleanPayout({ country: "IN", method: "PAYPAL" }, { needDetails: true });
assert.deepEqual(r, { ok: false, error: "paypal" });
r = cleanPayout({ country: "LK", method: "BANK_LK", bank: { bankName: "", branch: "", holderName: "", accountNumber: "" } }, { needDetails: true });
assert.deepEqual(r, { ok: false, error: "bank" });
r = cleanPayout({ country: "IN", method: "PAYPAL", paypalEmail: "nope" });
assert.deepEqual(r, { ok: false, error: "paypal" });
r = cleanPayout({ country: "US", method: "PAYPAL", paypalEmail: "a@b.com" }); // no payouts yet: nothing is kept
assert.deepEqual(r, { ok: true, value: { country: "US", method: null, details: null } });
assert.deepEqual(cleanPayout({ country: "ZZ", method: "PAYPAL" }), { ok: false, error: "country" });
ok("cleanPayout: payout country needs a valid method; other countries keep no method or details");

// 5. Encryption
const hex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const key = payoutKey(hex)!;
assert.ok(key && key.length === 32);
assert.equal(payoutKey(Buffer.alloc(32, 7).toString("base64"))?.length, 32);
for (const bad of [undefined, "", "short", "zz".repeat(32), Buffer.alloc(16).toString("base64")]) assert.equal(payoutKey(bad), null, String(bad));
const sealed = encryptDetails("maya@example.com", key);
assert.ok(!sealed.includes("maya") && sealed.startsWith("v1."));
assert.notEqual(sealed, encryptDetails("maya@example.com", key)); // new random iv each time
assert.equal(decryptDetails(sealed, key), "maya@example.com");
assert.equal(decryptDetails(sealed, Buffer.alloc(32, 1)), null); // wrong key
const parts = sealed.split(".");
parts[3] = Buffer.from("tampered").toString("base64url");
assert.equal(decryptDetails(parts.join("."), key), null); // changed text
for (const junk of [null, undefined, "", "v1.a.b", "v2.a.b.c", "nonsense"]) assert.equal(decryptDetails(junk, key), null);
const unicode = encryptDetails(JSON.stringify(cleanBank({ ...bank, holderName: "සුනිල් පෙරේරා" })), key);
assert.equal(JSON.parse(decryptDetails(unicode, key) as string).holderName, "සුනිල් පෙරේරා");
ok("details are encrypted (random iv), decrypt only with the right key, and tampering is detected");

// 6. Masking never shows the whole thing
assert.equal(maskDetails("PAYPAL", "maya@example.com"), "ma***@example.com");
assert.equal(maskDetails("PAYPAL", "a@b.lk"), "a***@b.lk");
const masked = maskDetails("BANK_LK", JSON.stringify(cleanBank(bank)))!;
assert.equal(masked, "Bank of Ceylon ••••7890");
assert.ok(!masked.includes("123456"));
assert.equal(maskDetails(null, "x"), null);
assert.equal(maskDetails("BANK_LK", "not json"), null);
ok("masking hides the e-mail and the account number");

// 7. Change detection and the waiting time
const base = { country: "LK", method: "PAYPAL", details: "a@b.lk" };
assert.equal(payoutChanged(base, { ...base }), false);
assert.equal(payoutChanged(base, { ...base, details: null }), false); // not given = kept
assert.equal(payoutChanged(base, { ...base, details: "c@d.lk" }), true);
assert.equal(payoutChanged(base, { ...base, country: "IN" }), true);
assert.equal(payoutChanged(base, { ...base, method: "BANK_LK" }), true);
const now = Date.UTC(2026, 11, 1);
assert.equal(detailsHoldOver(null, now), true);
assert.equal(detailsHoldOver(now - creatorsConfig.detailsChangeHoldDays * DAY + 1, now), false);
assert.equal(detailsHoldOver(now - creatorsConfig.detailsChangeHoldDays * DAY, now), true);
ok("a change of country, method or details starts a new waiting time; saving the same thing does not");

console.log("All creator-profile tests passed.");
