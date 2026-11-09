patch-photos-upload  (PHOTO_TODO 4: upload a photo with title, caption and tags)   PROVISIONAL numbers

Needs patch-photos-base and patch-photos-20mb (and its fix) applied FIRST.

What it does:
 - New page /photos/upload (no link to it anywhere yet: /photos with an "Upload" button comes in PHOTO_TODO 5). Anybody may open the page; a login is needed to send (a logged-out person sees the login notice and the form is locked).
 - The form: choose a photo (JPG, PNG, WebP, up to 20 MB, with a preview), TITLE (required, one line, up to 100 characters), caption (optional, up to 2000), tags (optional, separated by commas; up to 10; same rules as Social hashtags).
   The title is REQUIRED on purpose (assumption, easy to change): it is also the picture's text description for people who cannot see it. Tell me if you want it optional.
 - A tag that is not valid (for example "a.b" or only numbers), or more than 10 tags, is an ERROR shown to the person: nothing is silently dropped.
 - The server checks everything again: text, REAL picture content, size, pixels; the picture is rebuilt as two WebP files without Exif / location (PHOTO_TODO 3).
 - Limits per person (PROVISIONAL, `photoLimits` in site.ts): 5 uploads per 10 minutes, 30 per day; stricter while the account is new (limitsFor). Deleted photos will count too. Checking pictures has its own limit (20 per 10 minutes).
 - After a successful upload the page shows the small photo and "Upload another photo". (The photo's own page comes in PHOTO_TODO 6.)
 - DATABASE CHANGE: new table PhotoTag (migration 20261122090000_photo_tags).
 - 26 new texts in six languages (en, es, fr, hi, zh, ar). The Arabic, Hindi, Chinese, French and Spanish texts are written by Claude, not by a native speaker.
 - New test: npm run test:photo-input (29 checks, no database).

New files:  web/src/lib/photo-input.ts
            web/src/app/(site)/photos/upload/page.tsx  actions.ts
            web/src/components/photos/PhotoUploadForm.tsx
            web/scripts/test-photo-input.ts
            web/prisma/migrations/20261122090000_photo_tags/migration.sql
Changed:    web/prisma/schema.prisma (model PhotoTag; Photo gets `tags`)
            web/src/config/site.ts (photoText, photoLimits)   web/package.json (script test:photo-input)
            web/src/i18n/messages/en.ts es.ts fr.ts hi.ts zh.ts ar.ts
            CHANGELOG.md  DATABASE.md

1. Back up the project folder first (a copy of it is enough).
2. In the project folder (where PROJECT.md is):   unzip -o patch-photos-upload.zip
3. In web/:   npx prisma migrate dev      (it must say 20261122090000_photo_tags is applied and NOT ask to reset the database)
              npx prisma generate
4. In web/:   npm run test:photo-input   npm run test:photo-image   npm run check:i18n   npm run lint   npm run build
5. Manual test (npm run dev, log in, open http://localhost:3000/photos/upload):
   a. Logged out: the login notice shows and the form is locked.
   b. Logged in: choose a real photo from your phone or camera (more than 5 MB is fine, up to 20 MB). The preview shows. Choose a .txt or .svg file: refused with the "not a JPG, PNG or WebP" message.
   c. Leave the title empty: the Upload button stays off. Type a title and send: "Your photo was uploaded." and the small photo shows.
   d. Tags: "sunset, beach" works. "a.b" shows the tags error. 11 different tags show the tags error.
   e. Upload 6 photos quickly: the 6th is refused with "too quickly ... try again in N min".
   f. Look in web/storage/photos: two files per photo (<name>.webp and <name>-t.webp). Open the full one: no location data (for example in Preview > Tools > Show Inspector).
   g. Optional: in the browser open /api/photos/media/<name>.webp: the picture shows (even logged out).
