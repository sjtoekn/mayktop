# PHOTO_TODO — Videos site (1-Videos) හි photo පද්ධතිය MaykTop වලට ගැනීම

පරීක්ෂා කිරීම: ව්‍යාපෘති ෆෝල්ඩරයේ (PROJECT.md තියෙන තැන) `node check-todo.mjs PHOTO_TODO.md`
නීතිය: `[ ]` -> `[x]` කරන්නේ ඒ වැඩේ සම්පූර්ණයෙන්ම ඉවර වුණාම පමණයි. එක වරකට එක පියවරයි. ඉහළ සිට පහළට.

## මූලික සටහන (ඇයි එකවර copy කරන්න බැරි)
- Videos site: Postgres + raw SQL migrations, `photos` / `places` / `media` tables, SaveIt, ad revenue share. MaykTop: Prisma + SQLite, better-auth, server actions. ඒ නිසා කේතය ඒ ආකාරයෙන්ම දාන්න බැහැ; MaykTop ක්‍රමයට නැවත ලියන්න ඕනේ.
- MaykTop වල දැනටමත් තියෙනවා: පින්තූර පරීක්ෂා කර Exif ඉවත් කරන පද්ධතිය (`social-image.ts`), report/audit/appeal, i18n භාෂා 6, ad slots, rate limit, account erase/export. ඒවා නැවත භාවිතා කරනවා.
- MaykTop නීති: නිහඬ ඉවත් කිරීම නැහැ (හේතුවක් + appeal), fairness, සරල බව, ads වලට සීමා.
- මේ ලිස්ට් එකේ ඇතුළත් නොකරන Videos දේවල්: places/map, SaveIt, collections, ad revenue share, camera (EXIF) info panel (MaykTop Exif ඉවත් කරන නිසා). 20 වෙනි පියවරින් පසුව.

## තීරණ (2026-11-08)
- photos බලන්න හැමෝටම පුළුවන්; upload / like / comment / report වලට login ඕනේ
- උපරිම 50 MB (2026-11-08 20 MB සිට ඉහළ දැමුවා; ගබඩා කරන්නේ 2560px දක්වා කුඩා කළ WebP); photo එකකට title (අනිවාර්ය) + category (අනිවාර්ය) + caption + tags
- comments දැන්ම ඕනේ (පියවර 8)
- categories (තීරණය කළා 2026-11-08, ලැයිස්තුව `photoCategories` in site.ts): nature, people, animals, food, travel, buildings, vehicles, art, sports, other. Upload එකේදී තෝරනවා (පියවර 4 ට එකතු කළා); `/photos/categories` පිටු පියවර 9 හිදී

## A. තීරණ සහ පදනම

[x] 1. තීරණ (ඉහත ලියා තියෙනවා; categories පියවර 9 හිදී)
[x] 2. Database: Prisma `Photo` + `PhotoLike`, migration `photos`
[x] 3. Photo ගබඩාව: rebuilt WebP (full + thumbnail), `/api/photos/media/[file]`, `npm run test:photo-image`

## B. පෙන්වීම

[x] 4. Upload: පෝරමය + server action (පින්තූරය 50 MB දක්වා, title, category, caption, tags); tags සඳහා `PhotoTag` table + migration; server පරීක්ෂා, rate limit, new-account limits; SiteRules (PRIVACY/IMPERSONATION) පෙන්වීම
[ ] 5. `/photos` පිටුව: even-row grid, thumbnails, "Load more"
[ ] 6. `/photos/[id]` විස්තර පිටුව + විශාල පින්තූර viewer, title/caption/tags/author
[ ] 7. Likes (like / unlike, count)
[ ] 8. Comments: photo එකට comments (login ඕනේ, Social replies ක්‍රමයෙන්: report, delete, hidden pending review, rate limit); `PhotoComment` table + migration
[ ] 9. Categories: ලැයිස්තුව තීරණය කර `/photos/categories` සහ `/photos/category/[slug]`
[ ] 10. Search + tags පිටු (`/photos/search`, `/photos/tag/[tag]`)
[ ] 11. Photographer පිටුව `/photos/author/[username]`

## C. ඔහුගේ photos කළමනාකරණය

[ ] 12. My photos: ලැයිස්තුව, title/caption/tags/category සංස්කරණය, මකා දැමීම (ගොනුද ඉවත් කිරීම)

## D. සාධාරණත්වය සහ ආරක්ෂාව (MaykTop නීති)

[ ] 13. Photo සහ photo comment report: site-wide rule එකක් තෝරා report කිරීම (Social report ක්‍රමයටම), "hidden pending review", audit log, appeal; admin queue එකට එකතු කිරීම. නිහඬ ඉවත් කිරීම නැහැ
[ ] 14. Account මකා දැමීම / data export: photos, comments, ගොනු `purge` සහ export වලට එකතු කිරීම; suspended/banned/delete-pending අයගේ photos පෙනෙන නීතිය තහවුරු කිරීම
[ ] 15. Fair ranking: photos feed එක ජනප්‍රිය අයට පමණක් වාසි නොවන ලෙස; `npm run test:photo-fair-rank`

## E. අවසන් කිරීම

[ ] 16. Ads: `/photos` grid එකේ ad tile (`ad-positions.ts` නීති)
[ ] 17. i18n: සියලු text `t()` හරහා, භාෂා 6, `npm run check:i18n` සමත්
[ ] 18. Phone පෙනුම (375px), keyboard/accessibility (alt text, focus), loading/error/not-found පිටු; `/api/photos/media` වලට per-IP rate limit (memory counter; හැම පින්තූරයකටම database එකට ලියන්න එපා)
[ ] 19. Tests සියල්ල, `npm run lint`, `npm run build`, CHANGELOG.md, README-patch, PROJECT.md / DATABASE.md යාවත්කාලීන

## F. පසුව (දැන් නොකරන)

[ ] 20. Videos වල ඉතිරි දේවල් අවශ්‍ය නම්: photographer follow, collections, places/map, ad revenue share
