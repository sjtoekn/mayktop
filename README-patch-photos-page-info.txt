patch-photos-page-info (PHOTO_TODO 6b): the photo page /photos/[id] gets
  - "Photo info" card: uploaded day, size (width x height, megapixels), orientation
  - photographer card: round letters, name, "Photographer · N photos", View profile (/u/<username>)
  - Previous / Next: the photographer's next-newer / next-older photo (same order as the grid)
  - "More from <name>": up to 6 other photos of the photographer
  - Share (the same button as Social: share sheet, or copies the link)
Shown only for a photo that is shown (a hidden photo, opened by its owner or an admin, gets only the info card).
Only photos that may be shown are counted or linked (VISIBLE, not deleted). No new table, no new column, nothing about the viewer is read.
NOT in this patch: Views (needs counting), Download, Report, Visibility row, Save / Collection.

Files (replace the same files of the project, they were unzipped by `unzip -o`):
  web/src/app/(site)/photos/[id]/page.tsx, web/src/app/(site)/photos/photos.css,
  web/src/lib/photo-detail.ts, web/src/lib/photo-detail-rules.ts, web/scripts/test-photo-page.ts
Then run, in the project folder:
  unzip -o patch-photos-page-info.zip
  node apply-photo-page-info.mjs
  cd web
  npm run test:photo-page
  npm run test:photo-detail
  npm run check:i18n
  npm run build
Check by eye: /photos/<id> of a photographer with several photos (cards, Previous / Next, More), one with a single photo (no
Previous / Next, no More), a phone width, and a right-to-left language.
ASSUMPTION to check: a small picture is "<32 hex>-t.webp" served by /api/photos/media/. If the thumbnails look broken,
change only photoThumbFile() in photo-detail-rules.ts (and send me how the grid builds its picture address).
