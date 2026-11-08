// patch-social-appeal (SOCIAL_TODO 29): appeal of a removed Social post / reply.
// Run in the project folder (where PROJECT.md is):   node apply-social-appeal.mjs
// It edits 16 existing files (every edit is checked: if a piece of text is not found exactly once, it stops and says which).
// The list of edits is in social-appeal-edits.json (next to this file). Safe to run twice: a finished edit is skipped.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);
let problems = 0;

function read(file) {
  if (!fs.existsSync(file)) { console.log("MISSING FILE: " + file); problems++; return null; }
  return fs.readFileSync(file, "utf8");
}
function replaceOnce(file, from, to, marker) {
  const src = read(file);
  if (src === null) return;
  if (marker && src.includes(marker)) { console.log("skip (already done): " + path.relative(root, file) + "  [" + marker.slice(0, 50).replace(/\n/g, " ") + "]"); return; }
  const parts = src.split(from);
  if (parts.length !== 2) { console.log(`PROBLEM: in ${path.relative(root, file)} the text was found ${parts.length - 1} times (need exactly 1): ${JSON.stringify(from.slice(0, 70))}`); problems++; return; }
  fs.writeFileSync(file, parts[0] + to + parts[1]);
  console.log("edited: " + path.relative(root, file));
}

// 0. The new files must be there (they come from the zip)
for (const f of [
  "web/src/lib/social-appeal-rules.ts",
  "web/src/lib/social-appeal.ts",
  "web/src/app/(site)/appeal/social/actions.ts",
  "web/src/app/(site)/appeal/social/[kind]/[id]/page.tsx",
  "web/src/components/social/SocialAppealForm.tsx",
  "web/scripts/test-social-appeal.ts",
  "social-appeal-edits.json",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (did you unzip the patch here?): " + f); problems++; }
}
if (problems) { console.log(`\n${problems} problem(s). Nothing was changed.`); process.exit(1); }

// 1. Edits in existing code (appeals.ts, admin appeals screen, the two removal emails, the staff tool)
const edits = JSON.parse(fs.readFileSync(p("social-appeal-edits.json"), "utf8"));
for (const e of edits) replaceOnce(p(e.file), e.from, e.to, e.marker ?? undefined);

// 2. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-appeal"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-appeal"] = "tsx scripts/test-social-appeal.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 3. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-appeal", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"appeal.social.what.post"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 4. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-08\n",
  "## 2026-11-08\n- patch-social-appeal (SOCIAL_TODO 29: appeal of a removed Social post or reply): the author of a REMOVED Social post / reply can appeal ONCE, within `appealConfig.windowDays` (30) of the removal, on the new page `/appeal/social/post/<id>` or `/appeal/social/reply/<id>` (login only; somebody else's item or one that does not exist is \"not found\"). The removal email now ends with the appeal link (`email.socialappeal.line`). Filing: new `src/lib/social-appeal.ts` (`fileSocialAppeal`, `getSocialAppealView`, `loadRemovedSocial`) + pure `social-appeal-rules.ts` (`parseSocialKind`, addresses); \"may this person appeal\" is the SAME `checkFileContentAppeal` as for community posts (author only, REMOVED only, once, inside the window). Deciding is the existing `decideAppeal` in `appeals.ts`, extended: an admin who is NOT the author and took part in NO earlier step (hide, remove, restore of that item) accepts (the post / reply is VISIBLE again, the status fields are cleared) or rejects, always with a written note; one transaction with the `APPEAL_ACCEPTED` / `APPEAL_REJECTED` audit row (target SOCIAL_POST / SOCIAL_REPLY); the author is emailed (`email.appeal.social.*`). `/admin/appeals` lists these appeals (badge \"Content\", line \"A Social post / reply\", no community link); accepting also refreshes the feeds (`updateTag(\"social-posts\")`); `npm run appeals` shows them too. NO database change, no migration. 7 new texts in six languages. New test `npm run test:social-appeal` (no database). NOTE: the hider AND the remover are both excluded, so deciding a Social appeal needs at least THREE active admins; with only two the appeal stays open and the queue says \"you took part in the first decision\". Not done on purpose: a notice page for a removed Social post (SOCIAL_TODO C5: the author gets the link by email only), Social appeals in the public mod log, an appeal of a hidden (not yet removed) item, hiding a quote text.\n",
  "patch-social-appeal",
);
{
  const file = p("ACCOUNT_RULES.md");
  const src = read(file);
  if (src !== null) {
    if (src.includes("### 3.16 Appeal of a removed Social post")) console.log("skip (already done): ACCOUNT_RULES.md");
    else {
      fs.writeFileSync(file, src.replace(/\s*$/, "\n") + `
### 3.16 Appeal of a removed Social post or reply (SOCIAL_TODO 29, decided 2026-11-08, PROVISIONAL)
- Only the AUTHOR can appeal, only a REMOVED post / reply (a merely hidden one is still waiting for its second admin), once per removal, within the same window as community posts (\`appealConfig.windowDays\`, 30 days), with a written appeal of 20-2000 characters. The author finds the link in the removal email and on /appeal/social/post/<id> or /appeal/social/reply/<id>.
- An ADMIN decides (Social has no community moderators), and never the author, never the admin who hid it, never the admin who removed it (or restored it earlier). A written note is required. Accept = the item is visible again; reject = the removal stands, only the record changes. One audit-log row (APPEAL_ACCEPTED / APPEAL_REJECTED, target SOCIAL_POST / SOCIAL_REPLY) in the same transaction; the author is emailed.
- Consequence to know: because the hider and the remover are both excluded, a Social appeal can only be decided when at least THREE active admins exist. With two, the appeal waits (OVERDUE after \`appealConfig.dueDays\`) and the queue shows why. Open question: allow the remover (not the hider) to decide when fewer than three admins exist? Not decided; the stricter rule stays.
- Not decided yet: a notice page for a removed Social post (C5), Social decisions and appeals in the public mod log, appeal of a hidden item, hiding a quote text.
`);
      console.log("edited: ACCOUNT_RULES.md");
    }
  }
}

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s). Fix it (or send the message above) and run again.`);
process.exit(problems === 0 ? 0 : 1);
