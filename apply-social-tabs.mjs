// Puts the Community / Social / News tabs under the hero on /social and /social/following. Safe to run twice; keeps .bak copies.
// Run in web/:   node ../apply-social-tabs.mjs
import fs from "node:fs";
import path from "node:path";

const tabs = path.resolve("src/components/feed/FeedTypeTabs.tsx");
if (!fs.existsSync(tabs)) {
  console.log("PROBLEM: src/components/feed/FeedTypeTabs.tsx not found. Run this in web/. Nothing changed.");
  process.exit(1);
}
if (!/["']social["']/.test(fs.readFileSync(tabs, "utf8"))) {
  console.log('PROBLEM: FeedTypeTabs has no "social" value. Send me that file. Nothing changed.');
  process.exit(1);
}

const pages = ["src/app/(site)/social/page.tsx", "src/app/(site)/social/following/page.tsx"].map((p) => path.resolve(p));
const heroRe = /^([ \t]*<PageHero variant="social"[^\n]*\/>\n)/m;
let problems = 0;
for (const file of pages) {
  const name = path.relative(process.cwd(), file);
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("<FeedTypeTabs")) { console.log(`${name}: already there`); continue; }
  if (!heroRe.test(src) || !src.includes('import PageHero from "@/components/PageHero";\n')) {
    console.log(`${name}: PROBLEM hero line not found. Nothing changed in this file.`);
    problems++;
    continue;
  }
  src = src.replace(heroRe, '$1\n      <FeedTypeTabs active="social" />\n');
  src = src.replace('import PageHero from "@/components/PageHero";\n', 'import PageHero from "@/components/PageHero";\nimport FeedTypeTabs from "@/components/feed/FeedTypeTabs";\n');
  fs.copyFileSync(file, file + ".bak");
  fs.writeFileSync(file, src);
  console.log(`${name}: tabs added (backup .bak)`);
}
console.log(problems ? "Some files need a look." : "All done.");
process.exit(problems ? 1 : 0);
