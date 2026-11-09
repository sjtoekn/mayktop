patch-shorts-2-storage  (SHORTS_TODO steps 11-15)       Needs: patch-shorts-1-foundation installed.

ADDS (new files only, nothing of yours is overwritten except SHORTS_TODO.md):
  web/src/lib/short-storage.ts      where files live: web/storage/shorts/ (or SHORT_MEDIA_DIR), tmp/ for raw uploads,
                                    publish / delete helpers (never one file without the other)
  web/src/lib/short-video.ts        sniffShortVideo (real type from bytes), probeShort (ffprobe), makeShortFiles:
                                    checks the length against short-config.ts, then H.264 MP4 + AAC sound KEPT,
                                    no metadata (no GPS), long side <= 1280 px, +faststart, and a WebP thumbnail
  web/src/lib/short-range.ts        reads the HTTP Range header (pure function)
  web/src/app/api/shorts/media/[file]/route.ts
                                    GET /api/shorts/media/<file>  video (206 Range) or thumbnail, with the visibility rules:
                                    PUBLIC / UNLISTED + READY + VISIBLE + owner shown = anyone; everything else = owner / admin only

NEEDS ffmpeg + ffprobe on the machine (Mac:  brew install ffmpeg ; check:  ffmpeg -version).
Other places: set FFMPEG_PATH / FFPROBE_PATH. WITHOUT them a short is refused ("ffmpeg-missing"): we never show a video
whose length we could not check. (Different from video ads, which fall back to the original file.)

INSTALL (project root = the folder with web/):
  unzip -o patch-shorts-2-storage.zip
  cp -R patch-shorts-2-storage/* .
  cd web && npm run dev          (no migration this time)
  Add to web/.gitignore:  /storage/       (if it is not already there)

CHECKED HERE with real files (ffmpeg 1920x1080 mp4, 720x1280 webm, 5 s, 90 s, a fake mp4):
  mp4 -> 1280x720 H.264 + AAC, webm -> 720x1280 H.264 + AAC, 5 s -> too-short, 90 s -> too-long, fake -> media-type,
  thumbnails made (WebP), Range parser cases (open end, last N bytes, past the end, several ranges).
NOT checked here: the route file itself (needs your running app + database). Quick test after install:
  curl -i http://localhost:3000/api/shorts/media/abc.mp4      -> 404 (no such short = correct)
The real test comes with step 3 (upload).

NEXT: patch 3 = upload page + server action (saves raw file, creates the Short row, runs makeShortFiles, PROCESSING -> READY / FAILED,
rate limit, share to Social). Decision still open for it: who may upload (new-account limits?).
