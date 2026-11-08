patch-social-17-finish
The code of the Following feed (/social/following, the "All | Following" tabs) is already in your project, but the original
apply-social-17.mjs never ran, so these were missing: 8 texts (npm run check:i18n shows 8 problems and npm run build can stop
on them), the tab style, the npm script test:social-following and the CHANGELOG line.

1. In the project folder (where PROJECT.md is):   unzip -o patch-social-17-finish.zip
2. node apply-social-17-finish.mjs      (must end with "All done.")
3. cd web ; npm run test:social-following ; npm run check:i18n   (must say "All checks passed.")
No database change. Do this BEFORE patch-social-18-21 (or right after; the order does not matter for the database).
