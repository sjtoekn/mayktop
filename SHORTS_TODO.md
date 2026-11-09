# Shorts - work list (route /shorts)

## 0. Decisions
- [x] 1 Route: /shorts
- [x] 2 Length 15-60 s (first plan; final limit later) - src/config/short-config.ts
- [x] 2 Max size 50 MB; mp4 / webm / mov; 9:16 recommended, not required
- [x] 3 Storage: local disk web/storage/shorts/ (SHORT_MEDIA_DIR), cloud later
- [x] 4 Privacy: PUBLIC / UNLISTED / PRIVATE
- [~] 5 Who may upload: login + new-account limits (same as photos) - change if you want
- [x] 6 Ads between Shorts: NOW (existing ad slot system; built together with step 4)

## 1. Database  - DONE (patch 1)
## 2. Storage + processing  - DONE (patch 2, 3)
- [x] 11-15  - [x] 16 status PROCESSING -> READY / FAILED (patch 3)
## 3. Upload  (patch 3)
- [x] 17 page /shorts/upload  - [x] 18 details form  - [x] 19 rate limit  - [ ] 20 share to Social (with step 4)
  ## 4. Feed + vertical player  (patch shorts-feed)
  - [x] 21 /shorts feed, scroll-snap   - [x] 22 autoplay (visible only), pause/play, mute, progress bar, +-10 s
  - [~] 23 action column: Share works; Like / Comment / Save are disabled until step 5
  - [~] 24 creator + caption shown; Follow and "Add a comment" come with step 5
  - [x] 25 keyboard (Up Down Space M, Left Right) and swipe   - [x] 26 phone / desktop frame
  - [x] 27 fair order: newest first, no popularity   - [ ] ad between shorts   <- next (needs the ad files)
## 5. Interactions   28-32
## 6. My Shorts / management   33-36
## 7. Safety + admin   37-40
## 8. Finish   41 i18n  42 tests/CHANGELOG/PROJECT.md  43 final patch zip
