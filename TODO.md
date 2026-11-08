# වැඩ ලිස්ට් (TODO) — ඉහළ සිට පහළට පිළිවෙලට කරන්න

පරීක්ෂා කිරීම: ව්‍යාපෘති ෆෝල්ඩරයේ (PROJECT.md තියෙන තැන) `node check-todo.mjs`
නීතිය: `[ ]` -> `[x]` කරන්නේ ඒ වැඩේ සම්පූර්ණයෙන්ම ඉවර වුණාම පමණයි. එක වරකට එක පියවරයි.
ස්ථිති වාර්තාව: 2026-11-07 වන විට Phase 1 හි ප්‍රධාන පිටු, design system, Dark/Light toggle සහ Popular/Explore/Top/Saved පිටු අවසන්. ඉතිරි: පහත `[ ]` දේවල්.
Social කොටසේ වැඩ වෙනම ලිස්ට් එකක: `SOCIAL_TODO.md` (පරීක්ෂා කිරීම: `node check-todo.mjs SOCIAL_TODO.md`). ඒවා මෙහි නැහැ.

## A. පවතින දේ පිළිවෙලට සකසා ගැනීම (Phase 0)

[x] 1. `cd web` -> `npm install` -> `npm run dev` ධාවනය කර localhost:3000 error නැතිව විවෘත වෙනවාද බලන්න
[x] 2. Tailwind වැඩ කරනවාද තහවුරු කරන්න (web/ තුළ `postcss.config.mjs` නැත; `package.json` හි `@tailwindcss/turbopack` ඇත). පේජ් එකේ පාට/ලේඔට් හරියට එනවාද බලන්න; නැත්නම් Tailwind v4 හි නිවැරදි package එක (`@tailwindcss/postcss`) සකසන්න
[x] 3. `npm run lint` සහ `npm run build` දෙකම error නැතිව සම්පූර්ණ වෙනවාද බලන්න
[x] 4. Git ආරම්භ කරන්න: `git init`, `.gitignore` (.env, node_modules), පළමු commit
[x] 5. අනවශ්‍ය ගොනු පිරිසිදු කරන්න: `home.css` (හිස්, root එකේ), `page.tsx.bak`, `layout.tsx.bak`, `PROJECT.md.bak`, `update-project.mjs`, `i18nfix/` ෆෝල්ඩරය, zip ගොනු (ඒවා `backups/` ෆෝල්ඩරයකට දමන්න)
[x] 6. අවසාන ව්‍යාපෘති නම තීරණය කරන්න (දැන් "MaykTop"). නම වෙනස් කරන්නේ `web/src/config/site.ts` එකේ පමණයි; PROJECT.md හි `[Project Name]` ද යාවත්කාලීන කරන්න
[x] 7. `CHANGELOG.md` සාදන්න
[x] 8. PROJECT.md හි Phase 0 සහ Phase 1 හි දැනටමත් අවසන් දේවල් `[x]` කරන්න (යාවත්කාලීනයෙන් පසු)

## B. Phase 1 — UI පමණක් (sample data)

