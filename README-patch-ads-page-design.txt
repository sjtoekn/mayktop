patch-ads-page-design  (nicer /advertise page; layout only, same texts, same links, no migration)

1. Backup first (zip of web/src).
2. In the project folder (where PROJECT.md is):  unzip -o patch-ads-page-design.zip
   Replaces: web/src/app/(site)/advertise/page.tsx      (new layout)
   Adds:     web/src/app/(site)/advertise/advertise-landing.css
   Nothing else changes (advertise.css and the forms are untouched).
3. In web/:  npm run lint   npm run build   then restart npm run dev
4. Look at /advertise in LIGHT and DARK mode and at phone width (~375px). Also try the Arabic language (right-to-left).
