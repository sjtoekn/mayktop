patch-photos-one-card (PHOTO_TODO 6b, change after the first look): the photo page /photos/[id] is ONE card like the Videos page:
  picture, Like + Share (with the word), title, one line of facts (by, category, day written in the reader's language,
  size, orientation), caption, tags, and at the bottom the photographer (letters, name, "Photographer · N photos", View
  profile) and Previous / Next. "More from <name>" is a second card under it. The separate Photo info card is gone.
No new text keys (the ones of patch-photos-page-info are used), no new table or column.
NOT here yet: Views, Visibility, Download, Report, Save / Collection, Comments.

Run in the project folder:
  unzip -o patch-photos-one-card.zip
  cd web
  npm run test:photo-page
  npm run check:i18n
  npm run build
Files: web/src/app/(site)/photos/[id]/page.tsx, web/src/app/(site)/photos/photos.css, web/src/lib/photo-detail-rules.ts,
  web/scripts/test-photo-page.ts, web/src/components/photos/PhotoShareButton.tsx (new)
