// patch-social-report-more (SOCIAL_TODO A8 + A9): Report a Social REPLY and a Social ACCOUNT, and moderate replies.
// Run in the project folder (where PROJECT.md is):   node apply-social-report-more.mjs
// It edits 14 existing files (every edit is checked: if a piece of text is not found exactly once, it stops and says which).
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

// 1. Database model (then: npx prisma migrate dev --name social_report_more)
const schema = p("web/prisma/schema.prisma");
replaceOnce(
  schema,
  "  SOCIAL_POST // a Social post (SOCIAL_TODO 27)\n}",
  "  SOCIAL_POST // a Social post (SOCIAL_TODO 27)\n  SOCIAL_REPLY // a Social reply (patch-social-report-more)\n}",
  "SOCIAL_REPLY //",
);
replaceOnce(
  schema,
  "  deletedAt    DateTime?\n\n  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n  author     User       @relation(fields: [authorId], references: [id], onDelete: Restrict)\n\n  @@index([socialPostId, createdAt])",
  "  deletedAt    DateTime?\n  // Why the status is not VISIBLE (patch-social-report-more). Same idea as SocialPost: SITE-WIDE rule keys (staffConfig.siteRules).\n  statusSiteRule  String?\n  statusNote      String?\n  statusChangedAt DateTime?\n\n  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n  author     User       @relation(fields: [authorId], references: [id], onDelete: Restrict)\n  reports    Report[]\n\n  @@index([socialPostId, createdAt])",
  "  reports    Report[]\n\n  @@index([socialPostId, createdAt])",
);
replaceOnce(
  schema,
  "  siteRule       String?\n  ruleId         Int? // which rule the reporter says was broken\n",
  "  siteRule       String?\n  socialReplyId  Int? // a Social reply (patch-social-report-more); siteRule is the site-wide rule key the reporter chose\n  reportedUserId String? // a Social account (patch-social-report-more); siteRule as above. Nothing is hidden by such a report\n  ruleId         Int? // which rule the reporter says was broken\n",
  "socialReplyId  Int?",
);
replaceOnce(
  schema,
  "  socialPost SocialPost? @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n",
  "  socialPost SocialPost? @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n  socialReply SocialReply? @relation(fields: [socialReplyId], references: [id], onDelete: Restrict)\n  reportedUser User?     @relation(\"ReportTarget\", fields: [reportedUserId], references: [id], onDelete: Restrict)\n",
  "socialReply SocialReply? @relation(",
);
replaceOnce(
  schema,
  "  @@unique([reporterId, socialPostId])\n",
  "  @@unique([reporterId, socialPostId])\n  @@unique([reporterId, socialReplyId])\n  @@unique([reporterId, reportedUserId])\n",
  "@@unique([reporterId, socialReplyId])",
);
replaceOnce(
  schema,
  '  reportsResolved    Report[]      @relation("ReportResolver")\n',
  '  reportsResolved    Report[]      @relation("ReportResolver")\n  reportsAgainst     Report[]      @relation("ReportTarget")\n',
  '@relation("ReportTarget")\n  appealsMade',
);

// 2. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-report-more"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-report-more"] = "tsx scripts/test-social-report-more.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 3. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-report-more", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.report.account"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 4. Report button under every reply of somebody else
const list = p("web/src/components/social/SocialReplyList.tsx");
replaceOnce(
  list,
  'import SocialReplyForm from "@/components/social/SocialReplyForm";\n',
  'import SocialReplyForm from "@/components/social/SocialReplyForm";\nimport SocialReportMore from "@/components/social/SocialReportMore";\nimport { socialReportMoreProps } from "@/components/social/socialReportMoreProps";\n',
  "SocialReportMore",
);
replaceOnce(
  list,
  "                {reply.author === viewer && (\n                  <SocialReplyDelete\n",
  '                {reply.author !== viewer && <SocialReportMore target={{ kind: "reply", id: reply.id }} {...socialReportMoreProps("reply")} />}\n                {reply.author === viewer && (\n                  <SocialReplyDelete\n',
  "<SocialReportMore target",
);

// 5. Report button on somebody else's Social profile
const profile = p("web/src/app/(site)/social/u/[username]/page.tsx");
replaceOnce(
  profile,
  'import SocialProfileTabs from "@/components/social/SocialProfileTabs";\n',
  'import SocialProfileTabs from "@/components/social/SocialProfileTabs";\nimport SocialReportMore from "@/components/social/SocialReportMore";\nimport { socialReportMoreProps } from "@/components/social/socialReportMoreProps";\n',
  "SocialReportMore",
);
replaceOnce(
  profile,
  "              }}\n            />\n          </div>\n        )}\n        <SocialProfileTabs",
  '              }}\n            />\n            <SocialReportMore target={{ kind: "account", username: profile.username }} {...socialReportMoreProps("account")} />\n          </div>\n        )}\n        <SocialProfileTabs',
  "<SocialReportMore target",
);

