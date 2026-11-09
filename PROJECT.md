# MaykTop — Project Goals & Work List

> Name: **MaykTop** (renamed from mayktuk on 2026-11-07; if it ever changes, edit it in one place: `web/src/config/site.ts`).
> Main language: **English**. Platform: **Web only** (no mobile app in the early years).
> Timeline: **~5 years**, no rush. Quality and fairness come before speed.
> Last updated: 2026-11-07

This file is the single source of truth for anyone (the owner, Claude, or a future team) who needs to understand what we are building and why. **Read this first. Update it whenever a decision changes.**

---

## 1. Vision

A community discussion website (Reddit-like) that is **fair to everyone**, **simple to understand**, and **beautiful**, and that is funded by **non-intrusive ads**, not by charging users.

## 2. Why we are building it (problems we want to improve)

Based on what people repeatedly complain about on forums, petitions and Reddit's own moderator discussions:

1. **Content removed without a clear reason.** Users report posts/comments or bans with no explanation, and no clear rule they broke. People also ask for clearer definitions of rules.
2. **Too much unchecked moderator power.** "Power moderators" control many large communities; decisions are hard to question.
3. **Popular/famous users dominate.** Visibility (e.g. top comments, top posts) favours already-popular accounts, so newcomers' good content is buried.
4. **Rules are hard to follow.** Reddit's own 2019 data said roughly 22% of posts in large communities were removed, mostly for not following formatting/community rules. Rules that people cannot easily understand create unnecessary removals and anger.
5. **Complexity.** Too many features, pages and concepts make the product hard for ordinary people.

## 3. Core principles (every feature must respect these)

1. **Fairness first.** A new user with a good answer must have a real chance to be seen. Popularity must not be the only thing that decides visibility.
2. **Simple, not low quality.** "Simple" means easy to understand, not fewer or poorer features. Anyone should understand a page in seconds. No clutter.
3. **No silent deletion.** Nothing is removed without (a) a visible reason tied to a specific rule, and (b) a way to appeal.
4. **Check before removing.** Do not remove content based only on who posted it or its name. A content-check step (is it actually harmful to the community?) comes first. Prefer "hidden pending review" over instant deletion.
5. **Shared power.** One person must not control many large communities. All moderator actions are recorded in a public log.
6. **Short, clear rules.** Each community has 3–5 plain-language rules, shown before posting.
7. **Ads must not hurt users.** Ads are necessary to sustain the site, but never ruin the experience (see section 5).
8. **Users are never charged** to use the core service.

## 4. Non-goals (for now)

- No mobile app (web only first).
- No paid subscriptions for users.
- No trying to copy every Reddit feature. Only what serves the principles above.

## 5. Advertising policy

- Fixed, clearly labelled ad slots only (e.g. sidebar, and a limited number of feed positions).
- No pop-ups, no auto-playing SOUND, no full-screen interruptions (a video ad may start by itself only silent, max 10 seconds, see section 8 ads decision 3 as changed 2026-11-08), no ads that look like real posts (a social ad is allowed only in the clearly different form of section 8i).
- Demo ad slots are built into the UI from day one so layouts are designed around them.
- Ad slots must never push the main content out of view.

## 6. Technology (decided)

- **Frontend/app:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Database (development):** SQLite via Prisma, running locally (no cloud account needed)
  - Installed (TODO 27): Prisma **7** + `better-sqlite3` adapter. Stay on major 7 (`prisma@prev`, `@prisma/client@7`) until we deliberately move to 8. Connection: `web/src/lib/prisma.ts`; schema: `web/prisma/schema.prisma`.
- **Database (production, later):** PostgreSQL via Prisma (switch is a small change)
- **Auth (Phase 2):** Auth.js (simple email/password first)
- **Not using Supabase** for this project (owner finds it troublesome).
- **Hosting:** decide later (Phase 5).

## 7. Phases and work list

Mark items `[x]` when done.

The **Social** section (short posts, likes, reposts, follows, notifications) has its own work list: `SOCIAL_TODO.md` (check with `node check-todo.mjs SOCIAL_TODO.md`). Its decisions are written in section 8j once made (SOCIAL_TODO item 1). Items there that depend on the main list say so, for example "(TODO 47)".

### Phase 0 — Foundation
- [x] Research common complaints about Reddit
- [x] Write this project document
- [x] Choose final project name (MaykTop)
- [x] Create the Next.js project and run it at `localhost:3000`
- [x] Set up folder structure, Tailwind, fonts, colour palette (light + dark)
- [x] Make a backup/zip and a changelog file (`CHANGELOG.md`)