[x] 9. Design එක එකක් කරන්න: මුල් පිටුව (`app/page.tsx` + `home.css`, "ch-" design) සහ අනෙක් පිටු (Tailwind + AppShell) දැන් වෙනස් design දෙකක්. එකක් තෝරා සියලු පිටු එකම පෙනුමට ගේන්න
[x] 10. Design system: colours, typography, button/card styles එක තැනක (globals.css) අර්ථ දක්වන්න
[x] 11. මුල් පිටුවේ posts/trending/categories hard-coded English ඉවත් කර `data/sample.ts` සහ `i18n` භාවිතා කරන්න (PROJECT.md 8b නීතිය: component තුල text නැහැ)
[x] 12. මුල් පිටුවේ feed එක `PostCard` component එකෙන් පෙන්වන්න
[x] 13. Community පිටුව (`/c/[slug]`) පරීක්ෂා කර සම්පූර්ණ කරන්න (නම, නීති 3-5 ක පෙට්ටිය, posts)
[x] 14. Post පිටුව (`/post/[id]`): threaded comments කියවීමට පහසුද බලා නිවැරදි කරන්න
[x] 15. "Create post" පිටුව සාදන්න (`/submit`): community තෝරන්න, ඒ community හි නීති post කිරීමට පෙර පෙන්වන්න
[x] 16. Removal-reason display: සැඟවූ post/comment එකක් සඳහා නීතිය, හේතුව, appeal බොත්තම (post එකට දැනටමත් ඇත; comments සඳහා ද එක් කරන්න)
[x] 17. Public moderation log පිටුව (`/modlog`, sample data) සාදන්න
[x] 18. නොකළ ලින්ක් (`href="#"`): Communities, Mod log, Fairness, Login, Sign up, Saved, Notifications, Profile — පිටු සාදන්න, නැත්නම් Phase 2 වන තුරු සැඟවීම/අක්‍රිය කිරීම තීරණය කරන්න (PROJECT.md: ලිස්ට් එකේ නැති feature එකතු නොකරන්න). [2026-11-07 අවසන්: Fairness පිටුව (/fairness) සාදා ඇත; Communities -> /explore; Notifications අක්‍රිය ("Soon"); Login/Sign up Phase 2 තෙක් නැත; Trending items සහ Badges "View all" ලින්ක් ඉවත් කර ඇත]
[x] 19. Demo ad slots: sidebar එකේ ඇත; feed එකේ සීමිත ස්ථාන (feed variant) සවි කරන්න, සියල්ල "Ad" ලෙස ලේබල් වී ඇත්දැයි බලන්න [2026-11-07 අවසන්: Home, Popular, Community feed වල posts 2 වැන්නට සහ 6 වැන්නට පසු (උපරිම 2); `AdSlot.tsx` හි `FEED_AD_AFTER`; සියල්ල "Ad" badge සහිතයි]
[x] 20. Search bar UI: ක්‍රියාත්මක `/search` පිටුව (sample data මත) සාදන්න [2026-11-07 අවසන්: topbar search දැන් GET form (Enter -> `/search?q=`); communities සහ posts සොයයි, popularity අනුව නොවේ, සැඟවූ posts නැත]
[x] 21. Dark/Light toggle බොත්තම ක්‍රියාත්මක කරන්න (2026-11-07 අවසන්; තේරීම browser එකේ සුරැකේ)
[x] 22. Responsive: දුරකථන පළල (≈375px) සඳහා navigation (දැන් SideNav `lg` පහළ සැඟවෙයි) සහ ඇඳුම් පරීක්ෂා කරන්න [2026-11-07 කේතය සාදා ඇත: `MobileNav.tsx` (පහළ bar + More panel) සහ shell.css; 375px හි අතින් පරීක්ෂා කළ පසු `[x]` කරන්න]
[x] 23. Empty / loading / error states: `loading.tsx`, `error.tsx`, `not-found.tsx` [2026-11-07 කේතය සාදා ඇත: app/loading.tsx, not-found.tsx, error.tsx; /nope සහ /post/999 අතින් පරීක්ෂා කළ පසු `[x]` කරන්න]
[x] 24. Accessibility ඉක්මන් පරීක්ෂාව: keyboard focus, alt/aria labels, වර්ණ වෙනස (contrast) [2026-11-07 කේතය සාදා ඇත (skip link, labels, focus, contrast, field borders); Tab යතුරෙන් අතින් පරීක්ෂා කළ පසු `[x]` කරන්න]
[x] 25. භාෂා සැකසුම: භාෂා තේරීමේ බොත්තම (දැන් `getLocale()` සැමවිටම `en`) — එක් කරනවාද Phase 2 වෙත පමාද කරනවාද තීරණය කරන්න. අලුත් translation keys එකතු කළ විට සියලු භාෂා ගොනු යාවත්කාලීන කරන්න [2026-11-07 තීරණය: භාෂා තේරීමේ බොත්තම Phase 2 වෙත පමාද කළා (ගිණුමේ භාෂා සැකසුම සමග, Auth ඉවර වූ පසු). හේතු: `getLocale()` async (cookie) කළ විට `t()` භාවිත කරන සියලු server components වෙනස් කිරීමට සිදුවේ; `metadata` ද `generateMetadata` වෙත යා යුතුයි; භාෂා 6 ම අතින් පරීක්ෂා කිරීමට පෙර UI එකේ පෙන්වීම අවදානමක්. දැනට සියලු භාෂා ගොනු වල keys 178ක් සමානයි (zh හි `.one` නැත, ar හි `.zero/.two/.few/.many` අමතරව ඇත — plural නීති නිසා නිවැරදියි). රීතිය: අලුත් key එකක් `en.ts` හි එක් කළ විට es, fr, zh, hi, ar සියල්ලටම එකවර එක් කරන්න]
[x] 26. Phase 1 අවසාන පරීක්ෂාව: lint + build, සියලු පිටු අතින් බලන්න, backup zip, CHANGELOG සහ PROJECT.md යාවත්කාලීන [2026-11-07 Claude: static පරීක්ෂා කළා (href="#" නැත, භාවිත කළ සියලු t() keys en හි ඇත, `@/` imports සියල්ල සොයාගත හැක, භාෂා 6 keys සමාන). `npm run build` සාර්ථකයි (2026-11-07); lint දෝෂය (ThemeToggle) නිවැරදි කර ඇත — නැවත `npm run lint` ධාවනය කරන්න. ඔබ කළ යුතු: `npm run lint` (දෝෂ 0 ද බලන්න), පිටු අතින් බැලීම (23, 24 හි සටහන් ඇතුළුව), backup zip; ඉන්පසු `[x]` කරන්න]

