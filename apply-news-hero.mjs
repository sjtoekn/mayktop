// Puts the PageHero banner on the News page (replaces the two title blocks). Safe to run twice; keeps a .bak copy.
// Run in web/:   node ../apply-news-hero.mjs        (or from the project folder: node apply-news-hero.mjs)
import fs from "node:fs";
import path from "node:path";

const candidates = ["src/app/(site)/news/page.tsx", "web/src/app/(site)/news/page.tsx"];
const file = candidates.map((c) => path.resolve(c)).find((c) => fs.existsSync(c));
if (!file) {
  console.log('PROBLEM: news page not found. Run this in web/ (where src/ is).');
  process.exit(1);
}
let src = fs.readFileSync(file, "utf8");
if (src.includes("<PageHero")) {
  console.log("Already done.");
  process.exit(0);
}

const headerRe = /[ \t]*<header className="card pg-head">[\s\S]*?<\/header>\n/g;
const count = (src.match(headerRe) ?? []).length;
if (count !== 2) {
  console.log(`PROBLEM: expected 2 title blocks, found ${count}. Nothing changed.`);
  process.exit(1);
}
const hero = '      <PageHero variant="news" parts={[t("news.hero.a"), t("news.hero.b"), t("news.hero.c")]} sub={t("news.hero.sub")} />\n';
src = src.replace(headerRe, hero);
src = src.replace('import Icon from "@/components/shell/Icon";\n', 'import Icon from "@/components/shell/Icon";\nimport PageHero from "@/components/PageHero";\nimport { t } from "@/i18n";\n');
if (!src.includes('import PageHero')) {
  console.log("PROBLEM: import line not found. Nothing changed.");
  process.exit(1);
}
fs.copyFileSync(file, file + ".bak");
fs.writeFileSync(file, src);
console.log("News page updated (backup: page.tsx.bak). All done.");