### Phase 1 — UI only (no database needed; sample data)
- [x] Design system: colours, typography, buttons, cards, spacing
- [x] Layout: top bar, left navigation, main feed, right sidebar
- [x] Home page (feed with sample posts)
- [x] Community page (name, short rules box, posts)
- [x] Post page with comments (threaded, easy to read)
- [x] "Create post" page (shows the community's rules before posting)
- [x] Removal-reason display (shows when a post/comment was hidden: which rule, why, appeal button)
- [x] Public moderation log page (sample data)
- [x] Demo ad slots (sidebar + limited feed slots, clearly labelled "Ad") — now real ads (TODO 44, section 8i)
- [ ] Search bar UI
- [ ] Responsive layout (works well on phone browsers too)
- [ ] Empty/loading/error states
- [x] Dark/Light button (remembers the choice)
- [x] Popular, Explore, Top, Saved pages (sample data; Saved is an empty state until Phase 2)

### Phase 2 — Real data and accounts
- [ ] Database schema (users, roles, communities, posts, comments, votes, rules,
      reports, mod actions, audit log, appeals)
- [ ] Sign up / log in / log out
- [x] Email verification (TODO 31 part 1), password reset (TODO 31 part 2, patch-38)
- [x] Session management (see devices, log out other devices) — TODO 32, patch-39
- [x] Create, edit, delete own posts and comments (TODO 33, patch-40)
- [x] Join / leave a community (TODO 34, patch-41)
  - Deleting your own post/comment ERASES the title/text for good and hides the author, but keeps the row (replies, votes, audit log stay intact). Chosen 2026-11-07 so the site does not break privacy laws that give people a right to erasure. Not yet decided with a lawyer: how long to keep copies needed for safety/legal reasons, and what happens to the author link when an account is deleted (TODO: account lifecycle).
- [ ] Join / leave communities
- [ ] Voting
- [ ] Account settings: suspend, delete, export my data, recover account (full rules: **ACCOUNT_RULES.md**)
  - [x] Settings page, limited access for a suspended / banned / deletion-pending account (36a)
  - [x] Download my data (36b)
  - [x] Delete my own account, password asked again, 7 days to recover by logging in (36c; manual check pending)
  - [x] Staff suspend (1 admin) and permanent ban (2 admins), site rules + written reason, audit log, email, appeal box (36d, 36d2; manual check pending)
  - [x] Final erasure after the waiting time (`npm run purge`), safety record, email notices (36e; code done, manual check pending)
- [x] Profile text (display name, bio), change password, change email (patch-profile-security, rules in ACCOUNT_RULES.md 3.23; build + lint + manual check pending). Avatar upload and community creation are separate, not done.
- [ ] Language switcher: make `getLocale()` read the user's choice (cookie, later saved on the account); this makes it async, so every `t()` caller and `metadata` must be updated. Decided 2026-11-07 (TODO 25).

### Phase 3 — Fairness engine
- [x] Ranking that does not favour only popular accounts (new-user boost / randomised fairness window) — TODO 37, patch-37, rules in 8e (code done, manual check pending)
- [x] Hidden-pending-review flow instead of instant delete (TODO 38, patch-38h; rules in 8f)
- [ ] Mandatory removal reason + rule reference
- [x] Appeals system (removed posts / comments and suspensions / bans; a different person decides; TODO 40, see 8g; manual check pending)
- [ ] Public mod log (real data)
- [x] Limit on how many large communities one person can lead (TODO 42, see 8h; manual check pending)
- [ ] Rule templates (3–5 plain-language rules per community)

### Phase 4 — Ads and safety
- [x] Ad system: submission form, review queue, approve/reject, campaigns and
      budget, "Ad" labelling, frequency limits (built 2026-11-07, ADS_PLAN.md Sessions 1-7. "Frequency limits"
      became: fair rotation of all running ads + no repeat within an hour on the visitor's own device,
      consent-gated; max 2 ads in a feed page. Build + lint + manual flow still to be run by the owner.)
- [ ] Ad counting (impressions/clicks), invalid-click and bot protection
- [ ] Advertiser dashboard (aggregate results), billing, refunds/disputes
- [ ] Unified reporting (posts, comments, profiles, ads), priority levels,
      emergency escalation, decision notices, repeat-offender rules
- [ ] Admin panel: roles/permissions, user/content/report/ad management,
      system config, admin login security, approval rules for big actions
- [ ] Optional 2FA
- [ ] Spam protection, rate limits, bot/DDoS protection
- [ ] Privacy policy, terms, content policy (needs legal review)

### Phase 5 — Launch and team
- [ ] Security: API, database and file-upload checks, secret management
      (.env never in git), dependency updates
- [ ] Operations: backups AND a restore test, disaster recovery, monitoring,
      error logging, incident response plan
- [ ] Testing: full user journeys, security, performance
- [ ] Launch readiness checklist
- [ ] Hosting, domain
- [ ] Recruit team (legal, moderation, design, engineering) when funding allows
- [ ] Public beta, then a process for post-launch incidents and complaints

## 8. Open decisions

- Domain name for MaykTop (check it is free before buying; project name is decided)
- Fairness/ranking method: decided for the Popular page in 8e (PROVISIONAL numbers, to be tuned with real use); still open: ranking inside comments, and a sort choice (New / Top) on community pages
- Whether communities are open-creation or approval-based
- Ad network / ad provider

## 8b. Decide early (expensive to change later)

- [ ] **Languages:** English first. All UI text goes through a translation
      helper (no hard-coded text in components) so other languages can be
      added later. Store all times in UTC, show in the user's timezone.
- [ ] **Roles:** user / moderator / admin stored in the schema from Phase 2.
- [ ] **Never hard-delete:** content has a status (visible / hidden-pending-review
      / removed) with rule reference and reason.
- [ ] **Audit log:** every moderator/admin action is written to one table
      (who, what, when, which rule). The public mod log reads from it.
- [ ] **Ad targeting policy:** decide now (contextual-only vs profile-based);
      it changes the database design.

## 8c. Account removal and data retention (decided 2026-11-07, PROVISIONAL)

> The current, complete account rules (with what is already built and where it is in the code) are in **ACCOUNT_RULES.md**. This section and 8d are the decisions behind them.

No lawyer has reviewed this yet. It follows the usual practice of big platforms (Meta, Discord).
**A lawyer must review this section, and a public Privacy Policy must state it, BEFORE the site is opened to the public.** All numbers below are placeholders to be confirmed.

Principles (owner's rules): collect and keep as little about people as possible; give every person the fairest chance we can; no surprise erasure.

1. **Person deletes their own account.** Password is asked again. The account waits 7 days ("scheduled for deletion"); logging in during that time cancels it (recover). After 7 days everything that identifies the person is erased: email, name, profile, password hash, sessions, and the title/text of every post and comment (same erasure rule as deleting a single post). Rows stay as an anonymous shell so replies, votes and the audit log keep working.
2. **Two kinds of staff action.** *Temporary suspension* (for example 3 days): nothing is erased, the person returns automatically. *Permanent ban*: the person gets 7 days to download their data (data export) and to appeal; after that the account is erased as in point 1. Every action needs a rule and a reason (audit log).
3. **An open appeal stops the 7-day clock** until it is decided. If the appeal succeeds the account returns and nothing is erased.
4. **Safety record kept after erasure (minimal, never public, admin access only).** Only for banned accounts, accounts with an open report or appeal at the time of erasure, and when a legal request or legal hold exists: user id, a one-way hash of the email, the dates, the rule and reason, the audit-log rows, and a copy of the content that was reported or removed. Kept 180 days after erasure; up to 2 years if the account was banned for a serious violation; longer only under a legal hold or an official request. Deleted automatically afterwards. Normal self-deleted accounts with no report keep NO record.
5. **Backups.** Database backups are deleted within 90 days, so erased data leaves the backups too.
6. **The public Mod log** keeps the rule and reason but not the person's name after erasure.
7. The legal basis to keep point 4 is "legal obligations and establishing, exercising or defending legal claims" (GDPR Art. 17(3)(b) and (e)); the lawyer must confirm this for the countries we serve.

### 8c-36e. Decisions made while building the final erasure (2026-11-07, PROVISIONAL)

These fill the gaps the rules above left open. A lawyer must review them with the rest of 8c.
1. **Warning first, no surprise.** An email goes out when the erase date is under 24 hours away; no email sent = no erasure. The erasure itself happens only when the date has passed AND the warning is at least 12 hours old.
2. **An appeal stops the clock.** While an appeal is open nothing is erased. After it is decided, 3 more days pass and the person is warned again, so they can still download their data.
3. **Open reports do not delay erasure.** A report on a person's content does not stop them from leaving. Instead a safety record keeps a copy of the reported content (point 4 of 8c), so moderators can still decide the report.
4. **Ads the person booked** are ended when the account is erased; the contact email is erased. A paid ad stopped early is listed when `npm run purge` runs, so the owner can refund it by hand (refunds are TODO 46).
5. **Legal hold.** An admin can mark a person (before erasure) or a safety record (after) as held, with a written reason (audit log). A held record is never deleted automatically.
6. **The email code** in the safety record is an HMAC with a server secret, not a plain hash (a plain hash of an email can be reversed by guessing addresses).
7. **Erased shell:** username `deleted-<id>`, email `<id>@erased.invalid`; nothing else of the person is left in the `User` row.

## 8e. Fair ranking of the Popular page (decided 2026-11-07, PROVISIONAL numbers)

Why: complaint 3 in section 2 (popular accounts dominate, newcomers are buried). Code: `src/lib/ranking.ts` (pure, tested with `npm run test:ranking`); numbers: `rankingConfig` in `src/config/site.ts`; page: `/popular`; public explanation: `/fairness`.

Where it applies: ONLY the Popular page. Home and community pages stay newest first (that order is fair by itself), and search stays newest first. Ranking changes the order, it never hides a post: every visible post is in the list, hidden / erased posts are not (as before).

Three rules, in this order:
1. **Quality with limits.** Score = log2(1 + votes) x 0.5^(age / 72 hours). The 1000th vote counts far less than the 10th, and a fresh post with 5 votes beats a month-old post with 1000. A post with net votes below 0 always goes after the others (not hidden), the least downvoted first.
2. **One account cannot fill the page.** Every earlier post of the same author already placed halves the score of that author's next post.
3. **New voices get a fixed share.** Every 4th place is reserved for a post that is at most 48 hours old, has net votes of 0 or more, and whose author is a "new voice" (account younger than 30 days OR 3 or fewer visible posts). Inside the lane the order is log2(1 + votes) + a fair draw (0-2 points) that depends only on the post and a 6-hour window, so it is stable for a few hours and then changes. One author gets at most one reserved place. If the lane is empty, the place goes to the normal order.

**The label (decided 2026-11-07, patch-37b).** A post that really took a reserved place shows a small "New voice" label that links to /fairness ("Shown here so that new people get a real chance to be seen"). It marks the POST, only on the Popular page, and only when the post got its place from the reserved share: a new person whose post rises on votes alone gets no label. This is the same idea as "Why this ad?": say why you are seeing something. Never shown on Home, community pages, search or the post page.

What it does NOT use: follower counts, "karma", reading history, who the person is. Only votes, post age, and the author's account age and number of posts.

Abuse: a flood of new accounts can take at most 1 place in 4 (a test checks this); the reserved lane excludes downvoted posts; spam and bot protection is TODO 50, and a poor rule here is tuned in `rankingConfig` without touching the code. Known limit: new accounts need only a verified email, so this lane is not a defence against someone who makes many accounts; the fixed share only limits the damage.

Open: tune the numbers with real people (Phase 5 beta); whether votes by brand-new accounts should count less (TODO 50).

## 8d. Staff actions on accounts: how we keep them fair (decided 2026-11-07, PROVISIONAL)

Why: the owner was treated unfairly on other platforms (mass removals, banned without a reason). Rules for this site:

1. **Rule + written reason, always.** A site rule (HARASSMENT, HATE, ILLEGAL, SPAM, ABUSE, PRIVACY, IMPERSONATION; list in `staffConfig`, short and plain) and a written reason of at least 20 characters. Never silent: one audit-log row, and an email to the person with the rule, the reason, the dates, and how to export data and appeal.
2. **A ladder, not a hammer.** Temporary suspension is 1-30 days (nothing erased). A permanent ban is allowed at once only for the serious rules (HARASSMENT, HATE, ILLEGAL, PRIVACY); for SPAM, ABUSE and IMPERSONATION a ban needs an earlier suspension of the same person in the last 365 days. The code refuses anything else ("suspend first"). **A permanent ban needs TWO different admins:** one proposes it (rule + reason), another approves it with a written note; until then nothing happens to the person, and a proposal lapses after 7 days. A suspension needs one admin.
3. **Nobody judges themselves.** Staff cannot act on themselves or on other staff; an appeal is read by a different person than the decider (Phase 3 review tools).
4. **Judge the behaviour, never the person.** Nothing is done because of who someone is, how popular they are or what their name looks like; the decision is tied to a rule and a reason anyone can read.
5. **Always a way back.** Banned people keep reading, exporting and appealing for 7 days; an open appeal stops the clock (36e). `lift` ends a suspension or ban early with a written reason.
6. **Deleting yourself is not an escape.** A person waiting for deletion can still be banned (the ban clock then applies); a suspended or banned person cannot delete themselves.
7. Open for Phase 4: a staff action UI; removing admin rights (today `make-admin` only adds); the public Mod log shows these actions without the person's name (8c point 6). Until then staff actions run from the terminal: `npm run staff`.

## 8f. Hidden pending review: how content is removed fairly (decided 2026-11-07, PROVISIONAL)

Principle 3 and 4 (section 3): nothing is removed in one step, and never without a rule, a reason and a way to appeal. Built in TODO 38 (patch-38h); the code is `src/lib/review.ts`, the small rules are in `src/lib/review-rules.ts` (tested by `npm run test:review`), the numbers in `reviewConfig` (`src/config/site.ts`).

**Two steps, two different people.**
1. **HIDE.** A moderator of that community, or an admin, hides a visible post / comment. Its status becomes `HIDDEN_PENDING_REVIEW`: readers see "hidden for review" with the rule and the reason (the text is kept, nothing is erased), the author gets an email, one `CONTENT_HIDDEN` audit row is written (public on /modlog).
2. **DECIDE.** A DIFFERENT moderator / admin (never the one who hid it, never the author) reads the case and either **restores** it (`VISIBLE` again, `CONTENT_RESTORED`) or **removes** it (`REMOVED`: gone from the site, kept in the database, `CONTENT_REMOVED` on /modlog), and writes a note. The author is emailed each time.

**Always required:** a rule of THAT community that is still open (given by its number) and a written reason or note (same length limits as staff actions: `staffConfig`). The status change and its audit row are saved in ONE transaction (no action without a record). Nobody acts on their own post / comment; a post or comment the author already erased cannot be hidden. Open reports about the content follow: IN_REVIEW when hidden, ACTIONED when removed, DISMISSED when restored.

**Removed content stays explained (TODO 39, patch-39r).** A removed post / comment does not simply vanish: its page and its place in the comment thread show a notice "removed after review" with the rule and the reason (the text itself stays blank; lists, search and Popular still leave it out). The /modlog link to a removed post now opens that notice. `npm run review -- check` lists any hidden / removed item that has no rule, no written reason or no audit-log row (made by hand or by sample data); the normal code path cannot create one. Not shown to readers: the reviewer's note (it is in the mod log and in the author's email).

**Waiting.** Hidden content waits for the second person. After `reviewConfig.dueDays` (7) it is flagged OVERDUE in `npm run review -- pending`. Nothing changes by itself.

**Not decided yet / next steps:** (1) should hidden content come back by itself when nobody decides within some days (benefit of the doubt) or stay hidden (safer for victims)? Today it stays hidden and is only flagged. (2) A site with only one moderator cannot finish step 2: decide what happens in small communities (an admin from the site team decides?). (3) Done in TODO 40: a removal can be appealed (8g). (4) Reports from readers (the report button and form) are not built yet; the code already moves reports along. (5) Moderator panel instead of the terminal (Phase 4).

## 8g. Appeals: how a decision can be challenged (decided 2026-11-07, PROVISIONAL numbers)

Principle 3 (section 3): nothing is removed without a rule, a reason and a way to appeal. Built in TODO 40 (patch-40); the code is `src/lib/appeals.ts`, the small rules are in `src/lib/appeals-rules.ts` (tested by `npm run test:appeals`), the numbers in `appealConfig` (`src/config/site.ts`), the tool is `npm run appeals`.

**Two kinds, one table.** An appeal always points to the audit-log row of the decision it challenges (`Appeal.auditLogId`), one appeal per person per decision.
1. **Content appeal.** The AUTHOR of a post / comment that was REMOVED (the final step of 8f) opens "Appeal this decision" on the removal notice (`/appeal/post/<id>`, `/appeal/comment/<id>`, login needed, only the author sees anything), writes why (20-2000 characters), and may do so ONCE within 30 days of the removal. A post that is only HIDDEN is still waiting for its second reviewer, so it has no appeal button yet: the notice says a second moderator is checking it.
2. **Account appeal.** A suspended or banned person writes it on `/settings` (TODO 36d). Same table, same reviewing rules, reviewed by an admin.

**Who decides.** A moderator of THAT community or an admin (account appeals: an admin), and never (a) the appellant, (b) anyone who took part in the first decision: for content the person who hid it and the person who removed it (and anyone who restored it earlier); for a ban the admin who proposed it and the admin who approved it. The code refuses these ("a DIFFERENT person must decide"). The reviewer must write a note (same length limits as staff actions).

**What happens.**
- **Accepted.** Content: the post / comment is `VISIBLE` again with its rule and note cleared. Account: the suspension or ban ends, `eraseAt` is cleared. The appeal is `ACCEPTED`.
- **Rejected.** Nothing changes except the record; the appeal is `REJECTED` and cannot be repeated (one per decision). For a banned account the 3-day wait of 8c-36e applies before any erasure, and the person is warned again.
- Both: ONE transaction (appeal + change + `APPEAL_ACCEPTED` / `APPEAL_REJECTED` audit row, so no action without a record); the appellant gets an email in their own language with the reviewer's note. Content appeals appear on the public /modlog ("Appeal accepted" / "Appeal declined") with the original rule and the reviewer's note; account appeals do not (suspensions are not public, 8d).
- An OPEN appeal stops the erasure clock of a banned account (8c point 3, already built in `purge.ts`).

**Tool.** `npm run appeals -- list` (open appeals, oldest first, OVERDUE after 7 days), `show <number>` (the appeal, the first decision and the content), `accept|reject <person> <number> "<note>"`.

**Not decided yet / next steps:** (1) a small community with one moderator cannot get a different person for the appeal: today only an admin of the site team can (decide whether that is enough). (2) Nothing happens by itself when nobody answers: it is only flagged OVERDUE. (3) A second appeal level (to a panel of admins) is NOT built; the rule is one appeal per decision. (4) A reader who sees a post that was restored by appeal is not told that it was appealed (the mod log is the record). (5) Moderator panel instead of the terminal (Phase 4).

## 8h. Shared power: a limit on large communities per person (decided 2026-11-07, PROVISIONAL numbers)

Principle 5 (section 3) and complaint 2 (section 2): "power moderators" control many large communities. Built in TODO 42 (patch-42); the code is `src/lib/moderators.ts`, the small rules are in `src/lib/moderators-rules.ts` (tested by `npm run test:mods`), the numbers in `modConfig` (`src/config/site.ts`), the tool is `npm run mods`.

1. **Large = 1000 members or more** (`largeMemberThreshold`). A person may lead **at most 3 large communities** (`maxLargeCommunities`). "Lead" = have the MODERATOR role in a community that is not archived. Small communities are never limited.
2. **Where it is enforced.** `appointModerator` refuses the 4th large community ("limit"). The count is read inside the same database transaction as the change, so two appointments at once cannot both pass.
3. **Only an admin appoints or removes a moderator,** with a written reason (same length limits as staff actions); one audit-log row (`MODERATOR_ADDED` / `MODERATOR_REMOVED`, with the community) is saved in the same transaction. The last moderator of a community cannot be removed, so there is always someone (a moderator also cannot leave on their own, see `setMembership`). This is also how moderation is handed over.
4. **Nothing is taken away silently.** If a community grows past 1000 members, or the numbers are lowered, someone may lead more than 3 large communities. They keep their roles but cannot take another large one; `npm run mods -- check` lists them so an admin can hand some over.
5. **Not built yet:** there is no way to create a community from the site (open creation or approval is still an open decision in section 8), so the limit is only enforced when an admin appoints. When community creation is built, the creator becomes a moderator and MUST pass the same check. The moderator list is not shown publicly yet and moderator changes are not on /modlog (that log shows only actions on posts and comments).
6. **Open:** is 3 the right number, and is 1000 members the right line for "large" (a new site has no large communities yet)? Tune in `modConfig` after real use; should a community's own moderators be able to appoint a colleague (today: admin only)?

## 8i. Ad formats and social ads (decided 2026-11-07, PROVISIONAL numbers)

Part of TODO 44; the work plan is `ADS_PLAN.md` (decisions 10 and 11).

1. **Three formats: TEXT, IMAGE, VIDEO.** One ad has one format. Every format costs the same flat monthly fee. All three work in both slots (sidebar and feed).
2. **Media only from our own storage.** The advertiser uploads the file; we store it (outside `web/public/`) and serve it from our own address. An advertiser-hosted address is never shown, because the advertiser's server would see every visitor's IP, which breaks "no visitor data for ads" (ADS_PLAN decision 3). The click address (`destinationUrl`) is reached only through `/api/ad/click/[id]`.
3. **Video ads start by themselves, silent, max 10 seconds (changed 2026-11-08, replaces "video never autoplays").** No poster / thumbnail is needed: the ad is just the video. It starts silent while at least half of it is on screen, pauses when scrolled away, loops, and shows only the first 10 seconds (`adsConfig.media.videoSeconds`); a longer upload is cut to 10 seconds and its sound removed by the server when ffmpeg is installed (`src/lib/ad-video.ts`), and the player (`AdVideo.tsx`) stops at 10 s anyway. A click anywhere on the video opens the advertiser's link (through `/api/ad/click/[id]`). It does not start by itself when the visitor asked for reduced motion or Save-Data. No sound ever plays by itself, so section 5 stays true for sound.
4. **Provisional limits:** picture 5 MB (JPEG, PNG, WebP), video 50 MB upload (MP4, WebM; the saved file is the cut 10-second one). The advertiser may send a longer video: only 10 seconds are ever shown. Files are checked by their real content, not only by name.
5. **Social ads (built later, when the Social feed exists).** A social ad must be clearly different from a post: its own background and border, the "Ad" badge at the top, "Why this ad?"; the advertiser is shown as an advertiser, never as a person (no avatar, no profile link); no like, repost, comment or share buttons; nobody can reply. Same fair rotation, same formats, same fee. This is how "no ads that look like real posts" (section 5) stays true.
6. **Built (Session 3b):** image and video ads: the files travel with the form, are checked by their real content and stored in `web/storage/ads/`, and are served by `GET /api/ad/media/[file]` (only a file that belongs to an ad; an ad that is not running yet is visible only to its advertiser and admins). The picture box is a fixed 16:9 shape and shows the whole picture. A video shows its poster and the browser's play button; it downloads nothing until play is pressed. **Built (Session S, 2026-11-09):** the slot `SOCIAL_FEED`. In `/social` an ad goes after the 3rd and the 8th post (`SOCIAL_AD_AFTER` in `src/lib/ad-positions.ts`: never first, at most 2). Its look is `AdBox` variant `social` + `ad-social.css`: a thick dashed border and the ad colours (not the post card), the "Ad" badge first, "Advertiser: <site>", "Why this ad?", and nothing else: no avatar, no profile link, no like, repost, reply or share. A Social ad has no community (Social has none); the form hides that choice. It is shown only where the Social feed is shown (logged-in people).
7. **Decided in Session 7 (2026-11-07):** (a) Ad decisions are NOT shown on the public mod log in v1. The mod log is about community content; an ad rejection is between us and one advertiser, who sees the rule + written reason, can appeal, and every decision is in the audit log. Revisit if asked (it would be a separate list without advertiser contact data). (b) The privacy policy (TODO 51) must say: no visitor data is collected for ads (no user id, IP or cookie; only per-ad per-day totals; the optional one-hour memory stays on the visitor's own device, only after the visitor allows it, never with Global Privacy Control); advertiser data is the account link, contact email, the ad and the payment status. A lawyer must review it before the site opens. (c) Still open for the ad system: batch counter writes (TODO 50), disk space and backup of `web/storage/ads/` (TODO 56), billing, refunds and a live "N ads running" number (TODO 46).
7. **Open:** exact picture and video sizes (in pixels) are not checked in code (only the file size and the real type); the reviewer judges quality; how much disk space ad files may use and who backs them up in production (hosting notes, TODO 56); whether a reviewer needs a video thumbnail strip (Session 5).

## 8j. Social section (decided 2026-11-07, PROVISIONAL)

1. **What it is.** Short posts for quick thoughts, kept apart from community posts (longer posts that live inside a community). Separate tables, separate cards. The same fairness rules apply: fair ranking (8e), hide -> a different person decides (8f), a written rule and reason for every removal, appeals (8g).
2. **Replies: yes, threaded**, like community comments (new table, migration). Every reply can be hidden, removed and appealed in the same way as a post.
3. **Reposts: plain repost and quote repost, both.** One repost per person per post (the existing unique key). The quote text is the person's own text and is moderated like a post.
4. **Follow: open.** Anyone can follow anyone, no approval. Nobody can follow themselves. Private accounts (approval needed) maybe later, not now.
5. **Media: text, links and image upload. No video upload for now.** A YouTube link is shown as a video card (it never autoplays, section 5). An image link is shown as an image. Image upload: ONE image per post; JPG, PNG, WebP only (no SVG); at most 5 MB; stored on our own server for now. The file types and the size are proposed by Claude, not yet confirmed by the owner. Security checks come with TODO 52 and the same rules apply to community posts (TODO 59). **Built (patch-social-images, 4b):** image upload for Social posts with exactly these provisional limits (5 MB; at most 10,000 px on a side and 40 million pixels; JPEG, PNG, WebP; checked by real content), stored in `web/storage/social/`, shown only to logged-in people, rebuilt WITHOUT Exif / location data. The text of a post is still required. See ACCOUNT_RULES.md 3.15.
6. **Hashtags and @mentions: both in the first phase.** A hashtag is a link to the posts that use it. A mention notifies the person. Limit (provisional): at most 5 mentions in one post, one notification per person per post, plus the rate limits of TODO 50, so nobody can be flooded.
7. **Length: at most 5,000 characters** (as built now).
8. **Site-wide rules (decided 2026-11-07).** ONE rule list for the whole site: the same list is used for account actions (8d) and for hiding / removing social posts and replies (8f). The 5 keys that already exist in `staffConfig.siteRules` (HARASSMENT, HATE, ILLEGAL, SPAM, ABUSE) plus 2 new ones: PRIVACY (sharing someone's personal details, such as an address, phone number or ID, without their permission) and IMPERSONATION (pretending to be another person or organisation to deceive). Provisional: PRIVACY counts as `serious` (a ban is allowed for a first offence), IMPERSONATION does not. Promise: a post is never removed only because of its author's name, or because someone disagrees with it; every removal names one of these rules and gives a written reason.
9. **Who moderates social posts (decided 2026-11-07).** For now ADMINS ONLY. The person who hides a social post or reply is an admin and a DIFFERENT admin decides to restore or remove it (8f); nobody acts on their own post or reply. This needs at least 2 active admins. Later the site may add site-wide social moderators; if so, they get their own appointment rules in the style of 8h (written reason, audit-log row, a limit on how many such moderators one person can be). The "large communities" limit of 8h does not apply to admins.

10. **Limits on Social actions (SOCIAL_TODO 10, PROVISIONAL).** Posts: at most 5 in 10 minutes and 30 in 24 hours per person, counted from the posts already in the database (hidden and deleted posts count too, so deleting does not give a new turn). Likes and unlikes: at most 40 per minute per person (kept in server memory). The numbers are `socialLimits` in `web/src/config/site.ts`. The person is told plainly ("try again in N min"), nothing is punished. Text checks on the server, every time: control characters and bidi-override characters are removed, line endings fixed, more than two empty lines in a row become two, a post with no visible character is refused, at most 5,000 characters. Joiners and direction marks that Sinhala, Hindi and Arabic need are kept. A shared limiter for many servers and limits for everything else (comments, votes, sign-up) stay in TODO 50.
11. **Social posts are for logged-in people only (decided 2026-11-07).** Community posts stay open to everybody, logged in or not. Social posts (the feed, a single post, a profile's Social tab, search results) are shown only to a person who is logged in; a visitor sees a short "log in to see Social posts" message and the posts are not even read from the database for them. Reason: privacy and safety, short personal posts are not shown to the whole internet or to search engines. Logged-in Home shows Community and Social posts mixed; logged-out Home shows Community posts only. Every new place that shows Social post text must follow this rule (SOCIAL_TODO 14, 24, 25, 28); this includes page titles and link previews. Liking and posting already needed a login.

8j.16 Repost and quote repost (decided 2026-11-07, SOCIAL_TODO 16)
- Two kinds: a plain repost (no text) and a quote repost (the person's own text above the original). ONE row per person per post: a person cannot repost the same post twice, and cannot have a plain repost and a quote of it at the same time. Quoting a post you already reposted turns that repost into a quote (the quote text is replaced when you quote again). The repost button on a reposted post undoes it (plain or quote).
- Reposting your OWN post is allowed (owner's decision). You get no notification for it.
- Only a logged-in ACTIVE account can repost, quote or undo. A post can be reposted or quoted only while it may be shown (visible, not deleted, author's posts shown: same rule as the feeds). Undo is always allowed.
- The quote text is cleaned like a post (at most 5,000 characters, no control or bidi-override characters, not empty).
- The author gets ONE `SOCIAL_POST_REPOST` notification per person per post, ever (repost, undo, repost again, or turning a repost into a quote never adds another). Nobody is told about an undo.
- Limits: 30 per minute and 300 per 24 hours per person (`socialLimits.reposts`), reposts, quotes and undos together.
- Shown in the feeds (/social and Home): a plain repost is "<name> reposted" and the original card; a quote is the quoter's card with the original inside it. A repost sorts into the feed at the moment it was made, not at the original's time. A repost disappears from the feeds when the original is hidden, removed or deleted, or when either account is not shown, and comes back with them. On /social/<id> the quotes of that post are listed under "Quotes". Social posts, reposts and quotes are only for logged-in people (8j.11).
- NOT done in this item (later items): hiding / removing a quote text and appealing it (item 27-29: a quote is the person's own text and must get the same hide -> second reviewer -> removal reason -> appeal path as a post; this needs a status column on `SocialRepost`); the Following feed (17); the notification page (21); the Report button (30); fair ranking of reposts (31).

## 9. How to work on this project (for Claude / collaborators)

- Owner has **limited coding knowledge**: explain steps simply, give complete files and exact terminal commands, and say where each file goes.
- Build **one item at a time** from the list above; tick it off here when done.
- Keep the UI simple and consistent. Do not add features that are not on this list without asking.
- Back up before big changes.
- For each item: decide → design → document → build → test. An audit alone
  is never "done".

## 8e-2. Fair ranking of replies and reposts (SOCIAL_TODO B10, decided 2026-11-08, PROVISIONAL numbers)
Written in full in ACCOUNT_RULES.md 3.22. Short version: replies under a Social post can be ordered "Oldest" (default) or "Top"; "Top" is the Popular-page engine (8e) applied to reply likes, so quality counts with limits, one account cannot fill the list, and new voices get a fixed share (every 4th place). Plain reposts of the same post inside one feed page are merged into one line. The feed itself stays newest first (8j).
