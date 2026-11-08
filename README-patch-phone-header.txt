patch-phone-header  (phone top bar: name on the left, theme / avatar / Log out in the same row, search bar full width)

What it does (screens 800px wide and narrower):
 - Row 1: site name (MaykTop) at the LEFT edge, and the three items (theme, avatar, Log out) on the right of the SAME row.
 - Row 2: the search bar, full width.
 - Desktop is not touched.
 - The layout lives in its OWN file (web/src/app/header-phone.css), so restoring shell.css from an older zip can no longer erase it.
 - NO DATABASE CHANGE.

1. Back up the project folder first (a copy is enough).
2. In the project folder (where PROJECT.md is):
     unzip -o patch-phone-header.zip
     node apply-phone-header.mjs
3. In web/:   npm run lint   npm run build
4. Look at it: npm run dev, open localhost:3000 on the phone (or Chrome DevTools, phone size). Check light and dark, logged in and logged out.