## C. Phase 2 — සත්‍ය දත්ත සහ ගිණුම්

[x] 27. Prisma + SQLite ස්ථාපනය කරන්න (ස්ථානීයව, cloud ගිණුමක් නැතිව)
[x] 28. Database schema: users, roles (user/moderator/admin), communities, posts, comments, votes, rules, reports, mod actions, audit log, appeals; content status = visible / hidden-pending-review / removed (කිසිවිටක hard-delete නැහැ); වේලාවන් UTC වලින්
[x] 29. Sample data database එකට (seed) දමා පිටු sample.ts වෙනුවට DB කියවීමට මාරු කරන්න [2026-11-07 seed සහ DB කියවීම සම්පූර්ණයි]
[x] 30. Auth.js: Sign up / Log in / Log out (email + password) [2026-11-07 Better Auth සමග සාදා ඇත. patch-34: posts, comments, votes දැන් ලොග් වූ ගිණුමෙන් සුරැකේ, ලොග් වී නැත්නම් ප්‍රතික්ෂේප වේ. පහත පරීක්ෂා 5 සාර්ථක වූ පසු `[x]` කරන්න: (1) ලොග් වී නැතිව vote/comment/post -> "Log in" පණිවිඩය; (2) sign up -> post/comment/vote සුරැකේ, author ඔබේ username; (3) පිටුව refresh කළත් ඊතලය ඉස්මතු වී පවතී; (4) log out -> ඊතල ඉස්මතු නැත; (5) `npm run lint` + `npm run build`]
[x] 31. Email verification සහ password reset [2026-11-07 patch-37: email verification කොටස (ලින්ක් එක terminal එකේ print වේ; සැබෑ email සේවාව TODO 56 වෙලාවේ). patch-38: password reset කොටස (`/forgot-password` සහ `/reset-password`; ලින්ක් එක terminal එකේ print වේ, පැයක් වලංගුයි, එක වතාවයි; password මාරු කළ පසු අනෙක් login සියල්ල වැසේ). පහත පරීක්ෂා 5 සාර්ථක වූ පසු `[x]` කරන්න: (1) `/login` -> "Forgot your password?" -> email දී ලින්ක් ඉල්ලීම -> "Check your email"; (2) terminal එකේ ලින්ක් එක ඇරීම -> "Choose a new password" form; (3) අලුත් password එකෙන් login වීම; (4) එම ලින්ක් එකම නැවත ඇරීම -> "not valid" පිටුව; (5) `npm run lint` + `npm run build`]
[x] 32. Session කළමනාකරණය (උපාංග බලන්න, අනෙක් උපාංගවලින් log out)
[x] 33. Post සහ comment සාදන්න / සංස්කරණය / මකන්න (තමන්ගේ)
[x] 34. Communities එකතු වීම / ඉවත් වීම
[x] 35. Voting [2026-11-07 patch-33: posts සහ comments votes DB එකට සුරැකේ; patch-34: stand-in user ඉවත්, ලොග් වූ ගිණුමෙන් සුරැකේ; `myVote` shared cache එකෙන් ඉවත් කර පරිශීලකයා අනුව වෙනම පූරණය (`MyVotesProvider`)]
[x] 36. Account settings: suspend, delete, data export, recover
    [x] 36a. patch-42 පදනම: `/settings` පිටුව (Your devices එකත් එහි), User table එකට suspend / delete-schedule තීරු (migration), suspend වූ ගිණුමට සීමිත ප්‍රවේශය
    [x] 36b. patch-43 Data export: තමන්ගේ දත්ත JSON ගොනුවක් ලෙස බාගත කිරීම (suspend වූ ගිණුමටත් වැඩ කරයි)
    [x] 36c. patch-44 තමන් ගිණුම delete කිරීම: password තහවුරු කිරීම, දවස් 7ක් recover කළ හැක, ඊට පසු සියලු පෞද්ගලික දත්ත මැකේ [2026-11-07 patch-36c: කේතය අවසන්; lint + build සමත්. අත්පරීක්ෂාව (README a-f) තවම ඉතිරියි]
    [x] 36d. patch-45 කාර්ය මණ්ඩල suspend / තහනම: rule + හේතුව අනිවාර්ය, audit log, දැනුම්දීම, ඉතිරි දවස්, export, appeal ලින්ක්. වර්ග දෙකක්: තාවකාලික suspend (ආපසු එයි) සහ ස්ථිර තහනම (දවස් 7 export කාලය, පසු මැකේ) [2026-11-07 patch-36d + 36d2: කේතය අවසන්; ස්ථිර තහනමට admin දෙදෙනෙකු (යෝජනා + අනුමැතිය). නීති: ACCOUNT_RULES.md. අත්පරීක්ෂාව (README a-h) තවම ඉතිරියි]
    [x] 36e. patch-46 අවසාන මැකීම (`npm run purge`): දවස් 7 ඉවර ගිණුම් මකයි, ආරක්ෂක වාර්තාව (PROJECT.md 8c) වෙන් කර තබයි, email දැනුම්දීම් [2026-11-07 patch-36e: කේතය ලියා අවසන්. `npm run purge` = පෙරදසුන, `npm run purge -- --run` = ඇත්තටම. lint + build + අත්පරීක්ෂාව (README a-i) තවම ඉතිරියි. නීති: ACCOUNT_RULES.md 3.7]
