patch-ads-form-design  (nicer "Create an ad" form at /advertise/new; layout only, same texts, same checks, no migration)

1. Backup first (zip of web/src).
2. In the project folder (where PROJECT.md is):  unzip -o patch-ads-form-design.zip
   Replaces: web/src/components/AdvertiseForm.tsx   (new layout; the logic and the server action are unchanged)
   Adds:     web/src/components/advertise-form.css
3. In web/:  npm run lint   npm run build   then restart npm run dev
4. Look at /advertise/new: LIGHT and DARK mode, phone width (~375px), Arabic (right-to-left).
   Try all 3 formats and all 3 places, choose a picture / video, watch the preview and the counters, send one ad.
