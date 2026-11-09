# Shorts - work list (route /shorts)

## 0. Decisions
- [x] 1 Route: /shorts
- [x] 2 Length 15-60 s (first plan; final limit later) - src/config/short-config.ts
- [x] 2 Max size 50 MB; mp4 / webm / mov; 9:16 recommended, not required
- [x] 3 Storage: local disk web/storage/shorts/ (SHORT_MEDIA_DIR), cloud later
- [x] 4 Privacy: PUBLIC / UNLISTED / PRIVATE
- [ ] 5 Who may upload (new-account limits?)
- [x] 6 Ads between Shorts: NOW (use the existing ad slot system; built together with step 4)

## 1. Database  - DONE (patch 1)
## 2. Storage + processing  (patch 2)
- [x] 11 short-storage.ts  - [x] 12 GET /api/shorts/media/[file] + Range  - [x] 13 validation (type, length)
- [x] 14 ffmpeg H.264 + sound  - [x] 15 thumbnail  - [ ] 16 status PROCESSING -> READY/FAILED (with step 3: needs the upload action)
## 3. Upload   17 page  18 details form  19 rate limit  20 share to Social   <- next
## 4. Feed + vertical player   21-27  + ad between shorts (every Nth card, clearly labelled, silent)
## 5. Interactions   28-32
## 6. My Shorts / management   33-36
## 7. Safety + admin   37-40
## 8. Finish   41 i18n  42 tests/CHANGELOG/PROJECT.md  43 final patch zip
