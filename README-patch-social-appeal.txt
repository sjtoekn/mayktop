patch-social-appeal  (SOCIAL_TODO 29: appeal of a removed Social post or reply)

What it does: the AUTHOR of a Social post or reply that was REMOVED (hide by one admin, remove by a different admin) can now appeal
the removal, once, within 30 days (appealConfig.windowDays). A third admin reads it, writes a note, and accepts (the item is visible
again) or rejects (the removal stands). Same fairness idea as community posts (PROJECT.md 8g): nobody judges their own case.
- Author: opens /appeal/social/post/<id> or /appeal/social/reply/<id> (the removal email now ends with this link) and writes 20-2000 characters.
- Admin: the appeal shows in /admin/appeals (badge "Content", line "A Social post" / "A Social reply"), with the first decision, rule and reason.
- Deciding = the existing decideAppeal (appeals.ts), extended. One transaction: the item's status + the audit-log row (APPEAL_ACCEPTED /
  APPEAL_REJECTED, target SOCIAL_POST / SOCIAL_REPLY). The author is emailed. Accepting also refreshes the cached feeds.
- NO DATABASE CHANGE. No migration, no "prisma generate". (Appeal already points at the audit-log row; the Social audit targets already exist.)

IMPORTANT (a rule consequence, not a bug): the admin who HID it and the admin who REMOVED it are both excluded from deciding the appeal.
So a Social appeal can only be decided when at least THREE active admins exist. With two, the appeal stays open (the queue shows
"you took part in the first decision"). ACCOUNT_RULES.md 3.16 records this as an open question; the stricter rule stays until you decide.

Needs patch-social-report-more (and the earlier social patches) installed first.

1. Make a backup zip of the project first (no database file is touched by this patch).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-appeal.zip
   NEW files:  web/src/lib/social-appeal-rules.ts, social-appeal.ts
               web/src/app/(site)/appeal/social/actions.ts
               web/src/app/(site)/appeal/social/[kind]/[id]/page.tsx
               web/src/components/social/SocialAppealForm.tsx
               web/scripts/test-social-appeal.ts
               apply-social-appeal.mjs, social-appeal-edits.json, i18n-social-appeal/ (6 small text files)
3. node apply-social-appeal.mjs      (must end with "All done.")
   It edits 16 existing files: lib/appeals.ts, lib/admin-appeals.ts, app/admin/appeals/page.tsx and actions.ts,
   lib/social-review.ts and lib/social-reply-review.ts (the removal emails get the appeal link), scripts/appeals.ts,
   package.json, the 6 language files, CHANGELOG.md, ACCOUNT_RULES.md. It can be run twice safely.
4. In web/:   npm run test:social-appeal     npm run test:appeals     npm run test:social-review     npm run check:i18n     npm run lint     npm run build
5. Manual test (needs 3 admins "admin1", "admin2", "admin3", a normal person "ann" with a Social post, and "bob"):
   a. As bob: report ann's Social post. As admin1: /admin/social -> hide it (site rule + 20+ characters).
   b. As admin2: remove it (note). ann gets the removal email (terminal in development) and it ends with an appeal link.
   c. As ann: open the link -> /appeal/social/post/<id>: the rule and reason are shown, a box for the appeal. Write 20+ characters -> sent.
      Open it again: "your appeal is waiting". Open /appeal/social/post/<id> as bob: "not found".
   d. As admin1 and as admin2: /admin/appeals shows the appeal but says "you took part in the first decision" (no Accept / Reject box).
   e. As admin3: Accept (note 20+ characters) -> "Are you sure" -> Done. ann's post is back in the feeds and on /social/<id>; ann gets an email.
      (Or Reject: the post stays gone, ann sees the answer on the same page.)
   f. Repeat with a Social REPLY (/appeal/social/reply/<id>): accepted = the reply is back under the post.
   g. Check the audit log (database): one APPEAL_ACCEPTED / APPEAL_REJECTED row, target SOCIAL_POST or SOCIAL_REPLY, written by admin3.
   h. Optional: `npm run appeals -- list` and `npm run appeals -- show <id>` list and show these appeals.
6. Tick SOCIAL_TODO 29 when everything passes.

Not in this patch on purpose (next steps): a notice page for a removed Social post (SOCIAL_TODO C5; the author gets the link by email only),
Social decisions and appeals in the public mod log, appeal of a merely hidden item, hiding a QUOTE text.
