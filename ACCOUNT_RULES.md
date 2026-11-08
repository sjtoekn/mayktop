# MaykTop — Account rules (deleting, suspending, banning, appeals)

> Written 2026-11-07. Status: **PROVISIONAL** — no lawyer has reviewed it. A lawyer must review this file and a public Privacy Policy / Terms must state it BEFORE the site is opened to the public.
> This is the plain-language reference for anyone (owner, future team, lawyer) who asks "what happens to a person's account, and why?". The reasons behind it are in `PROJECT.md` sections 2, 3, 8c and 8d. The numbers live in `web/src/config/site.ts` (`accountConfig`, `staffConfig`). Change a number there only.

## 1. Why these rules exist

Many people are removed from big platforms without a reason, without a warning and without a way back. MaykTop must not do that. Every rule below follows from the project principles: **fairness first, no silent action, a visible reason tied to a rule, always a way to appeal, one person never judges alone or judges themselves.**

## 2. What is built (tick = in the code; "check" = the owner's manual test)

- [x] **Account states** (`User.status`): ACTIVE, SUSPENDED (temporary or ban), DELETION_PENDING, DELETED. A limited person can still READ the site and use `/settings`; every write is refused. (36a)
- [x] **Download my data**: one JSON file, works in every state except erased. (36b)
- [x] **Delete my own account** (36c). Needs the password again. 7 days of waiting; logging in again, or "Keep my account", cancels it. All devices are logged out. (check pending)
- [x] **Temporary suspension** by one admin: 1-30 days, nothing erased, ends by itself. (36d) (check pending)
- [x] **Permanent ban** needs TWO different admins (propose, then approve). (36d, 36d2) (check pending)
- [x] **Appeal** can be written by the suspended / banned person on `/settings` (one per decision). (36d)
- [x] **Appeal review** (done in TODO 40, PROJECT.md 8g): an admin who took no part in the first decision and is not the appellant reads it (`npm run appeals`); accept ends the suspension / ban, reject keeps it. Manual check pending.
- [x] **Final erasure** after the waiting time, `npm run purge`, safety record, email notices (36e). (check pending)
- [ ] **Admin panel** (screens instead of `npm run staff`), removing admin rights: Phase 4.

## 3. The rules

### 3.1 A person deletes their own account
1. Only an ACTIVE account can ask. The password is asked again (5 wrong tries in 15 minutes lock the form).
2. The account becomes DELETION_PENDING and waits **7 days**. Nothing is erased yet. Every other device is logged out, and so is this one.
3. **Logging in again cancels it** (any login way). A "Keep my account" button on `/settings` is the backup.
4. After 7 days (36e): email, name, profile, password hash, sessions and the title/text of every post and comment are erased, and so are the text and picture link of every social post, the text of quote reposts, all follows (both ways) and all notifications (received and caused). The rows stay as an anonymous shell so other people's replies, votes, likes and the audit log keep working. For a banned / reported account, hidden or removed social posts are copied into the safety record first (`web/src/lib/purge-social.ts`).
5. Not allowed while suspended or banned (deleting must not be a way out of a staff decision) and not for a person who moderates a community (same rule as "Leave").
6. A normal self-deleted account with no report keeps **no** record.

### 3.2 Site rules (a staff action must name one, plus a written reason)
HARASSMENT (serious), HATE (serious), ILLEGAL (serious), PRIVACY (serious), SPAM, ABUSE, IMPERSONATION. Short texts in `web/src/i18n/messages/` (`siteRule.<KEY>`). "Serious" rules allow a ban for a first offence. Community rules are separate and belong to each community.

### 3.3 Temporary suspension
- One ACTIVE admin. Rule + written reason (20-1000 characters) are mandatory. 1-30 days. Nothing is erased; the person returns by themselves.
- Never on yourself, never on other staff.
- The person gets an email (rule, reason, end date, link) and `/settings` shows rule, reason, days left, export and appeal.

