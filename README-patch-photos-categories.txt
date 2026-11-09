patch-photos-categories (PHOTO_TODO 4 + 9, 2026-11-08)

What it does: every photo gets ONE category, chosen in the upload form (required). 10 categories: nature, people, animals,
food, travel, buildings, vehicles, art, sports, other. Photos uploaded earlier get "other". The 50 MB decision is written in
PHOTO_TODO.md. Comments are NOT in this patch: they need the photo page (PHOTO_TODO 6) first, so they come at step 8.

Run (from the project folder, where PHOTO_TODO.md is):
  unzip -o patch-photos-categories.zip
  node apply-photo-categories-i18n.mjs
  cd web
  npx prisma generate
  npx prisma migrate deploy
  npm run test:photo-input
  npm run test:photo-image
  npm run check:i18n
  npm run build

Changed: prisma/schema.prisma (Photo.category + index), migration 20261122100000_photo_category, src/config/site.ts
(photoCategories), src/lib/photo-input.ts (parsePhotoCategory), upload actions.ts / page.tsx / PhotoUploadForm.tsx,
scripts/test-photo-input.ts, the 6 language files (by the apply script), PHOTO_TODO.md.
Not changed: CHANGELOG.md / DATABASE.md (add a line about Photo.category when step 4 is finished).
