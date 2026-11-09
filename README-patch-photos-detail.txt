patch-photos-detail (PHOTO_TODO 6, 2026-11-08)

What it does: /photos/<id> shows one photo: the big picture (click = full size in a new tab), title, photographer, category,
date, caption (new lines kept) and tags. The tiles of /photos now open it.
Who sees it: anybody, also a visitor, for a photo that may be shown (the same rule as /api/photos/media). A hidden photo
opens only for its owner and admins, with a notice. Invalid / missing / deleted numbers and people who blocked you (or
whom you blocked) give "not found".

Not in this patch (on purpose): likes (step 7), comments (8), links on the category / tags / photographer (9, 10, 11), edit
and delete (12), report (13). The tags and the category are plain text for now.

Run (from the project folder, where PHOTO_TODO.md is):
  unzip -o patch-photos-detail.zip
  node apply-photo-detail.mjs
  cd web
  npm pkg set scripts.test:photo-detail="tsx scripts/test-photo-detail.ts"
  npm run test:photo-detail
  npm run check:i18n
  npm run build
  npm run dev       (open /photos and click a photo)

Added: src/app/(site)/photos/[id]/page.tsx, src/lib/photo-detail.ts, src/lib/photo-detail-rules.ts,
scripts/test-photo-detail.ts, texts photo.detail.* (by apply-photo-detail.mjs). Changed: src/app/(site)/photos/photos.css
(the new styles are added at the end; the grid styles are unchanged).