[ ] 59. Post වලට media: පින්තූර, YouTube ලින්ක්, website ලින්ක් (text තුළ ලින්ක් click කළ හැකි වීම, YouTube ලින්ක් වීඩියෝ කාඩ්පතක් ලෙස, පින්තූර ලින්ක් පින්තූරයක් ලෙස). පින්තූර upload කිරීම අවශ්‍ය නම්: ගොනු වර්ගය/ප්‍රමාණය/ගබඩාව සහ schema වෙනස් කිරීම මුලින් තීරණය කරන්න, ආරක්ෂාව TODO 52 හා සම්බන්ධයි. [2026-11-07 ඉල්ලීම: අයිතමය ලිස්ට් එකට පමණක් එක් කළා, තවම සාදා නැත. අංක 59 යොදා ඇත්තේ පහත අංක වෙනස් නොවීමටයි; check-todo.mjs ගොනු පිළිවෙලින් ඊළඟ පියවර සොයයි]

## D. Phase 3 — සාධාරණත්ව එන්ජිම

[x] 37. Ranking එක (අලුත් පරිශීලකයන්ට අවස්ථාව, එකම Popular ගිණුම් පමණක් ඉහළට නොයන) [2026-11-07 patch-37: කේතය අවසන්. `src/lib/ranking.ts` (පිරිසිදු නීති), `npm run test:ranking` (12 පරීක්ෂා), Popular පිටුව සහ /fairness පිටුවේ පැහැදිලි කිරීම. නීති: PROJECT.md 8e. අත්පරීක්ෂාව (README.txt a-e) තවම ඉතිරියි]
[x] 38. Hidden-pending-review ක්‍රියාවලිය (ක්ෂණික මැකීම වෙනුවට) [2026-11-07 patch-38h: කේතය අවසන්. දෙපියවරක ක්‍රියාවලිය: (1) hide = එම community එකේ moderator (හෝ admin) හංගයි, rule අංකය + ලිඟිත හේතුව අනිවාර්යයි, කතුවරයාට email, audit row; (2) DIFFERENT moderator / admin ‘restore’ හෝ ‘remove’ කරයි, සටහනක් ලියයි. කිසිවෙකුට තමන්ගේම දේ මත ක්‍රියා කළ නොහැක. `npm run review -- ...` (terminal එකෙන්; panel එක Phase 4), `npm run test:review` (9 පරීක්ෂා). නීති: PROJECT.md 8f. අත්පරීක්ෂාව (README.txt a-g) තවම ඉතිරියි]
[x] 39. අනිවාර්ය removal reason + නීති යොමුව [2026-11-07 patch-39r: hide / remove දෙකටම community rule අංකය + ලිඟිත හේතුව patch-38h වලින්ම අනිවාර්යයි. මෙහිදී: ඉවත් කළ post / comment එක දැන් මුළුමනින්ම නොපෙනී යන්නේ නැහැ, ‘සමාලෝචනයෙන් පසු ඉවත් කළා’ දැන්වීමක් rule + හේතුව සමඟ පෙනේ (පෙළ හිස්ව පවතී); /modlog සබැඳිය එම පිටුව විවෘත කරයි; `npm run review -- check` rule / හේතුව / audit row නැති අයිතම සොයයි. නීති: PROJECT.md 8f. අත්පරීක්ෂාව (README.txt) තවම ඉතිරියි]
[x] 40. Appeals පද්ධතිය [2026-11-07 patch-40: කේතය අවසන්. (1) ඉවත් කළ post / comment එකක කතුවරයාට `/appeal/post|comment/<id>` පිටුවෙන් (දින 30ක් ඇතුළත, එක් වරක්) appeal කළ හැක; ‘ඉවත් කළා’ දැන්වීමේ මළ බොත්තම දැන් සැබෑ සබැඳියක්; hidden (තවම පරීක්ෂාවේ) එකට ‘දෙවන moderator පරීක්ෂා කරයි’ කියා පෙනේ. (2) suspend / ban appeals (/settings, 36d) එකම පද්ධතියෙන්. (3) තීරණය කරන්නේ appellant නොවන, පළමු තීරණයට සම්බන්ධ නොවූ වෙනත් පුද්ගලයෙක් (post: hide + remove කළ අය නොවේ; ban: propose + approve කළ admin ලා නොවේ); ලිඟිත සටහනක් අනිවාර්යයි. (4) accept = post / ගිණුම ආපසු; reject = තීරණය පවතී; audit row + email; content appeal /modlog හි පෙනේ. `npm run appeals -- list|show|accept|reject`, `npm run test:appeals` (9 පරීක්ෂා). නීති: PROJECT.md 8g. අත්පරීක්ෂාව (README.txt) තවම ඉතිරියි]
[x] 41. Public mod log (සත්‍ය දත්ත, audit log එකෙන්) [2026-11-07 /modlog audit log එකෙන් කියවයි]
[x] 42. එක පුද්ගලයෙකුට ප්‍රධාන communities කීයක් ඉදිරිපත් කළ හැකිද යන සීමාව [2026-11-07 patch-42: කේතය අවසන්. ‘ප්‍රධාන’ = සාමාජිකයන් 1000+ ඇති community (modConfig). එක පුද්ගලයෙකුට එවැනි communities 3කට වඩා මෙහෙයවිය නොහැක; කුඩා ඒවාට සීමාවක් නැත. admin කෙනෙකුට පමණක් `npm run mods -- add|remove` වලින් moderator පත් කළ / ඉවත් කළ හැක (ලිඟිත හේතුවක් + audit row); අවසාන moderator ඉවත් කළ නොහැක; සීමාව ඉක්මවූවන්ට (community වැඩුණාම) role අහිමි නොවේ, `npm run mods -- check` වලින් ලැයිස්තුගත වේ. `npm run test:mods` (6 පරීක්ෂා). නීති: PROJECT.md 8h. community සෑදීමේ පහසුකම තවම නැති නිසා ඒ කාලයේදී මෙම සීමාව අනිවාර්යයෙන් යෙදිය යුතුයි. අත්පරීක්ෂාව (README.txt) තවම ඉතිරියි]
[ ] 43. Rule templates (community එකකට සරල නීති 3-5)

