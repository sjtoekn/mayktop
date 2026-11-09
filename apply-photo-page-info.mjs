// apply-photo-page-info.mjs: adds the texts (6 languages) and the npm script of patch-photos-page-info.
// Run in the project folder (where PROJECT.md is):   node apply-photo-page-info.mjs
// Safe to run twice: a text that is already there is skipped. The other files of the patch were already unzipped.
import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
const js = (x) => '"' + x.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
let problems = 0;

const { keys, texts } = JSON.parse(read("photo-page-texts.json"));
for (const lang of ["en", "es", "fr", "hi", "zh", "ar"]) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`PROBLEM ${file} not found`); problems++; continue; }
  let s = read(file);
  const end = lang === "en" ? "} as const;\n\nexport default" : "};\n\nexport default";
  const i = s.lastIndexOf(end);
  if (i < 0) { console.log(`PROBLEM ${file}: end of the list not found (send me this file)`); problems++; continue; }
  const add = keys.filter((k) => k in texts[lang] && !s.includes(`"${k}":`)).map((k) => `  "${k}": ${js(texts[lang][k])},\n`).join("");
  if (!add) { console.log(`SKIP  ${file} (already done)`); continue; }
  s = s.slice(0, i) + add + s.slice(i);
  fs.writeFileSync(file, s);
  console.log(`updated  ${file}`);
}

const pkgFile = "web/package.json";
const pkg = JSON.parse(read(pkgFile));
if (pkg.scripts["test:photo-page"]) console.log("SKIP  package.json (already done)");
else {
  pkg.scripts["test:photo-page"] = "tsx scripts/test-photo-page.ts";
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");
  console.log("updated  web/package.json");
}
console.log(problems ? `\n${problems} problem(s): send me the lines above.` : "\nAll done. Next: cd web && npm run test:photo-page && npm run test:photo-detail && npm run check:i18n && npm run build");
process.exit(problems ? 1 : 0);
