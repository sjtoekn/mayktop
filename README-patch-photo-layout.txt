patch-photo-layout : the photo page /photos/[id] in two columns, like the 3001 (SJ DEMO) page

WHAT CHANGES
  Left : the picture card (picture, Like + Share + "Public photo", title, facts line, caption, tags), then "More from <name>".
  Right: Details (Size, Orientation, Views, Visibility + a big Download button), the photographer card
         (photos count + View profile), Previous / Next.
  Nothing else changes: Like, Share, view counting (PhotoViewCount stays inside the <article>), hidden-photo notice,
  block rules, login rules, download file name. A hidden photo (owner / admin only) stays one column, no side panel.
  Phone / narrow screens (< 960px): one column, the side panels come under the picture.

FILES
  web/src/app/(site)/photos/[id]/page.tsx   REPLACED (the old one is copied to page.tsx.before-layout)
  web/src/app/(site)/photos/photos.css      REPLACED (old rules kept, new rules added at the end)
  apply-photo-layout.mjs                    adds 4 texts (photo.side.*) in the 6 languages

HOW TO APPLY  (in the project folder, where PHOTO_TODO.md is)
  cp "web/src/app/(site)/photos/[id]/page.tsx" "web/src/app/(site)/photos/[id]/page.tsx.before-layout"
  unzip -o patch-photo-layout.zip
  node apply-photo-layout.mjs
  cd web && npm run check:i18n && npx tsc --noEmit
  then open http://localhost:3000/photos/2

NOT IN THIS PATCH (on purpose)
  Save, Collection, Report, Comments : they need database + server work (comments = PHOTO_TODO 8).
  Say which one you want next.
  NOT run on my side: I have the photo files only, not node_modules or the database. Please run the two checks above.
