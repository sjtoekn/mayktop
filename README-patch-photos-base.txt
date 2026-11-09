patch-photos-base  (PHOTO_TODO 1a decision + 2 database + 3 photo files)   PROVISIONAL numbers

What it does:
 - Decision (PHOTO_TODO 1a, 2026-11-08): ANYBODY may see a photo that may be shown. A login is needed to upload, like and report (those come in later steps).
 - Database: new tables Photo and PhotoLike (migration 20261121090000_photos). Nothing existing is changed.
 - Every photo is saved as TWO rebuilt WebP files: a full copy (longest side at most 2560 px) and a small thumbnail (480 px). No Exif / location data survives.
 - GET /api/photos/media/<file> serves them. A photo that may be shown: anybody. Hidden / removed photo or an owner who is not shown: only the owner and admins. Deleted photo: 404.
 - Numbers: web/src/config/site.ts `photoMedia` (20 MB decided 2026-11-08; 20,000 px a side and 100 million pixels are provisional).
 - Files are kept in web/storage/photos/ (outside public/), or in the folder of the PHOTO_MEDIA_DIR setting.
 - Nothing is visible on the site yet: there is no upload form and no /photos page until PHOTO_TODO 4 and 5.
 - NOT in this patch: a rate limit for the media route (planned with the /photos page, PHOTO_TODO 5).

New files:    web/src/lib/photo-file.ts  photo-image.ts  photo-storage.ts
              web/src/app/api/photos/media/[file]/route.ts
              web/scripts/test-photo-image.ts
              web/prisma/migrations/20261121090000_photos/migration.sql
Changed:      web/prisma/schema.prisma (models Photo, PhotoLike; User gets `photos`, `photoLikes`)
              web/src/config/site.ts (photoMedia)   web/package.json (script test:photo-image)

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):   unzip -o patch-photos-base.zip
3. In web/:   npx prisma migrate dev      (it must say the migration 20261121090000_photos is applied and NOT ask to reset the database; if it asks to reset, say no and tell me what it printed)
              npx prisma generate
4. In web/:   npm run test:photo-image   npm run lint   npm run build
5. Manual check: none yet (no screen). Check `web/storage/photos` is NOT created until the first upload (PHOTO_TODO 4).
