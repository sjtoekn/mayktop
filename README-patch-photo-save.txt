patch-photo-save : "Save" for photos (private saved list), like the Social bookmarks

WHAT IT DOES
  - A "Save" button next to Like and Share on /photos/[id]. Private: no count, nobody is told, nobody else sees it.
  - A page /photos/saved: your saved photos, most recently SAVED first, same picture grid as /photos, "Load more" paging.
    Logged-out people see a "please log in" message. Hidden / removed / deleted photos and photos of a person who blocked
    you (or whom you blocked) are left out of the list; they come back when the photo comes back.
  - A "Saved photos" button in the header of /photos.
  Rules (same as Social bookmarks, ACCOUNT_RULES.md 3.17): saving needs a photo that may be shown and no block either way;
  your own photo can be saved; removing a save always works; saving twice changes nothing; at most socialLimits.maxBookmarks
  (2000) saved photos per person (counted separately from Social bookmarks); rate limit = the Social bookmark numbers, kept in the
  database in their own key ("photo-bookmark:<user>"), stricter for a new account.

NEW FILES
  web/prisma/migrations/20261123090000_photo_bookmarks/migration.sql
  web/src/lib/photo-bookmark.ts            the rules (save / remove / erase an account)
  web/src/lib/photo-bookmark-rules.ts      paging cursor (reuses the Social bookmark cursor)
  web/src/lib/photo-bookmark-view.ts       reading: "did I save this?", the saved list
  web/src/app/(site)/photos/bookmark/actions.ts
  web/src/app/(site)/photos/saved/page.tsx
  web/src/components/photos/PhotoBookmarkButton.tsx
  web/scripts/test-photo-bookmark.ts
  apply-photo-save.mjs                     edits the existing files (below)

EXISTING FILES THAT apply-photo-save.mjs EDITS (each one only if its anchor is found; run twice = no change)
  web/prisma/schema.prisma                 + model PhotoBookmark, + a relation line in User and in Photo
  web/src/app/(site)/photos/[id]/page.tsx  + Save button, + "did I save this?"
  web/src/app/(site)/photos/page.tsx       + "Saved photos" button in the header
  web/src/app/(site)/photos/photos.css     + .ph-headActions
  web/src/lib/purge-social.ts              + erasePhotoBookmarks(...) next to eraseSocialBookmarks(...)
  web/package.json                         + "test:photo-bookmark"
  web/src/i18n/messages/{en,es,fr,hi,zh,ar}.ts   + 16 texts (photo.bookmark.*, photo.saved.*)

HOW TO APPLY (in the project folder, where PHOTO_TODO.md and dev.db are)
  cp dev.db dev.db.backup-before-photo-save
  tar czf before-photo-save.tgz web/src web/prisma/schema.prisma web/package.json
  unzip -o patch-photo-save.zip
  node apply-photo-save.mjs
  cd web
  npx prisma migrate dev          # NOT with --name; it applies 20261123090000_photo_bookmarks
  npx prisma generate
  npm run check:i18n && npx tsc --noEmit && npm run test:photo-bookmark
  then open a photo, press Save, open /photos/saved

DATABASE CHANGE: one new table PhotoBookmark (userId, photoId, createdAt) with two indexes. Nothing existing is changed.

PLEASE CHECK BY HAND
  1. Account erasure. The saves are deleted by erasePhotoBookmarks() BEFORE the person's photos / user row go (the foreign
     keys are RESTRICT). I inserted the call next to eraseSocialBookmarks() in purge-social.ts, but I have not seen the code that
     deletes the photos, so confirm the order: delete a test account that has saved photos and photos saved by others.
  2. Anchors. If apply-photo-save.mjs prints PROBLEM for a file, that file was not changed; send me that file.
  3. The sidebar "Saved" link still goes to /saved (the old placeholder). /photos/saved is reached from the header of /photos.
     Joining the two lists on one page is a separate decision.

TESTED ON MY SIDE: the apply script (twice, on a copy of your files; second run changed nothing) and npm run test:photo-bookmark
  logic (10 checks, passed, with a stand-in for the database). NOT run: prisma migrate, tsc, the build, the pages in a browser.