### 3.4 Permanent ban (a ladder, and two people)
1. **Ladder:** allowed at once only for a serious rule. For SPAM and ABUSE the person must have had a suspension within the last 365 days; otherwise "suspend first".
2. **Two admins:** admin A *proposes* (rule + reason). **Nothing happens to the person.** A different admin B *approves* with a written note (or rejects). A cannot approve their own proposal. A proposal lapses after 7 days. One open proposal per person. Approval re-checks everything.
3. After approval: 7 days to download data and appeal, then the account is erased as in 3.1 point 4 (36e). An open appeal stops the clock.
4. A person waiting to delete themselves can still be banned (the ban clock then applies).
5. A ban can be lifted early (`lift`) with a written reason, for example after a successful appeal.

### 3.5 Appeals
- One appeal per decision, 20-2000 characters, linked to the audit-log row of the decision.
- Must be read by someone other than the person who decided: an admin who is not the appellant, not the suspending admin, and for a ban neither the proposing nor the approving admin (enforced in `web/src/lib/appeals.ts`).
- If it succeeds the account returns and nothing is erased. While it is open, nothing is erased.

### 3.6 Records
- **Audit log:** every staff action is one row (`AuditLog`): who, their role then, what, which person, site rule, reason, when. Rows are only added. Ban proposals and rejections are logged too (`BAN_PROPOSED`, `BAN_REJECTED`).
- **Safety record after erasure (built in 36e, never public, admin only):** only for banned accounts, accounts with an open report/appeal at erasure time, or a legal request: user id, one-way hash of the email, dates, rule, reason, audit rows, a copy of the reported content. Kept 180 days after erasure (up to 2 years for a serious ban; longer only under a legal hold). Deleted automatically afterwards.
- **Audit rows written by the purge job itself (Part 9):** three actions, all by the *system actor* (an anonymous shell account `deleted-system`, role USER, no login, never an admin): `ACCOUNT_ERASE_WARNED` (the warning email was sent), `ACCOUNT_ERASED` (one row for EVERY erasure, also when no safety record was kept), `SAFETY_RECORD_SWEPT` (a record was deleted because its date passed and no legal hold was set). Each row is saved in the SAME transaction as the change it records (no action without a record) and holds no personal data: only the opaque account id, the kind (deletion / ban), the record number and the days kept. They are never deleted, so after the person and the record are gone the log still proves that the person was warned, that the erasure happened and when, and that a record under legal hold was never swept. Not shown on the public Mod log.
- **Backups** are deleted within 90 days, so erased data leaves the backups too.
- The public Mod log keeps rule and reason but not the person's name after erasure.

### 3.7 Final erasure (`npm run purge`, 36e)
`npm run purge` is a PREVIEW: it shows what would happen and changes nothing, sends nothing. `npm run purge -- --run` does it (once a day, later by a scheduled job). It is safe to run twice.
1. **Warning first.** When an erase date is under 24 hours away (or has passed) the person gets an email: "erased on or after <time>". If the email cannot be sent, nothing is erased. Erasing needs the date passed AND a warning at least 12 hours old, so a purge that did not run for a week never erases without notice.
2. **An open appeal stops it.** After an appeal is decided, 3 more days pass, the person is warned again, then it is erased.
3. **Recovering wins.** Logging in again (deletion) or lifting a ban cancels it. The erase step checks the state again inside the same database transaction; each person is erased in ONE transaction (everything or nothing).
4. **Erased:** email, name, bio, picture, timezone, password and login methods, sessions, e-mail / reset codes, community memberships, the title and text of every post and comment, the text of the appeals the person wrote, the contact email of their ads. The `User` row stays as an anonymous shell: username `deleted-<id>`, email `<id>@erased.invalid`.
5. **Kept (anonymous):** vote totals, reports the person made, the audit log (the public Mod log shows rule and reason, never the name of an erased person), ad statistics.
6. **Their ads** are ended at once. A paid ad stopped early is printed at the end of the run: refund by hand (TODO 46).
7. **Open reports on their content** do not delay the erasure; they cause a safety record with a copy of the reported content, so the report can still be decided.
8. **Safety record** only for: a ban, an open report at erasure time, a legal hold. Kept 180 days (730 after a ban for a serious rule), then swept by `npm run purge`, unless a legal hold is set. The email is kept only as a one-way code (HMAC with a server secret).
9. **Audit trail of the purge (Part 9):** see 3.6. Warning, erasure and sweep each write one audit row (system actor) in the same transaction; a legal hold already wrote its own row (admin actor). A person's history on `/admin/people/deleted-<id>` shows all of them, the system ones as "by the purge job".
10. **Legal hold:** `npm run purge -- hold|release <admin> <person> "<reason>"` (before erasure) and `hold-record|release-record <admin> <record-number> "<reason>"` (after). Admin only, audited.
11. **A moderator who is banned** loses the membership too; the run prints which community needs a new moderator.
12. **Needs:** `SAFETY_HASH_SECRET` (or `BETTER_AUTH_SECRET`) in `web/.env`, and a working email service for the warning (in production the warning refuses to send until TODO 56, so nothing is erased there; this is on purpose).

