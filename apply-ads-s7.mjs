// patch-ads-s7 (ADS_PLAN Session 7: finish). Documents + two npm scripts only; NO database change, NO app code change.
// Shared files are changed only through small edits (Rule 6 of ADS_PLAN.md). Safe to run twice. Make a backup zip first.
// Run in the project folder (where PROJECT.md is), AFTER copying the patch files.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (f) => fs.readFileSync(f, "utf8");
const write = (f, s) => fs.writeFileSync(f, s);
const stop = (m) => { console.error("STOP: " + m); process.exit(1); };
let problems = 0;
const problem = (m) => { console.log("PROBLEM: " + m); problems++; };

if (!fs.existsSync(path.join(root, "web/scripts/check-i18n.ts"))) stop("copy the patch files first (web/scripts/check-i18n.ts is missing).");
if (!fs.existsSync(path.join(root, "web/src/lib/ad-notices.ts"))) stop("install patch-ads-s4c first, and run this in the project folder (where PROJECT.md is).");

// exact-text edit, once
function edit(file, label, done, from, to) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { problem(`${file}: not found (${label})`); return; }
  const s = read(full);
  if (done(s)) { console.log(`${file}: already done (${label})`); return; }
  const n = s.split(from).length - 1;
  if (n !== 1) { problem(`${file}: ${label}: expected 1 place, found ${n} (nothing changed there)`); return; }
  write(full, s.replace(from, () => to));
  console.log(`${file}: ${label} done`);
}
// tick one "- [ ] <start of line>" line of a markdown list and add a note at its end
function tick(file, label, start, note) {
  const full = path.join(root, file);
  const s = read(full);
  const lines = s.split("\n");
  const i = lines.findIndex((l) => l.startsWith("- [ ] " + start) || l.startsWith("- [x] " + start));
  if (i < 0) { problem(`${file}: ${label}: line starting "${start}" not found`); return; }
  if (lines[i].startsWith("- [x] ")) { console.log(`${file}: already done (${label})`); return; }
  lines[i] = "- [x] " + lines[i].slice(6) + (note ? " " + note : "");
  write(full, lines.join("\n"));
  console.log(`${file}: ${label} done`);
}
function note(file, label, start, text) { // add a note to a line without ticking it
  const full = path.join(root, file);
  const lines = read(full).split("\n");
  const i = lines.findIndex((l) => l.startsWith("- [ ] " + start));
  if (i < 0) { console.log(`${file}: ${label}: line not found or already ticked`); return; }
  if (lines[i].includes(text)) { console.log(`${file}: already done (${label})`); return; }
  lines[i] += " " + text;
  write(full, lines.join("\n"));
  console.log(`${file}: ${label} done`);
}

// ------------------------------------------------------------------ package.json (two scripts)
edit("web/package.json", "scripts test:ads + check:i18n", (s) => s.includes('"test:ads"'),
  '    "test:ad-appeal": "tsx scripts/test-ad-appeal.ts",\n',
  '    "test:ad-appeal": "tsx scripts/test-ad-appeal.ts",\n    "test:ads": "npm run test:ad-input && npm run test:ad-media && npm run test:ad-own && npm run test:ad-appeal && npm run test:ad-review",\n    "check:i18n": "tsx scripts/check-i18n.ts",\n');

