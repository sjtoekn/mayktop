patch-ads-s3 (ADS_PLAN Session 3: advertiser form + text ads)

BEFORE: make a backup zip of the project. Patch patch-admin8 must already be applied.

HOW TO APPLY (in the project folder, where PROJECT.md is)
1. unzip -o patch-ads-s3.zip && cp -r patch-ads-s3/* . && rm -r patch-ads-s3
   (ADDS web/src/lib/ad-input.ts, ad-submit.ts, web/src/components/AdvertiseForm.tsx, web/src/app/(site)/advertise/*,
    web/scripts/test-ad-input.ts and apply-ads-s3.mjs. No existing file is replaced as a whole.)
2. node apply-ads-s3.mjs
   (small, safe-to-repeat edits: site.ts adsConfig, schema.prisma + migration ad_formats, the six language files,
    package.json script, AdBox.tsx house-ad link, ADS_PLAN.md, DATABASE.md, CHANGELOG.md)
3. Stop the dev server, delete web/.next, then in web/:
   npx prisma migrate dev
   npx prisma generate
   npm run test:ad-input
   npm run lint
   npm run build
4. Manual checks:
   (1) LOGGED OUT: /advertise opens and reads well; "Create an ad" goes to /advertise/new, which shows the log-in message (no form)
   (2) LOGGED IN: /advertise/new shows the form; Image and Video are greyed out ("coming next"); the preview changes as you type,
       and switches shape for Sidebar / Feed; your account email is already in the email box
   (3) Wrong input shows a clear message and saves nothing: link starting http://, a web address typed in the text,
       the phrase "guaranteed returns", a start date in the past, the rules box not ticked
   (4) A good ad: "Your ad was sent for review" appears. Log in as an ADMIN (a different account): /admin/ads shows it under
       "Waiting for review" with the right slot, page, link, email and fee. The admin cannot approve their own ad.
   (5) Send ads until 5 are waiting: the 6th is refused with the "already have 5 ads waiting" message
   (6) With no running ads, the house ad ("Your ad could be here") in the sidebar opens /advertise
   (7) Switch the database check: web/prisma/dev.db keeps the 3 seed ads (their format is TEXT)

NOT in this patch (next sessions): image / video upload (3b), "my ads" + edit (4), appeal of an ad rejection.
