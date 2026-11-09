patch-ads-list: /admin/ads is now paged, searchable and has a History tab
=========================================================================

WHY
ADS_PLAN decision 9 expects hundreds or thousands of ads. The old screen loaded every working ad at once and drew every preview
(pictures, videos), so it would become slow and unusable. Rejected and ended ads could not be found at all (only by typing the ad
number into the address).

WHAT YOU GET (/admin/ads)
1. ONE tab at a time, 20 ads a page (ADS_PAGE_SIZE in web/src/lib/admin-ads-list-rules.ts):
   Waiting for review | Approved, waiting for payment | Running | Paused | History.
   Every tab shows how many ads match. "Previous / Next" and "Page N of M" at the bottom, "Showing 21-40 of 63" at the top.
2. Search (ad number like 12 or #12, title, text, advertiser username, contact email) and two filters (place, format).
   The search and filters stay when you change tab or page. "Clear" removes them.
3. History tab = REJECTED + ENDED ads, newest first, compact: rule + written reason of a rejection, run dates of an ended ad,
   totals, link to the details page. No preview, no buttons (an appeal is still decided in /admin/appeals).
4. Running ads are listed by end date (soonest ending first).
5. DRAFT ads are never shown to the admin.
Everything else (approve / reject / paid / pause / restore, the rules, the audit log) is unchanged.

NO migration, NO database change, nothing about visitors (ADS_PLAN decision 3 is kept).

INSTALL (make a backup zip first)
1. Unzip patch-ads-list.zip INTO the project folder (where PROJECT.md is). It replaces 3 ads-only files and adds 4 new ones.
   (Replaced: web/src/lib/admin-ads.ts, web/src/app/admin/ads/page.tsx, web/src/app/admin/ads/ads.css)
2. In the project folder:   node apply-ads-list.mjs
   (adds 12 texts in all 6 languages, "test:ad-list" to package.json, one line to CHANGELOG.md, a note to ADS_PLAN.md.
    Safe to run twice. It never replaces a shared file as a whole.)
3. In web/:
     npm run test:ad-list      (logic tests, no database)
     npm run check:i18n
     npm run lint
     npm run build
4. Try by hand (log in as an admin):
   a. /admin/ads opens on "Waiting for review". Click each tab: the number in the tab matches the list.
   b. Search a title, an advertiser username, an e-mail, "12" and "#12". Change tab: the search stays. "Clear" removes it.
   c. Filter by place and by format. A search with no result shows "No ad matches this search."
   d. History: a rejected ad shows its rule + reason; an ended ad shows its dates and totals; "Details and numbers" opens /admin/ads/<id>.
   e. With more than 20 ads in a tab: Next / Previous work; /admin/ads?page=999 shows the last page; /admin/ads?view=abc shows the queue.
   f. Approve / reject / paid / pause / restore still work from the tabs (after an action the list refreshes as before).

NEW FILES
  web/src/lib/admin-ads-list-rules.ts   web/scripts/test-ad-list.ts   apply-ads-list.mjs   README-patch-ads-list.txt
REPLACED FILES (ads-only, not shared with other chats)
  web/src/lib/admin-ads.ts   web/src/app/admin/ads/page.tsx   web/src/app/admin/ads/ads.css

CHECKED IN THE BUILD CHAT
  npm run test:ad-list passed; apply script run twice on a copy of the project (second run changes nothing);
  npm run check:i18n passed (1401 texts x 6 languages).
NOT CHECKED (the build chat has no installed packages): npm run lint, npm run build and the manual steps above. Please run them.

NOT in this patch (next ideas)
  - Payment note (amount, reference) and refund / undo "paid" (TODO 46).
  - An "ends soon" mark on running ads; ending-soon e-mails on a schedule instead of "when an admin opens the screen" (TODO 56).
  - The same paging and tabs for /advertise/my (it still shows up to 100 of the advertiser's own ads).
