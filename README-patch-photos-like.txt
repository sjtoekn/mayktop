patch-photos-like (PHOTO_TODO 7, 2026-11-08)

What it does: a Like button on /photos/<id> (a heart and the number of likes). A login is needed to like; anybody sees the
number. Only for a photo that may be shown. Liking needs that neither person blocked the other. The number is always read
from the database. Rate limit: the Social like numbers, in the database, in its own key (photo-like:<person>).
Not here: a notification to the photo's owner (the notification types are Social only), likes count on the grid.

Run (from the project folder, where PHOTO_TODO.md is):
  unzip -o patch-photos-like.zip
  node apply-photo-like.mjs
  cd web
  npm run test:photo-detail
  npm run check:i18n
  npm run build
  npm run dev       (open a photo, click the heart; refresh: it must stay liked; click again: unliked)

Added: src/app/(site)/photos/like/actions.ts, src/components/photos/PhotoLikeButton.tsx, texts photo.like.* (apply script).
Changed: photos/[id]/page.tsx, src/lib/photo-detail.ts (like count + hasLikedPhoto), src/lib/photo-detail-rules.ts (isPhotoId),
scripts/test-photo-detail.ts (2 tests more), photos/photos.css (one rule at the end).
