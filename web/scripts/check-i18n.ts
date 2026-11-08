// check-i18n (ADS_PLAN Session 7): every text key must exist in all six languages, and every literal t("key") in the code must exist.
// Run in web/:  npm run check:i18n     Plural forms (.zero .one .two .few .many .other) may differ between languages on purpose.
import fs from "node:fs";
import path from "node:path";

const langs = ["en", "ar", "es", "fr", "hi", "zh"];
const dir = path.join(process.cwd(), "src/i18n/messages");
const PLURAL = /\.(zero|one|two|few|many|other)$/;
const keysOf = (src: string) =>
  new Set([...src.matchAll(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_.]+))\s*:/gm)].map((m) => m[1] ?? m[2] ?? m[3]));

let problems = 0;
const sets: Record<string, Set<string>> = {};
for (const l of langs) sets[l] = keysOf(fs.readFileSync(path.join(dir, `${l}.ts`), "utf8"));

const base = (k: string) => k.replace(PLURAL, "");
const enBase = new Set([...sets.en].map(base));
for (const l of langs.slice(1)) {
  const have = new Set([...sets[l]].map(base));
  const missing = [...enBase].filter((k) => !have.has(k));
  const extra = [...have].filter((k) => !enBase.has(k));
  for (const k of missing) { console.log(`PROBLEM ${l}: missing "${k}"`); problems++; }
  for (const k of extra) { console.log(`PROBLEM ${l}: "${k}" is not in en.ts`); problems++; }
}

const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const used = new Map<string, string>();
for (const f of walk("src")) {
  if (!/\.(ts|tsx)$/.test(f) || f.includes(`i18n${path.sep}messages`)) continue;
  for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g)) if (!used.has(m[1])) used.set(m[1], f);
}
for (const [k, f] of used) if (!enBase.has(base(k))) { console.log(`PROBLEM: t("${k}") in ${f} has no text in en.ts`); problems++; }

console.log(`${enBase.size} texts x ${langs.length} languages, ${used.size} keys used in code.`);
console.log(problems === 0 ? "All checks passed." : `${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
