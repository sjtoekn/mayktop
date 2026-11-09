# Shorts - work list (route /shorts)

## 0. Decisions
- [x] 1 Route: /shorts
- [x] 2 Length 15-60 s (first plan; final limit later) - src/config/short-config.ts
- [x] 2 Max size 50 MB; mp4 / webm / mov; 9:16 recommended, not required
- [x] 3 Storage: local disk web/storage/shorts/ (SHORT_MEDIA_DIR), cloud later
- [x] 4 Privacy: PUBLIC / UNLISTED / PRIVATE
- [ ] 5 Who may upload (new-account limits?)
- [ ] 6 Ads inside Shorts: now or later

## 1. Database  - DONE in this patch
- [x] 7 Short  - [x] 8 ShortLike, ShortBookmark, ShortComment  - [x] 9 indexes  - [x] 10 sharedSocialPostId

## 2. Storage + processing   (next)
11 short-storage.ts  12 GET /api/shorts/media/[file] (+Range)  13 validation  14 ffmpeg H.264 keep audio  15 thumbnail  16 status PROCESSING -> READY/FAILED

## 3. Upload   17 page  18 details form  19 rate limit  20 share to Social
## 4. Feed + vertical player   21-27
## 5. Interactions   28-32
## 6. My Shorts / management   33-36
## 7. Safety + admin   37-40
## 8. Finish   41 i18n  42 tests/CHANGELOG/PROJECT.md  43 final patch zip
