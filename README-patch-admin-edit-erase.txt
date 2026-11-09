patch-admin-edit-erase  (admin People: edit a profile, erase an account at once)   PROVISIONAL

What it does (on /admin/people/<username>):
 - EDIT PROFILE (any active admin): display name (max 50), bio (max 300), username, email. Only for a plain user (not yourself, not staff, not an
   erased account). A written reason (20+ characters) is mandatory. One audit row USER_EDITED (names of the fields, never the values).
   The person is emailed what changed and why. A NEW EMAIL is not trusted: the person is logged out and must confirm the new address first.
 - ERASE NOW (SUPER admin only, everybody else gets a 404): the same erasure as `npm run purge`, at once, without the 7 days and the warning.
   Needs a written reason and the username typed. Refused: legal hold, open appeal, staff / yourself, already erased.
   The account row stays as the anonymous shell (the audit log, votes and replies point to it), all personal data is gone.
   After it: a list of things to do by hand (a paid ad to refund, a community without a moderator).
 - DECISION TO CONFIRM: "erase at once" is an exception to the promise "no surprise erasure" (ACCOUNT_RULES.md 3.7). Only the super admin has it.
   If you do not want it, delete "erase" from the list in actionsFor() (src/lib/admin-people.ts). Nothing else changes.
 - DATABASE CHANGE: one new AuditAction value, migration 20261120090000_user_edited (SQLite keeps enums as text: no table change).
 - 31 new texts in six languages. New numbers in web/src/config/site.ts: staffConfig.maxDisplayNameLength (50), maxBioLength (300).
 - The username rule moved to src/lib/username.ts (auth.ts re-exports it, so nothing else changes).
 - Needs SAFETY_HASH_SECRET (or BETTER_AUTH_SECRET) in web/.env for "Erase now" (same as npm run purge).

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):
     unzip -o patch-admin-edit-erase.zip
3. In web/:
     npx prisma migrate dev
     npx prisma generate
     npm run test:admin-edit
     npm run check:i18n
     npm run lint
     npm run build
   (If npm run dev is running, stop it and start it again after "prisma generate".)
   Also worth running again: npm run test:purge-audit   npm run test:purge-social   (they use the local database and change nothing)
4. Manual test (npm run dev). Make two test accounts first (or use `npm run seed` people). Log in as the SUPER admin, open /admin/people/<test user>:
   a. Buttons: "Edit profile", Suspend, Propose ban, Make admin, "Erase account now". Log in as a normal (non-super) admin: "Edit profile" is there,
      "Erase account now" and "Make admin" are not. A moderator / admin / yourself: no Edit and no Erase.
   b. Edit: the form starts with the current values. Press Continue without a change: "Nothing was changed". Change only the bio, write a reason of
      under 20 characters: error. Write 20+ characters: "are you sure" step, Save: "Done". The page shows the new bio; the history has "Profile edited" by you.
      The terminal prints an email to the person ("changed these details: Bio").
   c. Change the username to one that is taken, to "admin", to "ab": each gives its own error. A good new username: the page address changes to the new name.
   d. Change the email to one used by another account: error. A new one: the history row says "email"; the terminal prints TWO emails (old and new address,
      with the "you were logged out" note). Log in as that person in a private window BEFORE the change and keep it open: after the change a reload logs it out.
      Logging in again with the new address does NOT work until the confirmation link (printed in the terminal) is opened.
   e. Check the history row of an edit in `npx prisma studio` (AuditLog): the reason lists the field names, NOT the old or new username / email.
   f. Erase now: press the button, write a reason, type a wrong username: error. Type the right one (also "@name" works): "are you sure" step, press the red button.
      A green message appears, with a "things to do by hand" list if the person had a paid, running ad or moderated a community. Open the history:
      the account is `deleted-<id>`, status Erased, and the history shows "Account erased" by YOU with your reason.
      In prisma studio: the User row is still there (anonymous), their posts have empty text and deletedAt set, Session / Account rows are gone.
   g. Try to erase: a person with a legal hold (`npm run purge -- hold <admin> <person> "<reason>"` first): error "legal hold". A person with an open appeal: error "appeal".
   h. A banned person (or one with an open report on a post) is erased: a SafetyRecord row exists afterwards (`npm run purge` preview shows it under records).
   i. Light and dark theme, and the phone size: the edit form (4 fields + reason), the red "Erase" button and the "by hand" notice look right.