### 3.8 Social posts and the state of the account (SOCIAL_TODO 7, decided 2026-11-07)
Rule: a staff action on an ACCOUNT never hides the person's social posts by itself. A post is hidden only by moderation with a site rule number and a written reason (SOCIAL_TODO 27), exactly like community posts. This is the "no mass removals without a reason" promise (PROJECT.md 8d).
- **Active, temporarily suspended, banned:** posts stay shown (a banned person's posts stay until the final erasure, 3.7, which erases the text). Writing, liking and reposting stay refused for a suspended / banned person (the server checks the account on every action).
- **Asked to delete (DELETION_PENDING, 7 days):** posts are not shown and cannot be liked. "Keep my account" / logging in again brings them back untouched.
- **Erased (DELETED):** text and picture link erased, not shown (3.7). Likes stay as anonymous counts.
- Likes made by a suspended / banned / deleted person stay in the count (same as votes).
- One place decides this: `socialAuthorShown` in `web/src/lib/social-visibility.ts` (used by the Home feed and by Like). Every future social list (Following feed, profile tab, search, replies) must use it too. Test: `npm run test:social-visibility`.

### 3.9 Following (SOCIAL_TODO 15, decided 2026-11-07)
Follow is open: anybody who is logged in can follow anybody whose Social posts are shown. It is about reading, never about permission, and it gives nobody any power over the other person.
- **Who follows:** only an ACTIVE account (`getSessionUser`). A suspended / banned / deleting person can neither follow nor unfollow (every write is refused, same as like and post).
- **Who can be followed:** the same people whose posts are shown (`isSocialAuthorShown`, 3.8): ACTIVE and suspended / banned. Not a person who asked to delete the account (DELETION_PENDING) and not an erased account. Nobody follows themselves.
- **Unfollow is always allowed**, whatever the state of the other account (it is the person's own choice and own data).
- **Existing follows are never touched by a state change:** a person who is suspended, banned or waiting for deletion keeps their followers; if they keep the account everything is as it was. Final erasure (3.7) deletes all follows in both directions.
- **Notification:** the person followed gets one `FOLLOW` notification per follower, EVER. Follow, unfollow, follow again (or a script doing it) never adds another one. Nobody is told about an unfollow.
- **Limits:** `socialLimits.follows`: 30 per minute and 500 per 24 hours per person (server memory).
- **One place decides:** `applySocialFollow` in `web/src/lib/social-follow.ts` (one transaction). Test: `npm run test:social-follow`.
- **Not decided here (later items):** blocking a person (there is no Block table; it would be its own item), a limit on how many people one account may follow, a hidden follower list.

### 3.10 Reposts and quotes (SOCIAL_TODO 16, decided 2026-11-07)
- **Who reposts:** only an ACTIVE account (`getSessionUser`). A suspended / banned / deleting person can neither repost, quote nor undo (every write is refused).
- **What can be reposted:** a Social post that may be shown (visible, not deleted, author ACTIVE or suspended / banned: `isSocialAuthorShown`, 3.8). Your own posts are allowed.
- **Undo is always allowed**, whatever the state of the post or of the other account.
- **State changes do not touch existing reposts:** a suspended, banned or deleting person keeps their reposts in the table; the feeds only show a repost while BOTH the person and the original post may be shown, so it hides and comes back with them. Final erasure (3.7) deletes the person's reposts (and quote texts); reposts OF an erased person's posts disappear with the posts (they are never shown).
- **Notification:** one `SOCIAL_POST_REPOST` per person per post, EVER. Nobody is told about an undo.
- **Quote text:** the person's own words; cleaned like a post. It must get the same hide / review / appeal path as a post when moderation of Social posts is built (items 27-29).
- **Limits:** `socialLimits.reposts`: 30 per minute and 300 per 24 hours per person (server memory).
- **One place decides:** `applySocialRepost` in `web/src/lib/social-repost.ts` (one transaction). Test: `npm run test:social-repost`.

## 4. Who can do what

| Action | Who |
|---|---|
| Delete / recover own account, export data, write an appeal | the person |
| Temporary suspension, lift, make another admin | one ADMIN (not on self / staff; lift not on self) |
| Propose a ban | one ADMIN |
| Approve a ban | a DIFFERENT ADMIN |
| Reject / withdraw a ban proposal | any ADMIN |
| First admin | `make-first-admin`, only while no admin exists (audited) |

## 5. Where it lives in the code

| Part | File |
|---|---|
| Staff rules (all of 3.3-3.4) | `web/src/lib/staff.ts` |
| Numbers and site rules | `web/src/config/site.ts` (`accountConfig`, `staffConfig`) |
| Staff commands | `web/scripts/staff.ts` -> `npm run staff -- ...` |
| Account state, delete / cancel | `web/src/lib/account.ts`, `web/src/app/settings/delete/actions.ts`, login hook in `web/src/lib/auth.ts` |
| Settings page, appeal | `web/src/app/settings/page.tsx`, `web/src/app/settings/appeal/actions.ts` |
| Data export | `web/src/app/settings/export/route.ts` |
| Tables | `User`, `AuditLog`, `Appeal`, `BanProposal` in `web/prisma/schema.prisma` |
| Final erasure, safety record, legal hold | `web/src/lib/purge.ts`, rules in `web/src/lib/purge-rules.ts`, `web/scripts/purge.ts` -> `npm run purge` |
| Test helper (set a state by hand) | `npm run db:status -- <username> <active|suspend|ban|deletion|deletion-due|ban-due|deletion-warned|ban-warned>` |

### Staff commands (run in `web/`)
```
npm run staff -- rules
npm run staff -- make-first-admin <username>
npm run staff -- make-admin <admin> <person>
npm run staff -- suspend <admin> <person> <days 1-30> <RULE> "<reason>"
npm run staff -- propose-ban <admin> <person> <RULE> "<reason>"
npm run staff -- proposals
npm run staff -- approve-ban <other-admin> <number> "<note>"
npm run staff -- reject-ban <admin> <number> "<note>"
npm run staff -- lift <admin> <person> "<reason>"
```

## 6. Open questions (decide before launch)
- Audit rows are never deleted (this is what makes them proof), but the written `reason` of an OLDER staff action can contain personal details the staff member typed. Ask the lawyer whether those need a time limit or a redaction after erasure (GDPR Art. 5(1)(e) storage limitation against Art. 17(3)(e) legal claims). The three new purge rows contain none.
- DECIDED 2026-11-07 (PROVISIONAL, lawyer to confirm): every erasure writes one minimal `ACCOUNT_ERASED` audit row (opaque id, date, kind), also when NO safety record was kept. It is the proof of the erasure itself (GDPR Art. 5(2)) and holds no personal data. The lawyer may still ask to drop it for plain self-deletions; that is a one-line change in `eraseAccount` (`src/lib/purge.ts`).
- The email hash in a safety record is pseudonymised, NOT anonymous: the EDPB says pseudonymised data is still personal data. It is already covered by the record's own keep-until date and the legal-hold rule; the privacy policy must say so.
- Lawyer review of every number and of the legal basis for the safety record (GDPR Art. 17(3)(b) and (e)); countries we serve.
- Lawyer check of the 36e choices (PROJECT.md 8c-36e): warning times, 3 days after an appeal, ads ended, open reports do not delay erasure.
- Banned people can sign up again with the same email (the safety record has the code, but sign-up does not check it yet).
- If a person deletes a post that was reported, its text is gone before a moderator saw it; the report flow (Phase 3) should copy the text when the report is made.
- A banned person who moderated a community leaves it without that moderator (Phase 3 hand-over).
- Moderators cannot delete their account or leave until moderation can be handed over (Phase 3).
- Making an admin needs only one admin today; consider two (Phase 4). Removing admin rights does not exist yet.
- Public Mod log entries for account actions (without the person's name).
- Real email service (emails are printed in the terminal until TODO 56).
- The in-memory password-try limit and ad counters are per server process; a shared limiter is TODO 50.

### 3.11 Social moderation and Report (SOCIAL_TODO 27 + 30, decided 2026-11-07, PROVISIONAL)
- Anyone logged in can report a Social post of somebody else, once per post, with a site rule and a short reason. The author is never told who reported. A report alone never hides anything and never counts against the author.
- Hiding, restoring and removing a Social post is done by ADMINS ONLY (PROJECT.md 8j.9): one admin hides (site rule + written reason), a DIFFERENT admin decides (restore or remove, written note). Nobody acts on their own post. Every step is one audit-log row, written in the same transaction as the change.
- A hidden or removed post is not shown in any feed. Nothing is erased by hiding or removing; the author can still delete their own post only while it is visible (SOCIAL_TODO 13).
- Not decided yet: appeal of a removal (SOCIAL_TODO 29), the notice the author sees (28), whether Social removals appear in the public moderation log.

### 3.12 Replies and notifications (SOCIAL_TODO 18 + 21, decided 2026-11-08, PROVISIONAL)
- Anyone logged in can reply to a Social post that is shown (also their own). A reply is a flat list under the post, oldest first. Only the author of a reply can delete it, only while it is visible; the text is erased, the row stays.
- A person who replies is rate limited (10 per 10 minutes, 100 per day). The author of the post is notified once per replier until they have read it.
- Account erasure erases the text of the person's replies (the rows stay, anonymous). "Download my data" includes the person's own replies.
- A notification about a post that is no longer shown is not listed, and comes back if the post is restored. Notifications of an erased account are deleted (purge-social.ts).
- Not decided yet: replies to replies, hiding / removing / reporting a reply (3.11 will be extended), notification settings.

### 3.13 Social profile (SOCIAL_TODO 2, decided 2026-11-08, PROVISIONAL)
- The Social profile (/social/u/<username>) is only for logged-in people, like every Social page. It shows the account's Social posts, reposts, replies, followers and following, for accounts whose posts may be shown (3.8). A deleted or deletion-pending account has no profile.
- Who follows whom is visible to every logged-in person. The Likes tab is visible only to the person themselves.
- Nothing new is stored. Account erasure and "Download my data" already cover posts, replies, likes and follows.
- Not decided yet: private accounts, who may see the follower lists, avatar and banner pictures.

### 3.14 Hashtags and mentions (SOCIAL_TODO 6, decided 2026-11-08, PROVISIONAL)
- A mention notifies the person mentioned, once per post. Only an account whose posts may be shown (3.8) can be mentioned; anything else stays plain text. Nobody is notified about their own mention.
- Limits: 10 different hashtags and 5 different mentions per post count; the rest stay plain text. The post rate limits (3.9) still apply, so nobody can be flooded.
- Deleting your post, or erasing your account, removes its hashtags and mentions. The notification rows follow the notification rules (3.12 and 3.7).
- Not decided yet: how Block / Mute (SOCIAL_TODO 7) affects mentions, hashtags in replies.

### 3.15 Reporting a reply or an account (SOCIAL_TODO A8 + A9, decided 2026-11-08, PROVISIONAL)
- Anyone logged in can report a Social REPLY of somebody else, or a Social ACCOUNT other than their own, once per target, with a site rule and a short reason. The person reported is never told who reported. A report alone never hides, suspends or counts against anybody.
- A reply is moderated exactly like a post (3.11): ADMINS ONLY, one admin hides (site rule + written reason), a DIFFERENT admin restores or removes (written note), nobody acts on their own reply, one audit-log row per step. A reply can only be reported while it and the post under it may be shown.
- Reports about an ACCOUNT go to the admin queue. An admin reads them, may suspend or ban through the normal people tools (3.1 - 3.8; that is a separate, recorded action), and then closes the reports with a written note ("dismiss" = nothing needed, "handled" = something was done). An admin cannot close reports about themselves.
- Not decided yet: appeal and the author's notice for a hidden reply, whether many reports on one account should raise it in the queue, reporting a quote text.

### 3.15 Pictures in Social posts (patch-social-images 4b, decided 2026-11-10, PROVISIONAL)
- ONE picture per post, JPG / PNG / WebP, at most 5 MB, at most 10,000 px on a side and 40 million pixels. The text of the post is still required. Checked by the real content of the file; SVG, GIF, video are not accepted.
- Privacy: the stored picture is a rebuilt copy WITHOUT Exif / location / camera / date data (only the orientation number is kept). The original upload is never kept. A file that cannot be fully understood is refused.
- Who may see a picture: only logged-in people (Social is for logged-in people, PROJECT.md 8j.11). A hidden or removed post, or a post of an account that is not shown (3.8), only its author and admins (moderators must see what they judge). A deleted post has no picture.
- Deleting your own post deletes the picture file at once (after the database change). Final erasure (3.7) deletes ALL the picture files of the person.
- Safety record (3.7): a hidden / removed post that goes into the record keeps its TEXT; its PICTURE is deleted with the account like every other picture. Open question for the lawyer: must a picture be kept as evidence for the 180 / 730 days? If yes, the files of those posts must be moved into a protected folder and swept with the record.
- Editing a post does not change its picture (delete the post and post again). A moderator who REMOVES a post (3.11) does not delete the file: it stays for an appeal and goes with the final erasure.
- Limits: 20 pictures per person per 10 minutes sent for checking (server memory, TODO 50 for many servers); the post limits (3.9) still apply, so at most 30 pictures per day.
- Not decided yet: disk space and backup of `web/storage/social/` (TODO 56), a virus scan (TODO 52), alt text written by the author, how Block / Mute (SOCIAL_TODO 7) affects who sees a picture.

### 3.16 Block and Mute (SOCIAL_TODO A7, decided 2026-11-11, PROVISIONAL)
- BLOCK is a private decision of one person about another. After A blocks B: B cannot follow A, like, repost, quote, reply to or mention A; any follow between them (either way) is removed and does not come back after Unblock; A and B do not see each other's posts, reposts, replies or quotes. B is never told. B's refused actions show the same "not found" as for a post that is not shown; B gets "not found" on A's profile and posts.
- MUTE is only about what the muter sees: the muted person's posts, reposts and replies are hidden from the muter's feeds and notifications. Nothing is refused to the muted person, nobody is told, and the muter's follow (if any) stays.
- Unblock and unmute are always allowed. Block and Mute need an account whose posts may be shown (3.8); you cannot block or mute yourself. Limits: 30 per minute and 300 per day, Block and Mute together (server memory, TODO 50).
- Staff are not exempt from Block (a blocked admin cannot follow or reply to the blocker like anybody else), but moderation is not affected: reports, hiding, removing, appeals and the admin pages work as before, and an admin sees every post there. Block and Mute are only for Social, not for Community posts.
- The lists are private. "Download my data" lists the people the person blocked and muted, never the people who blocked or muted them. Final erasure (3.7) deletes every block and mute the person made or received.
- Not decided yet: a limit on the size of a block list, a Settings page that lists blocked and muted people, mute for a set time, whether many blocks on one account should be shown to moderators, how Block affects the reply, like and repost COUNTS on a post (today they still count everybody), and Block for Community posts.

### 3.16 Appeal of a removed Social post or reply (SOCIAL_TODO 29, decided 2026-11-08, PROVISIONAL)
- Only the AUTHOR can appeal, only a REMOVED post / reply (a merely hidden one is still waiting for its second admin), once per removal, within the same window as community posts (`appealConfig.windowDays`, 30 days), with a written appeal of 20-2000 characters. The author finds the link in the removal email and on /appeal/social/post/<id> or /appeal/social/reply/<id>.
- An ADMIN decides (Social has no community moderators), and never the author, never the admin who hid it, never the admin who removed it (or restored it earlier). A written note is required. Accept = the item is visible again; reject = the removal stands, only the record changes. One audit-log row (APPEAL_ACCEPTED / APPEAL_REJECTED, target SOCIAL_POST / SOCIAL_REPLY) in the same transaction; the author is emailed.
- Consequence to know: because the hider and the remover are both excluded, a Social appeal can only be decided when at least THREE active admins exist. With two, the appeal waits (OVERDUE after `appealConfig.dueDays`) and the queue shows why. Open question: allow the remover (not the hider) to decide when fewer than three admins exist? Not decided; the stricter rule stays.
- Not decided yet: a notice page for a removed Social post (C5), Social decisions and appeals in the public mod log, appeal of a hidden item, hiding a quote text.

### 3.17 Bookmarks (SOCIAL_TODO B2, decided 2026-11-08, PROVISIONAL)
- A bookmark is a PRIVATE list of Social posts that one person saved for later. Nobody else can see it: no count on the post (not even for the author), no notification, no public page, no moderator view. Staff can read the table only for a legal reason (3.7 legal hold).
- Saving needs a post that may be shown (visible, not deleted, the author's account shown, 3.8) and no Block between the two people (3.16): a refused save looks like "not found". A muted person's post can be saved. A person may save their own posts. Removing a bookmark is always allowed.
- Limits: 2000 bookmarks per person (when full, saving another is refused, removing always works); 60 saves / removes per minute and 600 per day (server memory, TODO 50).
- The Bookmarks page leaves out posts that are hidden, removed or deleted by moderation or by their author (the bookmark stays and the post returns when it is restored) and posts of a person who blocked the viewer or whom the viewer blocked (a muted person's saved post is still listed: saving it was the viewer's own choice).
- "Download my data" lists the numbers of the posts the person saved, and when. Final erasure (3.7) deletes every bookmark the person made and every bookmark that points to one of the person's posts.
- Not decided yet: folders or tags for bookmarks, a Bookmarks tab on the person's own profile, saving a reply or a community post here (community posts have their own Saved page), a note on the bookmark, whether a deleted post should leave a "no longer available" line in the list.

### 3.18 Pinned post (SOCIAL_TODO B6, decided 2026-11-08, PROVISIONAL)
- A person may pin ONE of their own Social posts to the top of their profile (Posts tab, first page). It is public, like the post itself. Pinning another post replaces the old pin; unpinning always works.
- Only the person's own post can be pinned, and only while it is visible and not deleted. A pin is shown only while the post may be shown (3.8): if moderation hides or removes it, or the account is not shown, the pin is not displayed and returns with the post. Deleting your own post removes its pin.
- Limits: 20 pin changes per minute and 200 per day (server memory, TODO 50).
- "Download my data" includes the number of the pinned post and when it was pinned. Final erasure (3.7) deletes the pin.
- Not decided yet: several pinned posts, pinning a repost or a reply, a confirmation before replacing a pin.

### 3.19 Trending hashtags and Who to follow (SOCIAL_TODO B7, decided 2026-11-08, PROVISIONAL)
- The Social FEED stays newest first. These two small lists are separate, and each follows a written rule, not a hidden score.
- Trending hashtags: only hashtags of posts that may be shown (3.8, and the author's account ACTIVE) made in the last 48 hours. Ranked by the number of DIFFERENT people who used the tag, then most recent use, then A-Z. A tag needs at least 2 people; one person repeating a tag never trends. Top 5. It is a count over everybody (no person is named; Block and Mute do not change it). Hiding or removing the posts removes them from the count.
- Who to follow: people with an ACTIVE account (a suspended account is not suggested) who made a visible Social post in the last 30 days. Never yourself, people you already follow, people you blocked, people who blocked you, or people you muted. Ordered by how many of the people you follow follow them, then by a shuffle that stays the same for one person for one whole day (UTC). NOT ordered by number of followers. Top 5.
- Nothing is stored for this: no list of who was shown, no click record.
- Not decided yet: a Dismiss button on a suggestion, a way for staff to hide a tag from Trending, suggestions by interests or place, a person opting out of being suggested.

### 3.20 Notification settings (SOCIAL_TODO B8, decided 2026-11-08, PROVISIONAL)
- A person chooses which KINDS of notification they see: follow, like, repost or quote, reply, mention. Everything is on by default.
- A switched-off kind is not shown on the Notifications page and not counted in the bell. The notifications are kept (not deleted), so switching the kind on again shows them again. They are still part of "Download my data" (3.7) and are deleted at final erasure like all notifications.
- Only the switched-off kinds are stored. "Download my data" lists them; final erasure (3.7) deletes them.
- Limits: 20 saves per minute and 200 per day (server memory, TODO 50).
- The site sends NO email for notifications today, so there is no email setting. If email notifications are added later, they need their own switch that is OFF until the person switches it on.
- Not decided yet: a "mute everything" switch, quiet hours, not creating the notification at all for a switched-off kind.
