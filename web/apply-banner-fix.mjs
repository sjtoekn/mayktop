// patch-banner-fix: the new home banner sentence is longer than the old three words, so its letters are made smaller
// and the text is kept clear of the picture. Only src/app/(site)/home.css changes.
//   node apply-banner-fix.mjs           -> only SHOWS what would change
//   node apply-banner-fix.mjs --apply   -> writes it (old file saved in .bannerfix-backup/)
//   node apply-banner-fix.mjs --undo    -> puts the old file back
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");
const BACKUP = ".bannerfix-backup";
if (!existsSync("package.json") || !existsSync("src/app/layout.tsx")) {
  console.error("Run this inside the web/ folder (package.json and src/app/layout.tsx must be here).");
  process.exit(1);
}

const newFiles = {};
const edits = [
 {
  "path": "src/app/(site)/home.css",
  "reps": [
   [
    ".ch-banner > div:first-child { position: relative; z-index: 1; }",
    ".ch-banner > div:first-child { position: relative; z-index: 1; box-sizing: border-box; padding-inline-end: 150px; } /* keeps the text clear of the picture on the right */"
   ],
   [
    ".ch-banner h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -1px; }",
    ".ch-banner h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -.5px; line-height: 1.2; text-wrap: balance; }"
   ],
   [
    ".ch-banner p { margin: 6px 0 0; font-size: 24px; }",
    ".ch-banner p { margin: 8px 0 0; font-size: 18px; line-height: 1.3; }"
   ],
   [
    "  .ch-banner h1 { font-size: 30px; }\n  .ch-banner p { font-size: 17px; }\n",
    "  .ch-banner h1 { font-size: 22px; }\n  .ch-banner p { font-size: 15px; }\n  .ch-banner > div:first-child { padding-inline-end: 0; }\n"
   ]
  ]
 }
];

if (undo) {
  if (!existsSync(BACKUP)) { console.error(`No ${BACKUP}/ folder: nothing to undo.`); process.exit(1); }
  for (const { path } of edits) {
    const saved = join(BACKUP, path);
    if (existsSync(saved)) { cpSync(saved, path); console.log(`RESTORED  ${path}`); }
  }
  for (const path of Object.keys(newFiles)) if (existsSync(path)) { rmSync(path); console.log(`REMOVED   ${path}`); }
  rmSync(BACKUP, { recursive: true, force: true });
  console.log("\nUndone. Run:  npm run build");
  process.exit(0);
}

if (!existsSync("src/app/(site)/home.css")) {
  console.error("src/app/(site)/home.css is missing: this is not the right folder.");
  process.exit(1);
}
if (apply && existsSync(BACKUP)) {
  console.error(`${BACKUP}/ already exists: an earlier run was not finished. Run --undo first, or delete that folder if the build passed.`);
  process.exit(1);
}

let problems = 0;
const say = (verb, p, note = "") => console.log(`${apply ? verb[0] : verb[1]}  ${p}${note ? "  - " + note : ""}`);

// Work out every edit first; write nothing unless ALL of them fit.
const plan = [];
for (const { path, reps } of edits) {
  if (!existsSync(path)) { console.log(`SKIPPED  ${path}  - file not found`); problems++; continue; }
  let text = readFileSync(path, "utf8");
  if (reps.every(([, to]) => text.includes(to))) { console.log(`(already done)  ${path}`); continue; }
  let ok = true;
  for (const [from, to] of reps) {
    if (text.includes(to)) continue;
    const count = text.split(from).length - 1;
    if (count !== 1) { console.log(`SKIPPED  ${path}  - expected text not found exactly once (the file was changed): ${from.split("\n")[0].slice(0, 70)}`); ok = false; break; }
    text = text.replace(from, () => to);
  }
  if (!ok) { problems++; continue; }
  plan.push({ path, text });
}
const toCreate = Object.entries(newFiles).filter(([p, c]) => {
  if (!existsSync(p)) return true;
  if (readFileSync(p, "utf8") !== c) { console.log(`SKIPPED  ${p}  - a different file is already there, check by hand`); problems++; }
  return false;
});

if (problems && apply) {
  console.log(`\n${problems} thing(s) need a look (see SKIPPED above). Nothing was written.`);
  process.exit(1);
}
for (const [p] of toCreate) say(["CREATED", "would create"], p);
for (const { path } of plan) say(["CHANGED", "would change"], path);

if (apply) {
  for (const { path } of plan) { mkdirSync(dirname(join(BACKUP, path)), { recursive: true }); cpSync(path, join(BACKUP, path)); }
  for (const [p, c] of toCreate) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
  for (const { path, text } of plan) writeFileSync(path, text);
  console.log("\nNow run:  npm run build && npm run start   (then look at http://localhost:3000/ )");
  console.log(`If the build passes, delete the backup:  rm -rf ${BACKUP} apply-banner-fix.mjs`);
  console.log("If the build complains, put everything back:  node apply-banner-fix.mjs --undo   (then send me the error)");
} else {
  console.log(problems ? `\n${problems} thing(s) need a look.` : "\nNothing was changed. Run again with --apply to do it.");
}