// ------------------------------------------------------------------ ADS_PLAN.md
const A = "ADS_PLAN.md";
tick(A, "S5 review page", "Review page for admin role", "(built in patch-admin8: `/admin/ads`, `ad-review.ts`)");
tick(A, "S5 approve / reject", "Approve / reject with required rule + reason", "(patch-admin8)");
tick(A, "S5 not own ad + appeal", "Reviewer cannot review their own ad", "(patch-admin8 for the review; the appeal to a different admin is patch-ads-s4c)");
tick(A, "S5 mod log decision", "Ad decisions visible in public mod log?", "DECIDED in Session 7 (2026-11-07): NO, not in v1. The public mod log is about community content (post / comment, community, moderator). An ad rejection is a private matter between us and one advertiser, and the advertiser already sees the rule + written reason, can appeal, and every decision is in the audit log. Revisit if advertisers or the public ask for it (it would need a separate \"ad decisions\" list with no advertiser contact data).");
tick(A, "S6 paid + start", "Admin marks \"paid\" and sets start date", "(patch-admin8)");
tick(A, "S6 auto-end", "Auto-END after end date", "(patch-admin8: checked when the admin Ads screen is read)");
tick(A, "S6 email notices", "Contact email for advertiser notices", "(approved / rejected / running: patch-admin8; ending soon: patch-ads-s4c)");
note(A, "S6 running count", "(Removed: no cap on ads per slot.", "NOT built (Session 7): the honest rotation notice is on `/advertise` and in the \"running\" email, and `/advertise/my` shows each ad's real totals; a live \"N ads running now\" number is optional and moves to TODO 46 (advertiser dashboard).");
note(A, "S7 build + lint", "`npm run build` + `npm run lint` clean", "Session 7 could not run them (the build chat has no installed packages): the owner runs the commands in `README-patch-ads-s7.txt` and ticks this line. Logic tests (`npm run test:ads`) and `npm run check:i18n` passed in the build chat.");
tick(A, "S7 six languages", "All new texts in six languages", "(checked in Session 7 by the new `npm run check:i18n`: 0 missing, 0 extra, every `t(\"...\")` key used in the code exists)");
tick(A, "S7 documents", "Update `TODO.md`", "(patch-ads-s7)");
tick(A, "S7 note for 51", "Note for TODO 51", "(written into the TODO 51 line of TODO.md)");
edit(A, "status line", (s) => s.includes("Session 7 done in part"),
  "Next: Session 7 (finish). Still open and NOT part of Session 7: batch counter writes (TODO 50), disk space + backup of `web/storage/ads/` (TODO 56), whether ad decisions appear on the public mod log (decide in Session 7), social ads (Session S, later).",
  "Session 7 done in part (patch-ads-s7: documents, `npm run test:ads`, `npm run check:i18n`; decision: ad decisions are NOT on the public mod log in v1). STILL TO DO by the owner: `npm run build`, `npm run lint` and the manual flow of `README-patch-ads-s7.txt` (text, image and video ad from submit to visible); then tick that line. TODO 44 is ticked in `TODO.md` with this note. Still open and NOT part of the ad system v1: batch counter writes (TODO 50), disk space + backup of `web/storage/ads/` (TODO 56), a live \"N ads running\" number (TODO 46), billing / refunds (TODO 46), social ads (Session S, later).");

// ------------------------------------------------------------------ TODO.md
edit("TODO.md", "44 ticked", (s) => s.includes("[x] 44. Ad system"),
  "[ ] 44. Ad system: submit form, review queue, approve/reject, campaigns, budget, \"Ad\" ලේබලය, frequency limits",
  "[x] 44. Ad system: submit form, review queue, approve/reject, campaigns, budget, \"Ad\" ලේබලය, frequency limits [2026-11-07 patch-ads-s7: කේතය අවසන් (ADS_PLAN.md Sessions 1-7). advertiser: `/advertise`, `/advertise/new` (text / පින්තූර / වීඩියෝ දැන්වීම්, අපේම storage එකේ), `/advertise/my` (තත්ත්වය, සංඛ්‍යා, pause / run again, end, rejected එකක් edit + නැවත යැවීම, appeal). admin: `/admin/ads` (approve / reject + නීතිය + හේතුව, paid ලකුණු කිරීම, ස්වයංක්‍රීය END), `/admin/appeals` (kind \"Ad\"). \"frequency limits\" වෙනුවට අර්ථය වෙනස් විය: සමාන වටයක් (fair rotation) + පැයක් තුළ එකම දැන්වීම නැවත නොපෙන්වීම (බ්‍රවුසරය තුළ පමණක්, අවසර සහිතව) + feed එකේ පිටුවකට දැන්වීම් 2ක් උපරිම. visitor දත්ත කිසිවක් ගබඩා නොකරයි (දිනකට දැන්වීමකට එකතුව පමණි). public mod log එකේ දැන්වීම් තීරණ පෙන්වන්නේ නැත (තීරණය: ADS_PLAN.md). `npm run test:ads` සහ `npm run check:i18n` සමත්. අත්පරීක්ෂාව + `npm run build` + `npm run lint` තවම ඉතිරියි (README-patch-ads-s7.txt). ඉතිරි වෙනම අයිතම: 45 (batch writes, bot), 46 (billing, refunds, live ads count), 56 (storage backup), Session S (social ads)]");
