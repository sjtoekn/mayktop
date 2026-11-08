// patch-social-27 (SOCIAL_TODO 27 + 30): Social moderation + Report.
// Run in the project folder (where PROJECT.md is):   node apply-social-27.mjs
// It edits 12 existing files (every edit is checked: if a piece of text is not found exactly once, it stops and says which).
// Safe to run twice: a finished edit is skipped.
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
  if (marker && src.includes(marker)) { console.log("skip (already done): " + path.relative(root, file) + "  [" + marker + "]"); return; }
  const parts = src.split(from);
  if (parts.length !== 2) { console.log(`PROBLEM: in ${path.relative(root, file)} the text was found ${parts.length - 1} times (need exactly 1): ${JSON.stringify(from.slice(0, 70))}`); problems++; return; }
  fs.writeFileSync(file, parts[0] + to + parts[1]);
  console.log("edited: " + path.relative(root, file));
}

// 1. Database model (then: npx prisma migrate dev --name social_moderation)
const schema = p("web/prisma/schema.prisma");
replaceOnce(schema, "  APPEAL\n  AD\n}", "  APPEAL\n  AD\n  SOCIAL_POST // a Social post (SOCIAL_TODO 27)\n}", "SOCIAL_POST // a Social post");
replaceOnce(
  schema,
  "  editedAt  DateTime?\n  deletedAt DateTime?\n\n  author  User @relation(fields: [authorId], references: [id], onDelete: Restrict)\n  likes   SocialPostLike[]\n  reposts SocialRepost[]\n",
  "  editedAt  DateTime?\n  deletedAt DateTime?\n  // Why the status is not VISIBLE (SOCIAL_TODO 27). Social moderation uses the SITE-WIDE rule keys (staffConfig.siteRules).\n  statusSiteRule  String?\n  statusNote      String?\n  statusChangedAt DateTime?\n\n  author  User @relation(fields: [authorId], references: [id], onDelete: Restrict)\n  likes   SocialPostLike[]\n  reposts SocialRepost[]\n  reports Report[]\n",
  "statusSiteRule  String?",
);
replaceOnce(
  schema,
  "  commentId      Int?\n  ruleId         Int? // which rule the reporter says was broken\n",
  "  commentId      Int?\n  socialPostId   Int? // a Social post (SOCIAL_TODO 30); then siteRule is the site-wide rule key the reporter chose\n  siteRule       String?\n  ruleId         Int? // which rule the reporter says was broken\n",
  "socialPostId   Int?",
);
replaceOnce(
  schema,
  "  comment    Comment?   @relation(fields: [commentId], references: [id], onDelete: Restrict)\n  rule       Rule?      @relation(fields: [ruleId], references: [id], onDelete: Restrict)\n",
  "  comment    Comment?   @relation(fields: [commentId], references: [id], onDelete: Restrict)\n  socialPost SocialPost? @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n  rule       Rule?      @relation(fields: [ruleId], references: [id], onDelete: Restrict)\n",
  "socialPost SocialPost? @relation(fields: [socialPostId]",
);
replaceOnce(
  schema,
  "  @@unique([reporterId, commentId])\n",
  "  @@unique([reporterId, commentId])\n  @@unique([reporterId, socialPostId])\n",
  "@@unique([reporterId, socialPostId])",
);

// 2. Numbers for Report (end of src/config/site.ts)
const site = p("web/src/config/site.ts");
{
  const src = read(site);
  if (src !== null) {
    if (src.includes("socialReportConfig")) console.log("skip (already done): web/src/config/site.ts");
    else {
      fs.writeFileSync(site, src.replace(/\s*$/, "\n") + `
// Report a Social post (SOCIAL_TODO 30). PROVISIONAL numbers. Counted in server memory (a shared limiter is TODO 50).
export const socialReportConfig = {
  minReason: 5, // the reporter's reason: at least this many characters
  maxReason: 500,
  reports: [
    { max: 10, windowSeconds: 60 },
    { max: 50, windowSeconds: 24 * 60 * 60 },
  ], // reports per person
};
`);
      console.log("edited: web/src/config/site.ts");
    }
  }
}

// 3. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-review"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-review"] = "tsx scripts/test-social-review.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 4. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-27", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.report.rule"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 5. Admin menu
replaceOnce(
  p("web/src/app/admin/layout.tsx"),
  '    { href: "/admin/review", label: t("admin.nav.review") },\n',
  '    { href: "/admin/review", label: t("admin.nav.review") },\n    { href: "/admin/social", label: t("admin.nav.social") },\n',
  '"/admin/social"',
);

