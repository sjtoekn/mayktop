patch-profile-security  (Account settings: profile text, password change, email change)   PROVISIONAL numbers

What it adds (all inside /settings):
 - "Your profile" (/settings/profile): display name (up to 50 characters, optional) and the short text about you (up to 300).
   They show on your Social profile (/social/u/<name>) and next to your Social posts. Empty name = your username is shown.
   A name that looks like the site's or staff's (admin, moderator, mayktop, support ...) is refused for ordinary people.
   You can save at most 10 times an hour.
 - "Password and email" (/settings/security):
   * Change password: current password + new password twice. Every OTHER device is logged out, and a notice goes to your email.
   * Change email: needs the current password. Link 1 goes to your CURRENT email (approve), link 2 to the NEW address (verify).
     The email changes only after both are opened. The answer is the same whether or not the new address is already used.
   * Wrong passwords count against a limit (5 tries per 15 min for the password, 3 per hour for the email).
   * A suspended / banned / deletion-pending account sees "your account is limited" and cannot change these.
 - Texts in six languages. NO DATABASE CHANGE (bio, displayName columns already exist; no migration).
 - Erasing an account and "Download my data" already cover display name and bio (nothing to add).

NOT done on purpose (separate steps):
 - Picture (avatar) upload: avatars are still the coloured circle with the first letter. Upload needs a serving address, erasure
   on account deletion and data export, so it is its own patch.
 - /u/<name> (the old sample-data profile page) is untouched; the real profile is /social/u/<name>.
 - Display names are not checked against OTHER people's names (only against the reserved words).

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):   unzip -o patch-profile-security.zip
3. In web/:   npm run test:profile   npm run check:i18n   npm run lint   npm run build
   (Claude could not run lint / build here: there was no node_modules and no internet. If lint or build shows an error,
    send me the first error lines and I fix it.)
4. Manual test (npm run dev; emails are printed in the terminal where dev runs):
   a. /settings shows two new links: "Your profile" and "Password and email".
   b. Profile: set name "Nimal Perera" and a short text, Save -> "Saved." Open /social/u/<your username>: name and text show.
   c. Empty the name, Save: the page shows your username again.
   d. Try the name "Admin": refused. Try 51 characters: refused. Try a 301-character text: refused.
   e. Password: wrong current password -> "not correct". Too short new password -> refused. Different second box -> refused.
      Correct values -> "Your password was changed"; a notice email is printed in the terminal; a second browser that was logged in is logged out.
      Log out and log in with the NEW password.
   f. Email: enter a new address and your password -> "Check your emails". In the terminal: first an "Approve your email change"
      email (to the OLD address): open its link. Then a "verify" email (to the NEW address): open it. /settings now shows the new email.
      (The second email still says "finish signing up": same text as sign-up. Harmless; tell me if you want a separate wording.)
   g. Email: your own current address -> "already your email". Wrong password -> "not correct". Four tries in an hour -> "Too many tries".
   h. Suspend a test account (npm run staff): /settings/profile and /settings/security say the account is limited, no forms.
5. Things to watch: the email-change flow uses Better Auth 1.7 `changeEmail` + `sendChangeEmailConfirmation`
   (checked in its documentation, not run here). If step f does not send both emails, tell me what the terminal shows.

New files: settings/profile/{page,actions}, settings/security/{page,actions}, settings/profile-settings.css,
  components/{ProfileSettingsForm,ChangePasswordForm,ChangeEmailForm}.tsx, lib/profile.ts, lib/profile-rules.ts, scripts/test-profile.ts
Changed files: lib/auth.ts (changeEmail on), config/site.ts (profileConfig), settings/page.tsx (2 links), 6 i18n files (+48 texts), package.json (test:profile)

=== HOW TO APPLY (use THIS, not a plain unzip over everything) ===
Your project folder is newer than the one Claude read (it has patches such as patch-admin-edit-erase). This zip therefore
contains only NEW files plus a script that adds the changes to your CURRENT files without overwriting other patches.
 1. Back up the project folder.
 2. In the project folder (where PROJECT.md is):   unzip -o patch-profile-security-safe.zip
 3. Same folder:   node apply-profile-security.mjs        (prints OK / SKIP / PROBLEM lines; safe to run twice)
 4. cd web  then  npm run test:profile  npm run check:i18n  npm run lint  npm run build