// 6. The admin page shows the new queues under the post queues
const admin = p("web/src/app/admin/social/page.tsx");
replaceOnce(
  admin,
  'import SocialModerationBox, { type SocialModerationText } from "@/components/admin/SocialModerationBox";\n',
  'import SocialModerationBox, { type SocialModerationText } from "@/components/admin/SocialModerationBox";\nimport SocialExtraQueue from "@/components/admin/SocialExtraQueue";\n',
  "SocialExtraQueue",
);
replaceOnce(
  admin,
  "      </section>\n    </>\n  );\n}",
  "      </section>\n\n      <SocialExtraQueue meId={me.id} />\n    </>\n  );\n}",
  "<SocialExtraQueue meId",
);

// 7. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "Newest first. One short line per change.\n\n",
  "Newest first. One short line per change.\n\n## 2026-11-08\n- patch-social-report-more (SOCIAL_TODO A8 + A9: Report a Social REPLY and a Social ACCOUNT, moderate replies): a person can now REPORT somebody else's Social reply (button under each reply on `/social/<id>`) and somebody else's Social account (button on `/social/u/<username>`), with a SITE rule and a reason of 5-500 characters, once per target (`SocialReportMore.tsx`, server actions `reportSocialReply` / `reportSocialAccount` in `social/report/more-actions.ts`; the same per-person limit as post reports, one shared counter). Rules in `social-report-more-rules.ts` (pure): a reply can only be reported while it AND the post under it may be shown; not your own reply; an account only while it may be shown (`social-visibility.ts`); not yourself. A report hides nothing. `/admin/social` has three new sections (`SocialExtraQueue.tsx`): reported replies (admin hides with site rule + written reason, or dismisses the reports), hidden replies waiting for a DIFFERENT admin (restore or remove, written note), and reported ACCOUNTS (an admin closes the reports with a written note: \"dismiss\" or \"handled\"; a link opens the people tools for suspend / ban; nothing happens to the account by itself). Work in `social-reply-review.ts` (`hideSocialReply`, `decideSocialReplyReview`, `dismissSocialReplyReports`, `closeAccountReports`, `loadSocialMoreQueue`), same steps as `social-review.ts`; one audit-log row per step in the same transaction (new `AuditTarget.SOCIAL_REPLY`; account reports use target USER with REPORT_DISMISSED / REPORT_ACTIONED). A hidden or removed reply leaves the post page and the profile Replies tab (they already read only VISIBLE replies); the reply author is emailed (new `email.socialreply.*`). DATABASE CHANGE: `SocialReply.statusSiteRule / statusNote / statusChangedAt`, `Report.socialReplyId / reportedUserId` + unique (reporterId, socialReplyId) and (reporterId, reportedUserId), `AuditTarget.SOCIAL_REPLY`: run `npx prisma migrate dev --name social_report_more` and `npx prisma generate` inside web/. 30 new texts in six languages. New test `npm run test:social-report-more` (no database). Not done on purpose: appeal (SOCIAL_TODO 29), a notice for a hidden reply, hiding a QUOTE text, Social replies / accounts in the public mod log, a report count on the admin overview, hiding or suspending an account FROM this page (use the people tools).\n\n",
  "patch-social-report-more",
);
{
  const file = p("ACCOUNT_RULES.md");
  const src = read(file);
  if (src !== null) {
    if (src.includes("### 3.15 Reporting a reply")) console.log("skip (already done): ACCOUNT_RULES.md");
    else {
      fs.writeFileSync(file, src.replace(/\s*$/, "\n") + `
### 3.15 Reporting a reply or an account (SOCIAL_TODO A8 + A9, decided 2026-11-08, PROVISIONAL)
- Anyone logged in can report a Social REPLY of somebody else, or a Social ACCOUNT other than their own, once per target, with a site rule and a short reason. The person reported is never told who reported. A report alone never hides, suspends or counts against anybody.
- A reply is moderated exactly like a post (3.11): ADMINS ONLY, one admin hides (site rule + written reason), a DIFFERENT admin restores or removes (written note), nobody acts on their own reply, one audit-log row per step. A reply can only be reported while it and the post under it may be shown.
- Reports about an ACCOUNT go to the admin queue. An admin reads them, may suspend or ban through the normal people tools (3.1 - 3.8; that is a separate, recorded action), and then closes the reports with a written note ("dismiss" = nothing needed, "handled" = something was done). An admin cannot close reports about themselves.
- Not decided yet: appeal and the author's notice for a hidden reply, whether many reports on one account should raise it in the queue, reporting a quote text.
`);
      console.log("edited: ACCOUNT_RULES.md");
    }
  }
}

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s). Fix it (or send the message above) and run again.`);
process.exit(problems === 0 ? 0 : 1);
