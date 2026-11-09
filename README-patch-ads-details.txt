patch-ads-details: details page for each ad (shown, clicks, click rate, day by day) for the advertiser AND for the admin
==========================================================================================================

WHAT YOU GET
1. /advertise/my/<id>   (advertiser, own ad only)
   Cards: times shown, clicks, click rate, shown in the last 7 days (and the change vs the 7 days before),
   average per day, best day. Progress bar of the paid period (day N of M). A bar chart (shown per day and clicks per day,
   last 60 days) and a table of every day. A "Details and numbers" button on every ad of /advertise/my.
2. /admin/ads/<id>      (admin, any ad)
   The same numbers + who sent it, contact email, link, fee, paid date, and the HISTORY of decisions
   (approved, rejected, paid, paused, restored, ended, appeal...). A "Details and numbers" button on every ad of /admin/ads.
3. /admin/ads/stats     (admin, all ads)
   Totals for 7 days / 30 days / all time; numbers by place (sidebar, feed, social, header) and by format (text, image, video);
   a "fair rotation check" (fewest / average / most shown among running ads in the last 7 days); and one row per ad
   (the 200 most shown) with a link to its details. Link "Numbers for all ads" at the top of /admin/ads.

PRIVACY (ADS_PLAN decision 3 is kept): only the per-ad per-day totals that already exist are used. No new table, no migration,
nothing about visitors. The texts say so.

INSTALL (make a backup zip first)
1. Unzip patch-ads-details.zip INTO the project folder (where PROJECT.md is). It adds new files only.
2. In the project folder:   node apply-ads-details.mjs
   (adds the texts in all 6 languages, the two "Details" buttons, and "test:ad-detail" to package.json. Safe to run twice.)
3. In web/:
     npm run test:ad-detail     (logic tests, no database)
     npm run check:i18n         (every text exists in 6 languages)
     npm run lint
     npm run build
4. Try by hand: log in as an advertiser with a running ad -> /advertise/my -> "Details and numbers".
   Log in as admin -> /admin/ads -> "Numbers for all ads" and "Details and numbers" on an ad.

NEW FILES
  web/src/lib/ad-detail-rules.ts   web/src/lib/ad-detail.ts   web/src/components/AdStatsView.tsx   web/src/components/ad-detail.css
  web/src/app/(site)/advertise/my/[id]/page.tsx   web/src/app/admin/ads/[id]/page.tsx   web/src/app/admin/ads/stats/page.tsx
  web/scripts/test-ad-detail.ts   apply-ads-details.mjs

NOT in this patch (ideas for later)
  - Per-hour numbers and "which page showed the ad" (not stored; would need a new table, decide first).
  - CSV download of the numbers.
  - An email of weekly numbers to the advertiser.
