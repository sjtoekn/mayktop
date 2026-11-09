patch-photos-grid (PHOTO_TODO 5, 2026-11-08)

What it does: /photos shows the newest photos in rows filled to the full width (thumbnails only, no script), newest first,
with "Load more" (next, older page by cursor) and a button to upload. Anybody may look, also a visitor. Only photos that may
be shown are listed (VISIBLE, not deleted, owner shown: the same rule as the media route).

Not in this patch (on purpose): Block / Mute of authors, category filter (step 9), fair ranking (step 15), the ad tile
(step 16), a rate limit on /api/photos/media (moved to step 18: it needs a light design, not a database write per picture).
The tiles link to /photos/<id>, which is PHOTO_TODO 6, so they give "not found" until that page exists.

Run (from the project folder, where PHOTO_TODO.md is):
  unzip -o patch-photos-grid.zip
  node apply-photo-grid.mjs
  cd web
  npm pkg set scripts.test:photo-feed="tsx scripts/test-photo-feed.ts"
  npm run test:photo-feed
  npm run check:i18n
  npm run build
  npm run dev        (then open http://localhost:3000/photos)

Added: src/app/(site)/photos/page.tsx + photos.css, src/lib/photo-feed.ts (database), src/lib/photo-feed-rules.ts (pure),
scripts/test-photo-feed.ts, texts photo.list.* in the 6 language files (by the apply script).
