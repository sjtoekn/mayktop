patch-ads-my-list: /advertise/my has tabs, a number range and paging
====================================================================

WHY
/advertise/my showed every ad of the advertiser in one long list (up to 100, each with a preview and a 7-day table) and the numbers
were only "all time" plus the last 7 days. With many ads it is slow and hard to read, and an advertiser could not look at a longer period.

WHAT YOU GET (/advertise/my)
1. TABS with the number of ads in each:
   All | Running (running + paused) | Waiting (draft + sent + approved) | Rejected | Ended.
   10 ads a page, "Previous / Next", "Page N of M", "Showing 11-20 of 34" (MY_PAGE_SIZE in web/src/lib/ad-mine-list-rules.ts).
2. NUMBER RANGE (a row of buttons): Last 7 days (default) | Last 30 days | Last 90 days | All time.
   - 7 days: as before (all-time line + a line for the 7 days + the day-by-day table).
   - 30 / 90 days: all-time line + one line for that period (shown, clicks, click rate); the day-by-day table is on "Details and numbers".
   - All time: the all-time line only.
   Days are UTC days and today counts as one of them (same as the rest of the ads screens).
3. The tab and the range stay when you change the other one or the page. Unknown values in the address fall back to the defaults.
All buttons (pause / run again / end / edit / appeal) work as before.

NO migration, NO database change, nothing about visitors (ADS_PLAN decision 3 is kept).

INSTALL (make a backup zip first)
1. Unzip patch-ads-my-list.zip INTO the project folder (where PROJECT.md is). It replaces 3 ads-only files and adds 4 new ones.
   (Replaced: web/src/lib/ad-mine.ts, web/src/app/(site)/advertise/my/page.tsx, web/src/app/(site)/advertise/my/my.css.
    loadMyAds was removed from ad-mine.ts: only this page used it. loadMyAdsPage replaces it.)
2. In the project folder:   node apply-ads-my-list.mjs
   (adds 18 texts in all 6 languages, "test:ad-mine-list" to package.json, one line to CHANGELOG.md, a note to ADS_PLAN.md.
    Safe to run twice. It never replaces a shared file as a whole.)
3. In web/:
     npm run test:ad-mine-list   (logic tests, no database)
     npm run check:i18n
     npm run lint
     npm run build
4. Try by hand (log in as an advertiser with several ads):
   a. /advertise/my opens on "All", range "Last 7 days". The number in each tab matches its list.
   b. Click Running / Waiting / Rejected / Ended. Click "Last 30 days": the tab stays, each card with numbers gets a "Last 30 days: ..." line
      and no day table. "All time": only the all-time line. "Last 7 days": the table is back.
   c. With more than 10 ads in a tab: Next / Previous work, the range stays; /advertise/my?page=999 shows the last page;
      /advertise/my?view=abc&range=zzz shows All + 7 days.
   d. An advertiser with no ads sees the old empty message and no tabs. A tab with no ads shows "You have no ads in this list."
   e. Pause / run again / end / edit / appeal still work from the tabs.
   f. Logged out: the old "please log in" box.

NEW FILES
  web/src/lib/ad-mine-list-rules.ts   web/scripts/test-ad-mine-list.ts   apply-ads-my-list.mjs   README-patch-ads-my-list.txt
REPLACED FILES (ads-only, not shared with other chats)
  web/src/lib/ad-mine.ts   web/src/app/(site)/advertise/my/page.tsx   web/src/app/(site)/advertise/my/my.css

CHECKED IN THE BUILD CHAT
  npm run test:ad-mine-list passed; apply script run twice on a copy of the project (second run changes nothing);
  npm run check:i18n passed (1419 texts x 6 languages).
NOT CHECKED (the build chat has no installed packages): npm run lint, npm run build, the TypeScript check of the screen and the manual steps. Please run them.

NOT in this patch (next ideas)
  - Free dates (from / to). The ranges are presets; the details page has the last 60 days day by day.
  - "Run this ad again" for an ended ad; payment details and a refund request (TODO 46).
  - A live "N ads running now" number (TODO 46).