## E. Phase 4 — දැන්වීම් සහ ආරක්ෂාව

[x] 44. Ad system: submit form, review queue, approve/reject, campaigns, budget, "Ad" ලේබලය, frequency limits [2026-11-07 patch-ads-s7: කේතය අවසන් (ADS_PLAN.md Sessions 1-7). advertiser: `/advertise`, `/advertise/new` (text / පින්තූර / වීඩියෝ දැන්වීම්, අපේම storage එකේ), `/advertise/my` (තත්ත්වය, සංඛ්‍යා, pause / run again, end, rejected එකක් edit + නැවත යැවීම, appeal). admin: `/admin/ads` (approve / reject + නීතිය + හේතුව, paid ලකුණු කිරීම, ස්වයංක්‍රීය END), `/admin/appeals` (kind "Ad"). "frequency limits" වෙනුවට අර්ථය වෙනස් විය: සමාන වටයක් (fair rotation) + පැයක් තුළ එකම දැන්වීම නැවත නොපෙන්වීම (බ්‍රවුසරය තුළ පමණක්, අවසර සහිතව) + feed එකේ පිටුවකට දැන්වීම් 2ක් උපරිම. visitor දත්ත කිසිවක් ගබඩා නොකරයි (දිනකට දැන්වීමකට එකතුව පමණි). public mod log එකේ දැන්වීම් තීරණ පෙන්වන්නේ නැත (තීරණය: ADS_PLAN.md). `npm run test:ads` සහ `npm run check:i18n` සමත්. අත්පරීක්ෂාව + `npm run build` + `npm run lint` තවම ඉතිරියි (README-patch-ads-s7.txt). ඉතිරි වෙනම අයිතම: 45 (batch writes, bot), 46 (billing, refunds, live ads count), 56 (storage backup), Session S (social ads)]
[ ] 45. Ad impressions/clicks ගණන් කිරීම, invalid-click සහ bot ආරක්ෂාව
[ ] 46. Advertiser dashboard, billing, refunds/disputes
[ ] 47. එකම report පද්ධතිය (posts, comments, profiles, ads), priority levels, decision notices
[ ] 48. Admin panel (roles/permissions, user/content/report/ad කළමනාකරණය, admin login ආරක්ෂාව)
[ ] 49. Optional 2FA
[ ] 50. Spam ආරක්ෂාව, rate limits, bot/DDoS ආරක්ෂාව
[ ] 51. Privacy policy, Terms, Content policy (නීතිඥ සමාලෝචනය අවශ්‍යයි) [ADS 7: privacy policy එකේ පැහැදිලිව ලිවිය යුතුයි: "දැන්වීම් සඳහා අමුත්තන්ගෙන් කිසිදු දත්තයක් (user id, IP, cookie) ගබඩා නොකරයි; දැන්වීමකට දිනකට දැක්ම / click ගණන් එකතුව පමණි; අවසර ලැබුණොත් පමණක් පැයක් තුළ එකම දැන්වීම නැවත නොපෙන්වීමට අමුත්තාගේ ම උපාංගයේ සටහනක් තබයි, එය server එකට නොයැවේ; Global Privacy Control ඇත්නම් එය කිසි විටෙක භාවිත නොකරයි". දැන්වීම්කරුගේ දත්ත: ගිණුම, සම්බන්ධ email, දැන්වීම, ගෙවීම් තත්ත්වය පමණි (ගිණුම මැකූ විට email මැකේ). නීතිඥයා විසින් සමාලෝචනය කළ යුතුයි; ඊට පෙර අඩවිය පොදුවට විවෘත නොකරන්න]

## F. Phase 5 — එළිදැක්වීම

[ ] 52. ආරක්ෂාව: API, database, file upload පරීක්ෂා, secrets (.env git එකට නොදමන්න), dependency යාවත්කාලීන
[ ] 53. Operations: backups සහ restore පරීක්ෂාව, disaster recovery, monitoring, error logging, incident plan
[ ] 54. Testing: සම්පූර්ණ user journeys, ආරක්ෂාව, performance
[ ] 55. Launch readiness checklist
[ ] 56. Hosting සහ domain
[ ] 57. කණ්ඩායම බඳවා ගැනීම (නීතිය, moderation, design, engineering) — මුදල් ඇති විට
[ ] 58. Public beta, ඉන්පසු පැමිණිලි/සිදුවීම් සඳහා ක්‍රියාවලියක්
