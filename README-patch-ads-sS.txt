patch-ads-sS  (ADS_PLAN Session S = SOCIAL_TODO 32: ads in the Social feed)
Needs patch-ads-s7 (and everything before it) installed first.

1. Make a backup zip of the project first.
2. In the project folder (where PROJECT.md is):  unzip -o patch-ads-sS.zip
   (it REPLACES 3 ad-only files: AdBox.tsx, AdSlot.tsx, AdvertiseForm.tsx; ADDS ad-social.css, lib/ad-positions.ts,
    scripts/test-ad-social.ts, migration 20261109090000_ad_social_slot, apply-ads-sS.mjs)
3. node apply-ads-sS.mjs      (safe to run twice; it must end with "All done.")
   Small edits in: schema.prisma, site.ts, queries.ts, ad-input.ts, ad-mine.ts, admin-ads.ts, api/ad/pool/route.ts,
   advertise/new/page.tsx, advertise/my/page.tsx, admin/ads/page.tsx, social/page.tsx, package.json, the six language files,
   ADS_PLAN.md, PROJECT.md, DATABASE.md, SOCIAL_TODO.md, CHANGELOG.md.
   If a line says PROBLEM for social/page.tsx, that page was changed by another patch: send me the file and I will give the 2-line edit.
4. In web/:   npx prisma migrate dev      (finds ad_social_slot: no table change)
              npx prisma generate
              npm run check:i18n    npm run test:ads    npm run lint    npm run build
5. Restart `npm run dev`.

Manual test (2 accounts: ADVERTISER = normal user, ADMIN = a different admin; the Social feed needs at least 8 posts to show both places)
 a. ADVERTISER: /advertise/new -> choose "Social feed (between Social posts)": the "which page" box is replaced by a short note; the preview gets a thick dashed border. Send a Text, an Image and a Video ad (3 forms).
 b. ADMIN: /admin/ads shows each with the badge "Social feed" and the preview in the same dashed social look. Approve + mark paid.
 c. Log in and open /social (needs posts): an ad shows after the 3rd post and another after the 8th (never first, never more than 2).
    Each ad: thick dashed border + ad colours, the "Ad" badge FIRST, "Advertiser: <site>", "Why this ad?".
    It has NO avatar, NO profile link, NO follow / like / repost / reply / share button. Click goes through /api/ad/click/<id> to the advertiser's https link.
 d. Compare with a real post side by side: they must not look alike (light AND dark mode, and at phone width ~375px).
 e. Video: poster + play button, no download before play, never autoplay.
 f. /advertise/my (advertiser) shows the slot "Social feed" and impressions / clicks going up after you scroll the ad into view.
 g. LOGGED OUT: /social shows only the login message (no ads). /social/<id> has no ad. Home, Popular and community feeds never show a Social ad.
 h. No Social ad running: the Social places show the house ad "Your ad could be here" (links to /advertise), in the same dashed look.
 i. Forms: a Social ad sent with a community in the data is saved with NO community (the form hides it; the server also ignores it).
Note for later: when the Following feed (SOCIAL_TODO 17) is built, use `isSocialAdPosition` from "@/components/AdSlot" there too.
