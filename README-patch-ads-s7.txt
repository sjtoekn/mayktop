patch-ads-s7  (ADS_PLAN Session 7: finish the ad system)
Needs patch-ads-s4c installed first. Documents + 2 npm scripts only: NO app code change, NO database change, NO migration.

1. Make a backup zip of the project first.
2. In the project folder (where PROJECT.md is):  unzip -o patch-ads-s7.zip
   (adds web/scripts/check-i18n.ts and apply-ads-s7.mjs)
3. node apply-ads-s7.mjs      (safe to run twice; it must end with "All done.")
   It makes small edits in: web/package.json (scripts test:ads, check:i18n), ADS_PLAN.md, TODO.md (44 ticked, note on 51),
   PROJECT.md, DATABASE.md, DESIGN.md, CHANGELOG.md.
4. In web/:   npm run check:i18n    npm run test:ads    npm run lint    npm run build
   (check:i18n and test:ads already passed in the build chat; lint and build could NOT be run there.)
5. Restart `npm run dev`, then do the manual flow below. When it all works, tick the line "`npm run build` + `npm run lint` clean, test full flow by hand"
   in ADS_PLAN.md (Session 7).

DECISION made in this session: ad decisions are NOT shown on the public mod log in v1 (reason in ADS_PLAN.md and PROJECT.md 8i item 7). Tell me if you want them shown.

FULL MANUAL FLOW (use 2 accounts: ADVERTISER = normal user, ADMIN = a different admin account; a small picture < 5 MB, a small MP4 < 30 MB)
 Text ad
  1. ADVERTISER: /advertise/new -> Text, Sidebar, title + text + https link, tick the rules -> Send. "Your ad was sent for review".
  2. /advertise/my shows it "Waiting for review".
  3. ADMIN: /admin/ads -> the ad is in "Waiting for review" -> Approve. The advertiser gets an email (printed in the `npm run dev` terminal).
  4. ADMIN: "Mark paid". The ad is now Running (dates shown). The advertiser gets the "running" email.
  5. Logged OUT: open the home page: the ad shows in the sidebar with the "Ad" badge and "Why this ad?". Clicking it opens the advertiser's https link.
     /advertise/my (advertiser): impressions and clicks go up (after a few minutes for the pool cache; reload a few times).
 Image ad
  6. Same steps with Format = Image and a picture. The preview shows the picture before sending. In /admin/ads the picture looks the same as visitors will see it.
  7. Running: the picture shows whole (never cropped) in a 16:9 box, no layout jump while loading.
 Video ad
  8. Same steps with Format = Video (poster picture + video). Running: the poster and a play button show; in the browser Network tab NO video download starts until you press play; it never plays by itself; skipping inside the video works; pressing play does not count as a click.
 Feed + limits
  9. A FEED ad shows only after item 1 and item 5 of a list (never more than 2 on a page).
 10. Reject one ad (rule + reason) -> the advertiser sees it, can "Edit and send again" or "Appeal"; see README-patch-ads-s4b / s4c for the details.
 11. End: the advertiser ends a running ad -> status Ended, it leaves the pool after the cache time.
 12. A visitor with "Global Privacy Control" on never gets the one-hour browser memory (see "Why this ad?").
 13. /settings/export: the ads list has no files, only fields.

STILL OPEN (not part of this patch): batch counter writes (TODO 50), disk space + backup of web/storage/ads/ (TODO 56), live "N ads running" number + billing + refunds (TODO 46), social ads (Session S, later), and the lawyer review of the privacy policy (TODO 51; the note is now in TODO.md).
