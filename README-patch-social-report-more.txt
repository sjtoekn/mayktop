patch-social-report-more  (SOCIAL_TODO A8 + A9: Report a Social REPLY and a Social ACCOUNT, moderate replies)

What it does: a person can REPORT somebody else's Social reply (button under each reply on /social/<id>) and somebody else's
Social account (button on /social/u/<username>). Reporting a Social POST already existed (patch-social-27). Admins see the new
reports on /admin/social in three new sections: reported replies, hidden replies waiting for a second admin, reported accounts.
- A REPLY is moderated like a post: one admin HIDES it (site rule + written reason), a DIFFERENT admin RESTORES or REMOVES it
  (written note). Or an admin DISMISSES the reports. The reply author is emailed. A hidden / removed reply leaves the post page.
- An ACCOUNT is never hidden or suspended by a report. An admin reads the reports, can open the people tools (/admin/people/<name>)
  to suspend or ban, and then CLOSES the reports with a written note ("Dismiss reports" or "Mark as handled").
- Every step writes one audit-log row in the same transaction. This patch needs a DATABASE CHANGE.

Needs patch-social-27 (and the later social patches) installed first.

1. Make a backup zip of the project first (also copy web/dev.db to web/dev.db.before-social-report-more).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-report-more.zip
   NEW files:  web/src/lib/social-report-more-rules.ts, social-report-more.ts, social-reply-review.ts
               web/src/app/(site)/social/report/more-actions.ts
               web/src/app/admin/social/more-actions.ts
               web/src/components/social/SocialReportMore.tsx, socialReportMoreProps.ts
               web/src/components/admin/SocialItemModerationBox.tsx, SocialExtraQueue.tsx
               web/scripts/test-social-report-more.ts
               apply-social-report-more.mjs, i18n-social-report-more/ (6 small text files)
3. node apply-social-report-more.mjs      (must end with "All done.")
   It edits: schema.prisma, package.json, the 6 language files, SocialReplyList.tsx, the Social profile page
   (social/u/[username]/page.tsx), admin/social/page.tsx, CHANGELOG.md, ACCOUNT_RULES.md. It can be run twice safely.
4. In web/:   npx prisma migrate dev --name social_report_more
   (only new columns / unique indexes; if it asks to RESET the database, say NO and send me the message)
   then:      npx prisma generate
5. In web/:   npm run test:social-report-more     npm run test:social-review     npm run check:i18n     npm run lint     npm run build
6. Manual test (needs 2 admins "admin1", "admin2", a normal person "ann" who wrote a Social reply, and "bob"):
   a. As bob: open a Social post that has a reply by ann. Under her reply there is a "Report" button -> choose a rule, write a
      reason -> Send report. Send again: "already reported". Under bob's OWN reply there is no Report button.
   b. As admin1: /admin/social -> "Reported replies" shows it with the reason. Hide it (rule + 20+ characters) -> "Are you sure" -> Done.
      The reply is gone from the post page and from ann's profile "Replies" tab; ann gets an email (terminal in development).
   c. Still as admin1: under "Hidden replies waiting for a second admin": "You hid this, so a different moderator or admin must decide it."
   d. As admin2: Restore -> the reply is back; or hide it again and Remove -> gone for good (still in the database).
   e. As admin1 on a reply that has reports but is fine: "Dismiss reports" with a note -> the reports disappear, the reply stays.
   f. As bob: open /social/u/ann -> "Report" button next to Follow (none on your own profile) -> report the account.
   g. As admin1: /admin/social -> "Reported accounts" shows @ann with the reason. "People tools" opens /admin/people/ann.
      "Mark as handled" or "Dismiss reports" (note 20+ characters) -> Done. ann is NOT told anything and nothing happens to her account.
   h. Check the audit log (database): one row per step; replies use target SOCIAL_REPLY, accounts use target USER.
7. Tick the Report item (SOCIAL_TODO A8) when everything passes.

Not in this patch on purpose (next steps): appeal of a removal (29) and the author's notice for a hidden reply, hiding a QUOTE text
(needs a status column on SocialRepost), Social replies / accounts in the public mod log, a Social report count on the admin overview,
suspending or banning an account FROM the /admin/social page (the people tools do that, as a separate recorded action).
