patch-photos-views (PHOTO_TODO 6c): "👁 N" (views) and the "Public photo" mark on /photos/[id].
  - The total is Photo.viewCount (already in the database; no migration, no new table, nothing about the viewer is saved).
  - The page reports a view to POST /api/photos/view after 30% of the photo card has been on screen for 1 second.
  - Counted only when: the viewer is logged in, is not the owner, is not a crawler, was not counted for this photo in the last
    24 hours (server memory, like Social), is inside the rate limit (socialLimits.views, key "photo-view:<id>"), and the photo
    may be shown (VISIBLE, not deleted, owner shown).
  - A VISITOR (not logged in) is NOT counted: telling repeats apart would need an address or a cookie, and the site collects
    nothing about visitors. So the number is "views by logged-in people". If you want visitors counted too, it is a policy
    decision (privacy text, TODO 51), not only code.
  - "Public photo" is shown because the page opens for visitors too (PHOTO_TODO 6).
Files: web/src/app/(site)/photos/[id]/page.tsx, web/src/app/(site)/photos/photos.css, web/src/lib/photo-detail.ts,
  web/src/lib/photo-views.ts (new), web/src/lib/photo-view-db.ts (new), web/src/app/api/photos/view/route.ts (new),
  web/src/components/photos/PhotoViewCount.tsx (new), web/scripts/test-photo-views.ts (new)
Run in the project folder:
  unzip -o patch-photos-views.zip
  node apply-photo-views.mjs
  cd web
  npm run test:photo-views
  npm run test:photo-page
  npm run check:i18n
  npm run build
Check by eye: log in as a person who is NOT the owner, open a photo, wait 2 seconds, reload: the number is +1 once;
reload again and again: no more; log in as the owner: no change; log out: no change.
