patch-social-images  (4b: ONE picture per Social post)

What it does:
 - The "Create a social post" page has an "Add a picture" button (JPG, PNG or WebP, up to 5 MB). The chosen picture is shown as a
   preview and can be removed. The text of the post is still required (a picture alone is not a post).
 - The picture appears in the post card everywhere (home feed, /social, Following, profiles, hashtag pages, the single post page).
   Click = the full picture in a new tab. Alt text: "Picture in a post by <name>".
 - Pictures are for LOGGED-IN people only (Social is for logged-in people). Nobody logged in gets "not found".
 - PRIVACY: the saved file is a REBUILT copy of the upload. Exif (GPS location, camera, date), XMP, IPTC, comments, thumbnails and
   bytes after the end of the picture are removed. The orientation is kept, so phone photos are not turned sideways. The original
   upload is never kept. A file that cannot be understood completely is refused.
 - Checks on the server: size, REAL content (not the name), well-formed file, at most 10,000 px on a side and 40 million pixels.
   SVG, GIF and video are not accepted.
 - Deleting your own post deletes the picture file. Final erasure of an account deletes all its picture files.
 - Moderators see the picture of reported and hidden posts in /admin/social.
 - DATABASE CHANGE: one new INDEX only (SocialPost.mediaUrl). No new table, no new column. The migration is ready in the zip.

1. Make a backup zip of the project (and of web/dev.db).
2. In the project folder (where PROJECT.md is):   unzip -o patch-social-images.zip
   NEW files:  web/src/lib/social-image.ts, web/src/lib/social-image-storage.ts
               web/src/app/api/social/media/[file]/route.ts
               web/prisma/migrations/20261110090000_social_media_index/migration.sql
               web/scripts/test-social-image.ts
               apply-social-images.mjs, i18n-social-images/ (6 small text files)
   REPLACED files (they changed so much that they are shipped whole; your copy is overwritten):
               web/src/app/(site)/social/submit/actions.ts   (now receives a FormData: fields "body" and "image")
               web/src/app/(site)/social/submit/page.tsx
               web/src/components/social/SocialPostForm.tsx
3. node apply-social-images.mjs      (must end with "All done.")
   It edits 14 existing files (site.ts, schema.prisma, queries.ts, SocialPostCard.tsx, social/manage/actions.ts, purge.ts,
   purge-social.ts, social-review.ts, admin/social/page.tsx, content.css, package.json, the 6 language files, CHANGELOG.md,
   PROJECT.md, ACCOUNT_RULES.md). It can be run twice safely.
4. In web/:   npx prisma migrate dev        <-- do NOT add --name: the migration already exists in the zip
              npx prisma generate
   (If it asks to reset the database or says there is drift, stop and send me the screen; do not answer yes.)
5. In web/:   npm run test:social-image   npm run check:i18n   npm run lint   npm run build
   Also run the older tests that touch the same code:  npm run test:purge-social   npm run test:social-review   npm run test:social-delete
6. Restart npm run dev. Pictures are stored in web/storage/social/ (the same idea as web/storage/ads/). Make sure `storage/` is in
   .gitignore (if the ads already use it, it is). For another folder set SOCIAL_MEDIA_DIR in web/.env.
7. Manual test (two accounts, A and B; one JPEG taken with a phone if you have one):
   a. As A: /social/submit. Add a picture: the preview shows. "Remove picture" removes it. Choose a .txt file renamed to .jpg: the
      browser may accept the name, the server says "not a JPG, PNG or WebP picture". Choose a file over 5 MB: "bigger than 5 MB".
   b. Post "Hello #test" with a JPG. You land on the home page; the picture is in the card. Click it: full picture in a new tab.
   c. Check privacy: open the stored file in web/storage/social/ in an Exif viewer (or `exiftool <file>`): no GPS, no camera, no date.
      A phone photo taken upright / sideways still shows the right way up.
   d. As B (logged in): the picture shows in B's feed. Log out and open the picture address directly
      (/api/social/media/<file>): "not found".
   e. As A: delete the post. The card is gone AND the file is gone from web/storage/social/.
   f. As B: report A's post with a picture. As an admin (/admin/social): the picture is shown with the report. Hide the post; as
      a normal logged-in person open the picture address: "not found"; as A (the author) and as an admin it still opens.
      Restore the post: it opens for everybody again.
   g. Post with no picture: works exactly as before. Edit a post with a picture: only the text changes, the picture stays.
   h. Post 21 pictures within 10 minutes (use a tiny PNG): the 21st says "posting too quickly". (The normal post limit of 5
      per 10 minutes comes first, so you will hit that one earlier: that is fine.)
8. Tick the picture item in SOCIAL_TODO when everything passes.

Decisions I took (please confirm or change; all are in PROJECT.md 8j.5 and ACCOUNT_RULES.md 3.15):
 - Text stays required with a picture. (A picture-only post would leave an empty text, and "empty text" is how a deleted post looks.)
 - 5 MB, 10,000 px per side, 40 million pixels, JPG / PNG / WebP only. The numbers are in `socialMedia` in web/src/config/site.ts.
 - Editing a post does not change its picture. To change it: delete the post and post again.
 - A picture of a post that goes into the SAFETY RECORD (ban / report / legal hold) is deleted with the account; the record keeps
   the text only. Question for the lawyer: must the picture be kept as evidence for 180 / 730 days? If yes, say so and I will move
   those files to a protected folder and sweep them together with the record.

Not in this patch on purpose: change / remove the picture while editing, alt text written by the author, pictures in replies and
in quote reposts, several pictures per post, video, a daily disk limit per person, backup and disk space of web/storage/social/
(TODO 56), a virus scan (TODO 52), "Download my data" still lists only the picture address (not the file).
