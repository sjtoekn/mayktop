# MaykTop — TODO 44 Ad System: work plan (multi-session)

> Owner works in Sinhala; project docs are in English. Replies to the owner: Sinhala.
> Put this file in the project root next to PROJECT.md. Tick items `[x]` when done and update the "Status" line at the bottom.
> Plan changed 2026-11-07 (second time): ad formats TEXT / IMAGE / VIDEO and social ads added (decisions 10 and 11). Session 3 is split into 3 and 3b.

## 0. Decisions (already agreed — do not re-debate)

1. **Flat monthly fee** per slot (example: $10 / month). NO pay-per-click, NO pay-per-impression, NO bidding, NO wallet.
2. **Contextual only.** An ad is chosen by slot + page/community, never by the viewer's profile or history.
3. **No personal data about visitors.** No user id, no IP, no visitor cookie in the database. Only per-ad per-day totals (impressions, clicks).
4. **Only data we keep about an advertiser:** account link + contact email + the ad itself + payment status.
5. **No silent rejection.** Every reject has a rule + a written reason, is written to `AuditLog`, and can be appealed (same spirit as PROJECT.md principle 3).
6. **Ad policy in code** (PROJECT.md section 5): visible "Ad" badge, fixed slots only, max 2 feed ads per page, no pop-ups, no autoplay, must not look like a post.
7. **First payments are manual** (bank transfer / invoice; admin ticks "paid"). Card payments, refunds, disputes = TODO 46.
8. Stack: Next.js 16 + Prisma 7 + SQLite (dev). Every new user-facing text must be added in **all six languages** (see `src/i18n`). Reuse `.card-ad` and `AdSlot.tsx`.
9. **Many ads, fair rotation (changed 2026-11-07).** The price is low, so the site needs hundreds or thousands of ads running at once. There is NO cap on active ads per slot. All active ads share the slots equally:
   - **Fair share:** the server builds a pool (`rotation.poolSize`) from ads that have had the fewest impressions so far this period, with a random element, so every paid ad gets roughly the same share and nobody is stuck at the back.
   - **No repeat within one hour:** the browser remembers only "ad id + time shown" for the last hour on the visitor's OWN device (never sent to or stored by the server), and picks from the pool an ad it has not shown in that hour. If every ad in the pool was shown lately, it shows the one shown longest ago, so a slot never stays empty.
   - **Consent:** this device memory is used only after the visitor allows it, and never when the browser sends Global Privacy Control (same rule as the old project). Without it, ads rotate randomly (repeats are rare when many ads run). The owner/lawyer confirms this at TODO 51; until then keep it consent-gated.
   - **Honesty:** advertisers are told on `/advertise` that the fee buys a fair share of the rotation, NOT a promised number of views, and that real totals are shown in their dashboard. Visitors get a small "Ad" label with a "Why this ad?" note: ads are chosen by page, not by you, and they rotate.
   - Per-user caps counted on the server are still NOT built.
