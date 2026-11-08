// patch-social-17-finish: the part of patch-social-17 that never ran (apply-social-17.mjs was not in the project folder).
// The code of the Following feed is already in your project; this adds what it needs: 8 texts in six languages, the style
// of the "All | Following" tabs, the npm script and the CHANGELOG line.
// Run in the project folder (where PROJECT.md is):   node apply-social-17-finish.mjs      Safe to run twice.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const p = (...x) => path.join(root, ...x);
let problems = 0;
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : (console.log("MISSING FILE: " + path.relative(root, f)), problems++, null));

for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.tabs.label"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + fs.readFileSync(p("i18n-social-17", lang + ".txt"), "utf8") + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

const css = p("web/src/app/content.css");
{
  const src = read(css);
  if (src !== null) {
    if (src.includes(".sp-tabs")) console.log("skip (already done): content.css");
    else {
      fs.writeFileSync(css, src.replace(/\s*$/, "\n") + `
/* "All | Following" tabs under the Social title (SOCIAL_TODO 17) */
.sp-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.sp-tab { padding: 6px 16px; border: 1px solid var(--line); border-radius: var(--radius-full); color: var(--ink); font-weight: 600; text-decoration: none; }
.sp-tab:hover { background: var(--brandsoft); }
.sp-tab.is-active { background: var(--brand); border-color: var(--brand); color: var(--onbrand); }
`);
      console.log("edited: web/src/app/content.css");
    }
  }
}

{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-following"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-following"] = "tsx scripts/test-social-following.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

{
  const file = p("CHANGELOG.md");
  const src = read(file);
  const line = "- patch-social-17 (SOCIAL_TODO 17: Following feed): new page `/social/following` (posts and reposts of the people you follow and your own, newest first, never by popularity; login only; not cached) with the tabs \"All | Following\" on `/social` (`SocialFeedTabs.tsx`, `SocialFeedList.tsx`, `social-following.ts`, `getFollowingFeed` in `queries.ts`). 8 texts in six languages, tab style in `content.css`, npm script `test:social-following`. No database change. Finished with `apply-social-17-finish.mjs` because the original apply script was not in the project folder. SOCIAL_TODO 17 is ticked once lint, build, the test and the manual check pass.\n";
  if (src !== null) {
    if (src.includes("patch-social-17 (SOCIAL_TODO 17")) console.log("skip (already done): CHANGELOG.md");
    else if (!src.includes("## 2026-11-07\n")) { console.log("PROBLEM: heading \"## 2026-11-07\" not found in CHANGELOG.md"); problems++; }
    else { fs.writeFileSync(file, src.replace("## 2026-11-07\n", "## 2026-11-07\n" + line)); console.log("edited: CHANGELOG.md"); }
  }
}
console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s).`);
process.exit(problems === 0 ? 0 : 1);
