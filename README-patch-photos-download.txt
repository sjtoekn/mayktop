patch-photos-download (PHOTO_TODO 6d): a "Download" button on /photos/[id], next to Share.
  - It is a plain link with the `download` attribute to the SAME address the page already shows (/api/photos/media/<file>),
    so the media route's rules apply unchanged (a hidden photo's file is never given to the wrong person). No new route,
    no new table, no counting of downloads.
  - Saved as photo-<number>.<webp|jpg|png> (plain letters; the title may be in any script).
  - Shown only for a photo that is shown (the same row as Like and Share).
PROVISIONAL choices (decide, then tell me): who may download = everybody who may see the photo (visitors too); the file =
the stored copy, the same one the page shows (see "CHECK" below).
CHECK: the stored copy must have NO Exif / location data. The Social pictures are rebuilt without it (social-image.ts); please
confirm the photo upload (PHOTO_TODO 4) does the same, before the site opens: download the file and look at its details.
Run:
  unzip -o patch-photos-download.zip
  node apply-photo-download.mjs
  cd web
  npm run test:photo-page
  npm run check:i18n
  npm run build
Files: web/src/app/(site)/photos/[id]/page.tsx, web/src/lib/photo-detail-rules.ts, web/scripts/test-photo-page.ts