10. **Ad formats: TEXT, IMAGE, VIDEO (decided 2026-11-07).** One ad has exactly one format; every format costs the same flat fee. (This replaces the earlier "text-only in v1" idea.)
    - **Media only from OUR OWN storage.** The advertiser uploads the file; we store it and serve it from our own address. NEVER show an advertiser-hosted address: the advertiser's server would see every visitor's IP, which breaks decision 3. `destinationUrl` (where a click goes) stays an advertiser address, but it is reached only through `/api/ad/click/[id]`.
    - **Store files OUTSIDE `web/public/`** (for example `web/storage/ads/`) and serve them through our own route (for example `GET /api/ad/media/[file]`). Reason: in a production build, files added to `public/` after the build are not reliably served.
    - **Image ad:** one picture (JPEG, PNG or WebP). **Video ad:** one video (MP4 or WebM) + a **poster picture** (required; same limits as an image ad's picture). **Text ad:** title + text only.
    - **Video never autoplays.** It shows the poster, with a clear play button; it plays only after the visitor presses play (PROJECT.md section 5: no auto-playing sound/video). A video ad's impression is counted when the box is on screen, exactly like other ads (not when the video plays).
    - **Provisional limits** (`adsConfig.media` in `site.ts`): picture 5 MB, video 30 MB. The video length in seconds is NOT checked by code in v1 (it would need ffmpeg); the size limit and the reviewer do that job. Raise the limits later if needed.
    - **Files are checked by their real content, not only by name or declared type** (as the old project did for images), the stored name is random, and nothing the advertiser typed is used as a path.
    - Every format is allowed in both slots (SIDEBAR and FEED); the box adapts to the slot width with CSS.
11. **Social ads (decided 2026-11-07; built LATER, when the Social section is built).** The Social section is only starting (tables `SocialPost`, `SocialPostLike`, `SocialRepost` and `/social/submit` exist; no feed yet). When the Social feed exists, ads will be allowed in it, with ONE hard rule so PROJECT.md section 5 ("no ads that look like real posts") stays true: **a social ad must be clearly different from a post**:
    - its own background colour and border (not the post card style), the "Ad" badge at the top, and "Why this ad?";
    - the advertiser appears as an advertiser, never as a person: no avatar, no profile link, no follow button;
    - NO like, repost, comment or share buttons, and nobody can reply to it;
    - the same fair rotation, the same formats (text / image / video) and the same flat fee;
    - how many appear per screen follows the same limit as feed ads (`FEED_AD_AFTER`-style rule, set in code).
    - **Prepare now, build later:** the ad component (`AdBox.tsx`) is written with a `variant` (sidebar / feed) from Session 3b, so adding `social` later is one new file, not a rewrite. The slot value `SOCIAL_FEED` is added to `AdSlotType` only when the Social feed is built (tiny migration).
    - Old project reference for the idea only: `components/advertising/SponsoredSocialPost.tsx` (it looks like a post; ours must look different).

## 1. About the OLD project (`1-Videos-AI-AGENT-CODE-20261030.zip`)

It uses raw SQL + Postgres + uuid, pay-per-click pricing, wallet, PayPal, revenue share and a visitor cookie. **Do NOT port that logic.** Code cannot be pasted directly (different DB layer). Use it only as a reference for UI and flow:

| Take as reference | Old file(s) |
|---|---|
| Create-ad form steps + field validation | `components/advertiser/CreateAdWizard.tsx`, `lib/advertising/validate.ts` |
| Ad formats, limits, file types | `lib/advertising/catalog.ts` (`AD_FORMATS`, `LIMITS`) |
| Upload of image / video + content check (stored on our own disk) | `app/api/advertising/ads/[id]/media/route.ts` |
| Video ad card | `components/advertising/AdVideoCard.tsx` |
| Ad preview | `components/advertiser/AdPreview.tsx` |
| Admin review list + approve/reject | `app/admin/advertisements/page.tsx`, `lib/advertising/review.ts` |
| Advertiser "my ads" + stats chart | `components/advertiser/AdvertiserDashboard.tsx`, `PerformanceChart.tsx` |
| Ad tracking beacon | `components/advertising/AdTracking.tsx` |
| Soft frequency (optional, later) | `lib/advertising/frequency.ts` |

**Skip completely:** `wallet.ts`, `billing.ts`, `paypal.ts`, `revenue-share*.ts`, `click-rates*.ts`, `share-*`, `api/advertising/visitor`, `*-promotions` pages, the "carousel" format, and the automatic placement engine (`getAutoPlacementKeys`; we have only two slots).

## 2. Sessions (one per chat / account)

Each session is small enough to finish in one chat. Do them in order.

### Session 1 — Database
- [x] Prisma models: `AdCampaign` (advertiser, title, text, optional image, destination URL, slot type, optional community, start/end date, monthly price, status, paymentStatus, review rule + reason), `AdDailyStat` (adId, date, impressions, clicks; unique adId+date)
- [x] Enums: `AdStatus` (DRAFT, SUBMITTED, APPROVED, REJECTED, ACTIVE, PAUSED, ENDED), `AdSlotType`, `AdPaymentStatus`
- [x] Add `AuditAction` values (AD_APPROVED, AD_REJECTED, AD_PAUSED, AD_RESTORED) + `AuditTarget.AD`
- [x] Migration, update `DATABASE.md`, small seed (3 sample ads)
- [x] Price + slot list in `src/config/site.ts` (one place)

### Session 2 — Serving + counting
- [x] `getAdPool(slot, community?)` in `queries.ts`: status ACTIVE + inside dates, fewest impressions first with randomness, `rotation.poolSize` ads (cached briefly)
- [x] Client picker in `AdSlot`: reads the pool, uses the one-hour browser memory (consent-gated, see decision 9), shows one ad
- [x] Consent, simplest form: no banner. In-page memory (lost on reload) is always used; the one-hour memory in localStorage is an opt-in switch inside "Why this ad?" and is never used when Global Privacy Control is on (`src/lib/ad-memory.ts`)
- [x] "Why this ad?" note on every ad
- [ ] Performance: batch counter writes (NOT done: each counted event is one small upsert, fine for SQLite and early traffic; revisit with TODO 50 / PostgreSQL)
- [x] `AdSlot.tsx` reads real ads; fallback "Advertise here" house ad when none
- [x] Click redirect `/api/ad/click/[id]` (+ `rel="sponsored noopener"`), aggregate counter only
- [x] Impression count (once per page view; ignore bots by User-Agent; simple rate limit)
- [x] Check "Ad" badge and policy rules are enforced in the component
- Built: `AdSlot.tsx` (server wrapper, same exports) -> `AdBox.tsx` (client), `GET /api/ad/pool`, `POST /api/ad/impression`, `GET /api/ad/click/[id]`, `src/lib/ad-guard.ts`, `src/lib/ad-stats.ts`, `getAdPool` in `queries.ts`. Impression = ad at least 50% on screen, counted once per page view.

### Session 3 — Advertiser: submit form (formats + text ads)
- [x] Small migration `ad_formats`: new enum `AdFormat` (TEXT, IMAGE, VIDEO) and `AdCampaign.format` (default TEXT, so the 3 seed ads stay valid), new `AdCampaign.videoUrl String?`. (`imageUrl` is reused: the picture of an IMAGE ad, or the poster of a VIDEO ad.) Update `DATABASE.md`. The app checks that `imageUrl` / `videoUrl` are always OUR OWN media addresses (start with `/api/ad/media/`), never an outside address.
- [x] `adsConfig.media` in `site.ts` (picture and video size limits, allowed types) — one place (decision 10)
- [x] `/advertise` page (what it is, price, formats, rules, no tracking promise, and the honest rotation notice: fair share, no promised number of views)
- [x] `/advertise/new` form (login required): choose format (Text / Image / Video), slot, community, dates, title, text, URL, live preview. In this session only TEXT can be submitted; the Image and Video choices are shown as "coming next" and disabled (they are switched on in Session 3b).
- [x] Validation (URL must be https, length limits, banned words list basic), saves as DRAFT then SUBMITTED
- [x] Link the house ad ("Your ad could be here") to `/advertise` once that page exists

### Session 3b — Image and video ads (own storage)
- [x] Upload (server only, login required), NOT a separate route: the files travel with the form in ONE server action (`createAd(FormData)` in `advertise/new/actions.ts`) and are saved by `submitAd` (`ad-submit.ts`) to OUR folder `web/storage/ads/` (outside `public/`; folder can be changed with the `AD_MEDIA_DIR` setting): size limits, content check by the first bytes (`ad-media.ts`), random file name (`ad-storage.ts`). Reason: no half-finished upload, no orphan file when the ad is not saved (the files are deleted again if saving fails)
- [x] Media route `GET /api/ad/media/[file]`: serves the stored file with the correct type; only a file that belongs to an ad (found by its address in the database); ACTIVE ads public with a one-day cache, any other status only for the advertiser or an admin (`private, no-store`); Range requests supported (videos start and skip in Safari too); `nosniff` and a sandbox CSP header
- [x] `/advertise/new`: Image and Video switched on (video also asks for the poster picture); live preview for each format from the chosen file (nothing uploaded until "send"). Changed on purpose: no DRAFT yet (the ad is saved as SUBMITTED, as in Session 3), so there are no draft files to remove; when Session 4 adds DRAFT, its files are handled there
- [x] `getAdPool` sends `format`, `imageUrl`, `videoUrl`; `AdBox.tsx` + new `AdMedia.tsx` render TEXT / IMAGE / VIDEO (the admin review shows the same `AdMedia`). It is written with a `variant` (sidebar / feed) so the later `social` variant is one new file (decision 11). Video: poster + play button, never autoplay, impression is counted as before, click on the ad text/button still goes through `/api/ad/click/[id]`
- [x] "Why this ad?" and "Ad" badge on all three formats; no layout shift (the media box is a fixed 16:9 shape before the file loads; the picture is shown whole, never cropped)
- [x] Erasure: when an advertiser account is erased (`purge.ts`), the media files of their ads are deleted from disk after the commit and the addresses are cleared in the rows. (Data export: the ad is not in `export` yet; when TODO 46 / Session 4 adds it, list the ad, not the file.)
- [ ] Decide / note: how much disk space the ad files may use, and who backs them up in production (goes into TODO 56 hosting notes). STILL OPEN: the files live in `web/storage/ads/` and are NOT in the database; a backup must copy that folder too (a database backup alone loses the pictures and videos)

### Session 4 — Advertiser: my ads
- [x] `/advertise/my` list with status badges, the rejection rule + written reason, dates, fee, and the picture / poster (patch-ads-s4a). NOT yet: the appeal button (see Session 4b)
- [x] Aggregate stats per ad (impressions, clicks, CTR, last 7 UTC days as a table; patch-ads-s4a)
- [x] Pause / run again by the advertiser (patch-ads-s4a, no migration): `src/lib/ad-own.ts` + `ad-own-rules.ts`. Only the advertiser's own ad; pause = ACTIVE -> PAUSED; run again = PAUSED -> ACTIVE only if the advertiser paused it (the newest `AD_PAUSED` audit row is theirs; an ad paused by our team stays paused until our team restores it) and before the end date. Both write an audit row in the same transaction (`AD_PAUSED` / `AD_RESTORED`, actor = the advertiser). The days of the paid period keep counting while paused (the page says so).

### Session 4b — Edit, end, appeal (NOT built yet)
- [x] Edit (patch-ads-s4b): only a REJECTED ad, from `/advertise/my/<id>/edit`: title, text, link and contact email (same checks as a new ad). Format, slot, community and the picture / video stay as they were (a new ad is needed to change them). Sending it again puts it back to SUBMITTED, clears the rejection from the ad (it stays in the audit log) and writes `AD_RESUBMITTED`. A running ad is never edited behind the reviewer's back. DRAFT is still unused.
- [x] End an ad yourself (patch-ads-s4b): withdraws a waiting ad or stops a running / paused one for good; new audit action `AD_ENDED` (migration `20261107220000_ad_own_actions`). Money is not returned automatically (refunds = TODO 46).
- [x] Appeal of an ad rejection (patch-ads-s4c): the advertiser opens `/advertise/my/<id>/appeal` (own REJECTED ad only, once per rejection, within `appealConfig.windowDays`, written reason). It uses the SAME `Appeal` table (it points at the `AD_REJECTED` audit row; no table change) and the same open-appeals screen `/admin/appeals` (kind "Ad"). Only an ADMIN decides, never the advertiser and never someone who approved or rejected that ad before (`checkDecideAppeal`, kind `ad`). Accepting makes the ad APPROVED (it runs once it is paid); rejecting changes only the record. Both are written to the audit log (`APPEAL_ACCEPTED` / `APPEAL_REJECTED`, target AD) and the advertiser is emailed. While an appeal is open the ad cannot be edited and sent again. Rules in `ad-appeal-rules.ts`, work in `appeals.ts` (`fileAdAppeal`, `loadAdAppealInfo`, `getAdAppealView`).
- [x] "Ending soon" email (patch-ads-s4c): once per ad, when a running / paused ad is at most `adsConfig.endingSoonDays` (3) days from its end date; nothing is renewed or charged automatically. New column `AdCampaign.endingSoonNoticeAt` (migration `20261108090000_ad_ending_soon`) is set BEFORE sending, so it is once per ad even with two runs at once; if sending fails the mark is removed and the next run tries again. It runs when the admin Ads screen opens and with `npm run ad:notices` (put that on a schedule in production: TODO 56). Rules in `ad-notice-rules.ts`, work in `ad-notices.ts`.
- [x] Ad in the data export (patch-ads-s4c): `ads` now lists format, slot, community, dates, price, status, payment, `submittedAt`, `paidAt`, the rejection rule + reason and whether a picture / video exists (`hasPicture`, `hasVideo`), never the files; `appealsYouMade` says what each appeal was about (`about`: type, id, decision).

### Session 5 — Review queue
- [x] Review page for admin role (check `Role` enum; guard on server). The reviewer sees the ad exactly as visitors will (picture, or video with play controls). (built in patch-admin8: `/admin/ads`, `ad-review.ts`)
- [x] Approve / reject with required rule + reason, writes `AuditLog` (patch-admin8)
- [x] Reviewer cannot review their own ad; appeal goes to a different reviewer (patch-admin8 for the review; the appeal to a different admin is patch-ads-s4c)
- [x] Ad decisions visible in public mod log? (decide: yes, without advertiser contact data) DECIDED in Session 7 (2026-11-07): NO, not in v1. The public mod log is about community content (post / comment, community, moderator). An ad rejection is a private matter between us and one advertiser, and the advertiser already sees the rule + written reason, can appeal, and every decision is in the audit log. Revisit if advertisers or the public ask for it (it would need a separate "ad decisions" list with no advertiser contact data).

### Session 6 — Lifecycle + payment (manual)
- [x] Admin marks "paid" and sets start date; APPROVED + paid -> ACTIVE (patch-admin8)
- [x] Auto-END after end date (check on read, or small scheduled job) (patch-admin8: checked when the admin Ads screen is read)
- [ ] (Removed: no cap on ads per slot. Rotation decides.) Show advertisers how many ads are running now and their own share, honestly NOT built (Session 7): the honest rotation notice is on `/advertise` and in the "running" email, and `/advertise/my` shows each ad's real totals; a live "N ads running now" number is optional and moves to TODO 46 (advertiser dashboard).
- [x] Contact email for advertiser notices (approved / rejected / ending soon) using `src/lib/email.ts` (approved / rejected / running: patch-admin8; ending soon: patch-ads-s4c)

### Session 7 — Finish
- [ ] `npm run build` + `npm run lint` clean, test full flow by hand (text, image and video ad, each from submit to visible) Session 7 could not run them (the build chat has no installed packages): the owner runs the commands in `README-patch-ads-s7.txt` and ticks this line. Logic tests (`npm run test:ads`) and `npm run check:i18n` passed in the build chat.
- [x] All new texts in six languages (checked in Session 7 by the new `npm run check:i18n`: 0 missing, 0 extra, every `t("...")` key used in the code exists)
- [x] Update `TODO.md` (44 done; note changed meaning of "frequency limits"), `PROJECT.md` (Phase 1 demo ad slots, Phase 4 item), `CHANGELOG.md` (patch-N), `DATABASE.md`, `DESIGN.md` if styles added (patch-ads-s7)
- [x] Note for TODO 51: privacy policy must say "no visitor data collected for ads"; lawyer review still needed (written into the TODO 51 line of TODO.md)

### Later — Session S: social ads (only after the Social feed exists)
Not scheduled. Start it when the Social section has a working feed (decision 11).
- [x] Add `SOCIAL_FEED` to `AdSlotType` (small migration) and to `adsConfig.slots` (patch-ads-sS; migration `20261109090000_ad_social_slot`)
- [x] New component for the `social` variant of `AdBox`: clearly different from a post, no like / repost / comment / share buttons, no avatar or profile link (decision 11) (patch-ads-sS: `AdBox` variant "social" + `ad-social.css`: dashed thick border, ad colours, "Ad" badge first, "Advertiser: host", no avatar / profile link / like / repost / reply / share)
- [x] Place it in the social feed with the same fair rotation; set how many appear per screen in code (patch-ads-sS: after the posts at `SOCIAL_AD_AFTER` = 3rd and 8th, max 2, never first; `src/lib/ad-positions.ts`; only on `/social`, which is for logged-in people)
- [x] `/advertise/new` offers the social slot; the review queue shows the ad in its social form (patch-ads-sS: the page choice is hidden for it, the community is always empty; `/admin/ads` and `/advertise/my` name the slot, the admin preview uses the social look)
- [x] Update `PROJECT.md` 8i and `DATABASE.md` (patch-ads-sS)

## 3. Rules for every session (to avoid losing context)

1. Owner uploads: the **latest project zip** + this file (+ old zip only if the session needs a UI reference).
2. Claude first reads `PROJECT.md`, `TODO.md`, last entries of `CHANGELOG.md`, `DATABASE.md`, this file.
3. Do ONE session only. Do not start the next one.
4. End of session: build + lint pass, tick items here, add a CHANGELOG entry, and give the owner the **changed files / updated zip** to download. (Work done in a chat is lost if the owner does not download it.)
5. If something in section 0 must change, edit it here and in PROJECT.md in the same session.

## Status
Last finished session: 2 (serving + counting, patch-43). Session 1 was verified on the owner's machine (migrate, generate, build, lint, seed all passed). Session 2 logic tests (picker, bot filter, rate limit) passed in Node; `npm run build` / `lint` still need to be run on the owner's machine. Decision 9 (many ads + fair rotation + one-hour browser-only no-repeat) is implemented. Plan change 2026-11-07 (patch-43b, documents only): decisions 10 (formats TEXT / IMAGE / VIDEO, own storage) and 11 (social ads, later) added; Session 3 split into 3 (form + text ads) and 3b (image + video). Session 3 done (patch-ads-s3). Session 3b done (patch-ads-s3b: image and video ads, own storage; `npm run build`, `lint` and the manual flow still to be run on the owner's machine). Session 4a done (patch-ads-s4a: `/advertise/my`, totals, pause / run again; `npm run test:ad-own` passed in the build chat, `npm run build` / `lint` and the manual flow still to be run on the owner's machine). Session 4b done in part (patch-ads-s4b: end + edit / resubmit; after copying run `npx prisma migrate dev` and `npx prisma generate`). STILL OPEN from 4b: appeal of a rejection, "ending soon" email, ad in the data export. Session 4c done (patch-ads-s4c: appeal of an ad rejection, \"ending soon\" email, ad in the data export; after copying run `npx prisma migrate dev` and `npx prisma generate`; `npm run test:ad-appeal` passed in the build chat, `npm run build` / `lint` and the manual flow still to be run on the owner's machine). Session 7 done in part (patch-ads-s7: documents, `npm run test:ads`, `npm run check:i18n`; decision: ad decisions are NOT on the public mod log in v1). STILL TO DO by the owner: `npm run build`, `npm run lint` and the manual flow of `README-patch-ads-s7.txt` (text, image and video ad from submit to visible); then tick that line. TODO 44 is ticked in `TODO.md` with this note. Still open and NOT part of the ad system v1: batch counter writes (TODO 50), disk space + backup of `web/storage/ads/` (TODO 56), a live "N ads running" number (TODO 46), billing / refunds (TODO 46), social ads (Session S, later).

## Session S done (patch-ads-sS, 2026-11-09)
Social ads are built: slot `SOCIAL_FEED`, the social look, two places in `/social`. After copying run `npx prisma migrate dev` and `npx prisma generate`; `npm run test:ad-social` passed in the build chat; `npm run lint`, `npm run build` and the manual flow of `README-patch-ads-sS.txt` are still to be run on the owner's machine. Not in this session: ads on the single post page `/social/[id]` (none on purpose), the Following feed (SOCIAL_TODO 17: when it exists, use `isSocialAdPosition` there too).

## Rule 6 (added after Session 2)
Shared files that other chats also change (`web/src/i18n/messages/*.ts`, `web/src/lib/queries.ts`, `web/src/config/site.ts`, `CHANGELOG.md`, `TODO.md`, `DATABASE.md`, `web/prisma/schema.prisma`) are NEVER shipped as whole files. Ship a small apply script (like `apply-ads-s2.py`) that adds only the ads parts and is safe to run twice. Owner makes a backup zip before applying anything.

## Note from patch-admin8 (admin Part 8)
The admin side of Session 5 (review queue: approve / reject with an ad rule + written reason, nobody reviews their own ad) and of Session 6 (admin marks "paid", APPROVED + paid -> ACTIVE with dates `adsConfig.periodDays`, auto-END when the end date has passed, email notices approved / rejected / running) is built in `src/lib/ad-review.ts` and `/admin/ads`. STILL OPEN: the advertiser side (Sessions 3, 3b, 4: submit form, my ads, edit / resubmit), so today an ad can only reach SUBMITTED by seed or by hand; an APPEAL of an ad rejection (the `Appeal` table has only content and account appeals); "ending soon" emails; whether ad decisions appear on the public mod log (Session 5 question).

## Note from patch-ads-s3 (Session 3)
Built: `/advertise` (public info page), `/advertise/new` (login required; live preview; only TEXT can be sent, IMAGE and VIDEO are shown disabled until Session 3b adds them to `adsConfig.formatsOpen`), `src/lib/ad-input.ts` (all checks, `npm run test:ad-input`), `src/lib/ad-submit.ts` (limits + save), migration `ad_formats` (`AdFormat`, `AdCampaign.format`, `AdCampaign.videoUrl`). Differences from the plan, on purpose: (1) the ad is saved straight as SUBMITTED (not DRAFT first), because there is no "my ads" page yet to open a draft from; DRAFT is used from Session 4 (edit + send again). (2) The advertiser chooses only an optional EARLIEST START DATE, not an end date: the flat fee covers one period (`adsConfig.periodDays`), and `runDates` in `ad-review-rules.ts` already honours a future start date. (3) The wording filter (`adsConfig.blockedPhrases`) is a small English-only first filter; an admin still reads every ad. (4) No appeal of an ad rejection yet (Session 4 / later). The "how it works" text on `/advertise` therefore does not promise one.