edit("TODO.md", "51 note", (s) => s.includes("[ADS 7:"),
  "[ ] 51. Privacy policy, Terms, Content policy (නීතිඥ සමාලෝචනය අවශ්‍යයි)",
  "[ ] 51. Privacy policy, Terms, Content policy (නීතිඥ සමාලෝචනය අවශ්‍යයි) [ADS 7: privacy policy එකේ පැහැදිලිව ලිවිය යුතුයි: \"දැන්වීම් සඳහා අමුත්තන්ගෙන් කිසිදු දත්තයක් (user id, IP, cookie) ගබඩා නොකරයි; දැන්වීමකට දිනකට දැක්ම / click ගණන් එකතුව පමණි; අවසර ලැබුණොත් පමණක් පැයක් තුළ එකම දැන්වීම නැවත නොපෙන්වීමට අමුත්තාගේ ම උපාංගයේ සටහනක් තබයි, එය server එකට නොයැවේ; Global Privacy Control ඇත්නම් එය කිසි විටෙක භාවිත නොකරයි\". දැන්වීම්කරුගේ දත්ත: ගිණුම, සම්බන්ධ email, දැන්වීම, ගෙවීම් තත්ත්වය පමණි (ගිණුම මැකූ විට email මැකේ). නීතිඥයා විසින් සමාලෝචනය කළ යුතුයි; ඊට පෙර අඩවිය පොදුවට විවෘත නොකරන්න]");

// ------------------------------------------------------------------ PROJECT.md
edit("PROJECT.md", "Phase 1 demo ad slots", (s) => s.includes("- [x] Demo ad slots"),
  "- [ ] Demo ad slots (sidebar + limited feed slots, clearly labelled \"Ad\")",
  "- [x] Demo ad slots (sidebar + limited feed slots, clearly labelled \"Ad\") — now real ads (TODO 44, section 8i)");
edit("PROJECT.md", "Phase 4 ad system", (s) => s.includes("- [x] Ad system: submission form"),
  "- [ ] Ad system: submission form, review queue, approve/reject, campaigns and\n      budget, \"Ad\" labelling, frequency limits",
  "- [x] Ad system: submission form, review queue, approve/reject, campaigns and\n      budget, \"Ad\" labelling, frequency limits (built 2026-11-07, ADS_PLAN.md Sessions 1-7. \"Frequency limits\"\n      became: fair rotation of all running ads + no repeat within an hour on the visitor's own device,\n      consent-gated; max 2 ads in a feed page. Build + lint + manual flow still to be run by the owner.)");