// 6. Report button on the Social post card
const card = p("web/src/components/social/SocialPostCard.tsx");
replaceOnce(
  card,
  'import SocialRepostButton from "@/components/social/SocialRepostButton";\n',
  'import SocialRepostButton from "@/components/social/SocialRepostButton";\nimport SocialReportButton from "@/components/social/SocialReportButton";\nimport { socialReportConfig, staffConfig } from "@/config/site";\nimport type { MessageKey } from "@/i18n/messages/en";\n',
  "SocialReportButton",
);
replaceOnce(
  card,
  '          <span className="sp-label">{t("social.label")}</span>\n',
  `          {canFollow && (
            <SocialReportButton
              postId={post.id}
              rules={staffConfig.siteRules.map((rule) => ({ key: rule.key, label: t(\`siteRule.\${rule.key}\` as MessageKey) }))}
              limits={{ min: socialReportConfig.minReason, max: socialReportConfig.maxReason }}
              text={{
                report: t("social.report"),
                rule: t("social.report.rule"),
                reason: t("social.report.reason"),
                submit: t("social.report.submit"),
                cancel: t("social.report.cancel"),
                sending: t("social.report.sending"),
                done: t("social.report.done"),
                already: t("social.report.already"),
                login: t("social.report.login"),
                tooMany: t("social.report.toomany"),
                invalid: t("social.report.invalid"),
                error: t("social.report.error"),
              }}
            />
          )}
          <span className="sp-label">{t("social.label")}</span>
`,
  "<SocialReportButton\n",
);

// 7. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-07\n",
  "## 2026-11-07\n- patch-social-27 (SOCIAL_TODO 27 + 30: Social moderation and Report): new `/admin/social` (menu item \"Social\"). A person can REPORT somebody else's Social post (`SocialReportButton.tsx`, server action `reportSocialPost` in `social/report/actions.ts`: login required, `socialReportConfig.reports` = 10 per minute and 50 per 24 hours in server memory; rules in `social-report.ts`: only a post that may be shown, not your own, ONE report per person per post, a SITE rule key and a reason of 5-500 characters). A report hides nothing: it goes into the admin queue. Admins (admins only, PROJECT.md 8j.9) then: HIDE a reported post for review (site rule + written reason; leaves the feeds; author emailed; open reports become IN_REVIEW), DISMISS the open reports of a post that stays visible (written note), and a DIFFERENT admin RESTORES or REMOVES a hidden post (written note; reports become DISMISSED / ACTIONED; author emailed). Rules in `social-review-rules.ts` (pure), work in `social-review.ts` (`hideSocialPost`, `decideSocialReview`, `dismissSocialReports`, `loadSocialQueue`), same steps as `review.ts` for community posts. Every step writes ONE audit-log row in the same transaction (`targetType` new value `SOCIAL_POST`, `siteRule` = the site rule key). DATABASE CHANGE: `SocialPost.statusSiteRule / statusNote / statusChangedAt`, `Report.socialPostId / siteRule` + unique (reporterId, socialPostId), `AuditTarget.SOCIAL_POST`: run `npx prisma migrate dev --name social_moderation`. 35 new texts in six languages. New test `npm run test:social-review` (no database). Not done on purpose: appeal (item 29), the removal notice on `/social/<id>` (item 28; a hidden or removed post is still \"not found\"), hiding a QUOTE text (needs a status column on `SocialRepost`), Social rows in the public mod log (they do not show there: it only reads community posts and comments), Social count in the admin overview. SOCIAL_TODO 27 and 30 are ticked once lint, build, the test and the manual check pass on your machine.\n",
  "patch-social-27 (SOCIAL_TODO 27 + 30",
);
{
  const file = p("ACCOUNT_RULES.md");
  const src = read(file);
  if (src !== null) {
    if (src.includes("### 3.11 Social moderation")) console.log("skip (already done): ACCOUNT_RULES.md");
    else {
      fs.writeFileSync(file, src.replace(/\s*$/, "\n") + `
### 3.11 Social moderation and Report (SOCIAL_TODO 27 + 30, decided 2026-11-07, PROVISIONAL)
- Anyone logged in can report a Social post of somebody else, once per post, with a site rule and a short reason. The author is never told who reported. A report alone never hides anything and never counts against the author.
- Hiding, restoring and removing a Social post is done by ADMINS ONLY (PROJECT.md 8j.9): one admin hides (site rule + written reason), a DIFFERENT admin decides (restore or remove, written note). Nobody acts on their own post. Every step is one audit-log row, written in the same transaction as the change.
- A hidden or removed post is not shown in any feed. Nothing is erased by hiding or removing; the author can still delete their own post only while it is visible (SOCIAL_TODO 13).
- Not decided yet: appeal of a removal (SOCIAL_TODO 29), the notice the author sees (28), whether Social removals appear in the public moderation log.
`);
      console.log("edited: ACCOUNT_RULES.md");
    }
  }
}

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s). Nothing else was changed after a problem; fix it (or send the message above) and run again.`);
process.exit(problems === 0 ? 0 : 1);
