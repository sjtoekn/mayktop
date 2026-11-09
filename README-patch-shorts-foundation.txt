patch-shorts-1-foundation  (SHORTS_TODO steps 0 and 1)
Route: /shorts          Date: 2026-11-08

WHAT IT ADDS
  web/src/config/short-config.ts   all limits in one place (15-60 s, 50 MB, mp4/webm/mov, privacy, text limits)
  web/src/lib/short-file.ts        random file names + addresses (/api/shorts/media/...), thumbnail names
  web/prisma/migrations/20261125090000_shorts/migration.sql
  apply-shorts-schema.mjs          adds the models + 4 relation lines on User to web/prisma/schema.prisma
  SHORTS_TODO.md                   the work list (tick as we go)

MODELS: Short, ShortLike, ShortBookmark, ShortComment (+ enums ShortPrivacy, ShortProcessing).
  Moderation uses the existing ContentStatus; upload progress uses ShortProcessing (PROCESSING -> READY / FAILED).

HOW TO INSTALL (from the project root, the folder that contains web/)
  1. unzip this patch over the project (it only adds new files)
  2. node apply-shorts-schema.mjs          (safe to run twice)
  3. cd web
  4. npx prisma migrate deploy             (dev machine: npx prisma migrate dev)
  5. npx prisma generate
  6. npm run build   (or: npm run dev)

NOTE: the SQL was checked in SQLite and the schema script was run on your schema.prisma, but `prisma validate`
could not be run here (no node_modules). Step 4/5 will tell you at once if anything is wrong - send me the message.

NO page or button yet: the next patch is step 2 (storage + /api/shorts/media + ffmpeg processing).
