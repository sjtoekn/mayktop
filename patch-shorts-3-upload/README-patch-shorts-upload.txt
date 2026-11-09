patch-shorts-3-upload  (SHORTS_TODO steps 16-19)     Needs: patches 1 and 2 installed.

ADDS
  web/src/app/(site)/shorts/upload/page.tsx      the page  /shorts/upload
  web/src/app/(site)/shorts/upload/actions.ts    uploadShort(): login, limits, checks, ffmpeg, PROCESSING -> READY / FAILED
  web/src/components/shorts/ShortUploadForm.tsx  the form (video + preview, title, description, privacy)
  web/src/lib/short-input.ts                     cleans title / description / privacy (pure)
  web/src/config/short-text.ts                   the visible texts (English; moved to i18n in step 41)
OVERWRITES (a superset of patch 1's file, nothing removed)
  web/src/config/short-config.ts                 + SHORT_UPLOAD_LIMITS, SHORT_CHECK_LIMIT, SHORT_MAX_PARALLEL

DECISION 5 (who may upload) - I used the SAME rule as photos until you say otherwise:
  login needed, and a NEW account gets the stricter limits (limitsFor / new-account-rules). Easy to change later.

RULES
  - 3 uploads / 10 min and 15 / day (stricter for new accounts). FAILED and deleted shorts count too.
  - 6 file checks / 10 min, and at most 2 videos prepared at the same moment by the server.
  - Next.js body limit is already 60 MB in your next.config.ts, so the 50 MB video fits.
  - ffmpeg missing -> the short is refused (not saved).

INSTALL (project root = the folder with web/)
  cd ~/Downloads/7-mayktop
  unzip -o patch-shorts-3-upload.zip
  cp -R patch-shorts-3-upload/* .
  (the running  npm run dev  picks the new files up by itself; no migration)

TEST
  1. Log in, open http://localhost:3000/shorts/upload
  2. Choose a 15-60 second video, write a title, press "Upload short"  (wait a little: ffmpeg works)
  3. "Your short was uploaded and is ready."  Files appear in  web/storage/shorts/  (a .mp4 and a -t.webp)
  4. Open  http://localhost:3000/api/shorts/media/<that .mp4 name>  -> the video plays, you can jump around (Range)
  5. A 5-second or 2-minute video must be refused with a clear message; the row is saved as FAILED.
  Quick look at the rows:   cd web && npx prisma studio    (table Short: processing = READY / FAILED)

CHECKED HERE: the input cleaning (title/description/privacy cases incl. Sinhala joiners), strict TypeScript on the pure files,
and (patch 2) the real ffmpeg pipeline. NOT checked here: the page and action inside your running app (needs your database
and login). If the page shows an error or does not compile, send me the message from the terminal where  npm run dev  runs.

NOT in this patch: "Share to Social Feed" (step 20) - it comes with the feed, so it can reuse the Social post code.
NEXT: patch 4 = /shorts feed + vertical player (+ ads between shorts).