edit("PROJECT.md", "8i item 7", (s) => s.includes("7. **Decided in Session 7"),
  "**Not built yet:** the slot `SOCIAL_FEED` (added to `AdSlotType` when the Social feed is built).",
  "**Not built yet:** the slot `SOCIAL_FEED` (added to `AdSlotType` when the Social feed is built).\n7. **Decided in Session 7 (2026-11-07):** (a) Ad decisions are NOT shown on the public mod log in v1. The mod log is about community content; an ad rejection is between us and one advertiser, who sees the rule + written reason, can appeal, and every decision is in the audit log. Revisit if asked (it would be a separate list without advertiser contact data). (b) The privacy policy (TODO 51) must say: no visitor data is collected for ads (no user id, IP or cookie; only per-ad per-day totals; the optional one-hour memory stays on the visitor's own device, only after the visitor allows it, never with Global Privacy Control); advertiser data is the account link, contact email, the ad and the payment status. A lawyer must review it before the site opens. (c) Still open for the ad system: batch counter writes (TODO 50), disk space and backup of `web/storage/ads/` (TODO 56), billing, refunds and a live \"N ads running\" number (TODO 46).");

// ------------------------------------------------------------------ DATABASE.md
edit("DATABASE.md", "ad audit actions list", (s) => s.includes("`AD_PAID`"),
  "(`AD_APPROVED`, `AD_REJECTED`, `AD_PAUSED`, `AD_RESTORED`;",
  "(`AD_APPROVED`, `AD_REJECTED`, `AD_PAUSED`, `AD_RESTORED`, `AD_PAID`, `AD_ENDED`, `AD_RESUBMITTED`;");
edit("DATABASE.md", "ad files + decision note", (s) => s.includes("Ad files and backup (Session 7)"),
  "## Ad formats (ADS_PLAN Session 3, migration `ad_formats`)",
  "## Ad files and backup (Session 7)\nPictures and videos of ads are NOT in the database: they are files in `web/storage/ads/` (outside `public/`). A database backup alone loses them: back up the database AND that folder together (production plan: TODO 56). Ad decisions are not on the public mod log in v1 (they are only in `AuditLog`, shown to the advertiser and the admins).\n\n## Ad formats (ADS_PLAN Session 3, migration `ad_formats`)");

// ------------------------------------------------------------------ DESIGN.md
edit("DESIGN.md", "ad media box", (s) => s.includes("`.ad-media`"),
  "5. **Cards:** `.card` for posts, comments and boxes. Ads use `.card-ad` and always show the `Ad` badge.",
  "5. **Cards:** `.card` for posts, comments and boxes. Ads use `.card-ad` and always show the `Ad` badge. A picture or video of an ad sits in `.ad-media` (`components/ad-media.css`): a fixed 16:9 box (no layout shift), the whole picture shown, never cropped; a video shows its poster and never autoplays.");

// ------------------------------------------------------------------ CHANGELOG.md
{
  const f = path.join(root, "CHANGELOG.md");
  const s = read(f);
  if (s.includes("patch-ads-s7")) console.log("CHANGELOG.md: already done");
  else {
    const line = "- patch-ads-s7 (TODO 44, ADS_PLAN Session 7, finish): documents and checks only, no app code and no database change. New `npm run test:ads` (runs all five ad logic tests: input, media, own, appeal, review) and `npm run check:i18n` (every text exists in all six languages, every `t(\"key\")` used in the code exists). TODO 44 ticked; the meaning of \"frequency limits\" is written down (fair rotation, one-hour no-repeat on the visitor's own device, max 2 feed ads). Decision: ad decisions are NOT shown on the public mod log in v1. Note for TODO 51 (privacy policy: no visitor data collected for ads). ADS_PLAN.md, PROJECT.md (8i item 7, Phase 1 + Phase 4 ticks), DATABASE.md (ad audit actions, ad files backup note), DESIGN.md (`.ad-media`) updated. `npm run build`, `npm run lint` and the manual flow are still to be run on the owner's machine (README-patch-ads-s7.txt).";
    if (!/## 2026-11-07\n/.test(s)) problem("CHANGELOG.md: heading '## 2026-11-07' not found");
    else { write(f, s.replace(/(## 2026-11-07\n)/, (m) => m + line + "\n")); console.log("CHANGELOG.md: done"); }
  }
}

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): read the lines marked PROBLEM above. Nothing else was damaged; fix by hand or ask for help.`);
process.exit(problems === 0 ? 0 : 1);
