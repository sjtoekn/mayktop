// Puts the "views" texts (social.views.one / .other / .title ...) back into the six language files. Safe to run twice.
// Run in the project folder (where PROJECT.md is):   node fix-social-views-texts.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(root, "web/src/i18n/messages");
const T = {
  en: { one: "{n} view", other: "{n} views", title: "How many times this post was seen" },
  es: { one: "{n} visualización", other: "{n} visualizaciones", title: "Cuántas veces se ha visto esta publicación" },
  fr: { one: "{n} vue", other: "{n} vues", title: "Nombre de fois où cette publication a été vue" },
  hi: { one: "{n} बार देखा गया", other: "{n} बार देखा गया", title: "इस पोस्ट को कितनी बार देखा गया" },
  zh: { other: "{n} 次浏览", title: "此帖子被查看的次数" },
  ar: { zero: "لا مشاهدات", one: "مشاهدة واحدة", two: "مشاهدتان", few: "{n} مشاهدات", many: "{n} مشاهدة", other: "{n} مشاهدة", title: "عدد مرات مشاهدة هذا المنشور" },
};

let failed = false;
for (const [lang, v] of Object.entries(T)) {
  const file = path.join(dir, `${lang}.ts`);
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"social.views.title"')) {
    console.log(`${lang}: already there`);
    continue;
  }
  const lines = src.split("\n");
  // after the last text line of the block above (any "social.*" line is fine as an anchor; use the last "social.link.open" or "news.hero.sub")
  let at = lines.findIndex((l) => l.startsWith('  "news.hero.sub"'));
  if (at < 0) at = lines.findIndex((l) => l.startsWith('  "social.link.open"'));
  if (at < 0) {
    console.log(`${lang}: PROBLEM no anchor line found`);
    failed = true;
    continue;
  }
  const add = ["  // View counts of Social posts (restored)"];
  for (const [form, text] of Object.entries(v)) add.push(`  ${JSON.stringify(form === "title" ? "social.views.title" : `social.views.${form}`)}: ${JSON.stringify(text)},`);
  lines.splice(at + 1, 0, ...add);
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`${lang}: added`);
}
console.log(failed ? "Some files need a look." : "All done.");
process.exit(failed ? 1 : 0);
