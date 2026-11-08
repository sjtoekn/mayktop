patch-social-27  (SOCIAL_TODO 27 + 30: Social moderation and Report)

What it does: a person can REPORT someone else's Social post. Admins see the reports on a new page /admin/social, can HIDE a post
(site rule + written reason), and a DIFFERENT admin then RESTORES or REMOVES it (written note). Admins can also DISMISS reports.
Every step is saved in the audit log in the same transaction. The author is emailed. This patch needs a DATABASE CHANGE.

Needs patch-social-17 installed first (its texts social.tabs.* / social.following.* are used by the code; npm run check:i18n
reports 8 problems until patch-social-17 is applied: that is not this patch).

1. Make a backup zip of the project first (also copy web/dev.db to web/dev.db.before-social-27).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-27.zip
   NEW files:  web/src/lib/social-review-rules.ts, social-review.ts, social-report.ts
               web/src/app/(site)/social/report/actions.ts
               web/src/app/admin/social/page.tsx, actions.ts
               web/src/components/social/SocialReportButton.tsx
               web/src/components/admin/SocialModerationBox.tsx
               web/scripts/test-social-review.ts
               apply-social-27.mjs, i18n-social-27/ (6 small text files)
3. node apply-social-27.mjs      (must end with "All done.")
   It edits: schema.prisma, site.ts, package.json, the 6 language files, admin/layout.tsx, SocialPostCard.tsx,
   CHANGELOG.md, ACCOUNT_RULES.md. It can be run twice safely.
4. In web/:   npx prisma migrate dev --name social_moderation
   (it asks nothing destructive: only new columns; if it asks to RESET the database, say NO and send me the message)
   then:      npx prisma generate
5. In web/:   npm run test:social-review     npm run check:i18n     npm run lint     npm run build
6. Manual test (needs 2 admins "admin1", "admin2" and 1 normal person "ann" with a Social post):
   a. As admin1 (or any other person): open /social, the post of ann has a "Report" button -> choose a rule, write a reason -> Send.
      Send again: it says "already reported". On your OWN post there is no Report button.
   b. As admin1: /admin/social -> "Reported posts" shows it with the reason. Hide it (rule + 20+ characters) -> "Are you sure" -> Done.
      The post is gone from /social and Home; ann gets an email (shown in the terminal in development).
   c. Still as admin1: under "Hidden posts waiting for a second admin" you see "You hid this, so a different moderator or admin must decide it."
   d. As admin2: Restore -> the post is back; or hide it again and Remove -> gone for good (still in the database).
   e. As admin1 on a post that has reports but is fine: "Dismiss reports" with a note -> the reports disappear, the post stays.
   f. Open /admin/people/<ann> or the database: the audit log has one row per step.
7. Tick SOCIAL_TODO 27 and 30 when everything passes.

Not in this patch on purpose (next steps): appeal of a removal (29), the notice the author sees (28; a hidden / removed post is still
"not found" on /social/<id>), hiding a QUOTE text (needs a status column on SocialRepost), Social in the public mod log, Social count
on the admin overview.
