// patch-ads-csv: adds 2 texts (6 languages) and "test:ad-csv" to package.json. Run in the project folder (where PROJECT.md is):
//     node apply-ads-csv.mjs        Safe to run twice.
import fs from "node:fs";
const T = {
  "ad.detail.csv": ["Download the numbers (CSV)", "Descargar las cifras (CSV)", "Télécharger les chiffres (CSV)", "下载数据（CSV）", "आँकड़े डाउनलोड करें (CSV)", "تنزيل الأرقام (CSV)"],
  "admin.ads.stats.csv": ["Download all ads (CSV)", "Descargar todos los anuncios (CSV)", "Télécharger toutes les publicités (CSV)", "下载所有广告（CSV）", "सभी विज्ञापन डाउनलोड करें (CSV)", "تنزيل كل الإعلانات (CSV)"],
};
["en", "es", "fr", "zh", "hi", "ar"].forEach((lang, i) => {
  const p = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(p)) throw new Error(p + " is missing");
  let s = fs.readFileSync(p, "utf8");
  const lines = Object.entries(T).filter(([k]) => !s.includes(JSON.stringify(k) + ":")).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[i])},`);
  if (!lines.length) return console.log("already  " + p);
  const at = s.lastIndexOf("\n" + (lang === "en" ? "} as const;" : "};"));
  if (at < 0) throw new Error(p + ": cannot find the end of the texts");
  fs.writeFileSync(p, s.slice(0, at) + "\n  // Ad numbers CSV (patch-ads-csv)\n" + lines.join("\n") + s.slice(at), "utf8");
  console.log(`added ${lines.length} texts to ${p}`);
});
const p = "web/package.json";
let s = fs.readFileSync(p, "utf8");
if (s.includes('"test:ad-csv"')) console.log("already  " + p);
else {
  const out = s.replace('"test:ad-detail": "tsx scripts/test-ad-detail.ts",', '"test:ad-detail": "tsx scripts/test-ad-detail.ts",\n    "test:ad-csv": "tsx scripts/test-ad-csv.ts",').replace("&& npm run test:ad-detail\"", "&& npm run test:ad-detail && npm run test:ad-csv\"");
  if (out === s) throw new Error(p + ": add \"test:ad-csv\": \"tsx scripts/test-ad-csv.ts\" by hand");
  fs.writeFileSync(p, out, "utf8");
  console.log("changed  " + p);
}
console.log("Done. In web/: npm run test:ad-csv  npm run check:i18n  npm run lint  npm run build");
