// PHOTO layout patch: adds the 4 texts of the right-hand "Details" panel (photo.side.*) to the 6 language files. Safe to run twice.
// Run from the project folder (where PHOTO_TODO.md is): node apply-photo-layout.mjs
import fs from "node:fs";

const TEXTS = {
  en: { title: "Details", views: "Views", visibility: "Visibility", everyone: "Everyone" },
  es: { title: "Detalles", views: "Vistas", visibility: "Visibilidad", everyone: "Todos" },
  fr: { title: "Détails", views: "Vues", visibility: "Visibilité", everyone: "Tout le monde" },
  hi: { title: "विवरण", views: "व्यू", visibility: "दृश्यता", everyone: "सभी" },
  zh: { title: "详情", views: "浏览量", visibility: "可见性", everyone: "所有人" },
  ar: { title: "التفاصيل", views: "المشاهدات", visibility: "الظهور", everyone: "الجميع" },
};

const ANCHOR = /^  "photo\.visibility\.public":.*\n/m;
let problems = 0;
for (const [lang, x] of Object.entries(TEXTS)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`MISSING  ${file}`); problems++; continue; }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"photo.side.title"')) { console.log(`skip     ${file} (already has the texts)`); continue; }
  const match = src.match(ANCHOR);
  if (!match) { console.log(`NO ANCHOR  ${file}: line "photo.visibility.public" not found, nothing changed`); problems++; continue; }
  const lines = Object.entries(x).map(([key, value]) => `  "photo.side.${key}": ${JSON.stringify(value)},`).join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  console.log(`updated  ${file}`);
}
process.exit(problems ? 1 : 0);
