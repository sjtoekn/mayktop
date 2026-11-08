# MaykTop — Admin panel (TODO 48)

> Written 2026-11-07. ඉලක්කය: **ලස්සන + සරල** admin panel එකක්, කොටස් වශයෙන් (Part 1 → 9). එක් කොටසක් = එක් patch = එක් වරකට පරීක්ෂා කළ හැකි වැඩක්.
> `[x]` = කේතය ලියා ඇත ("check" = අයිතිකරුගේ අත්පරීක්ෂාව ඉතිරියි), `[ ]` = තවම නැත.

## මූලික තීරණ (සියලු කොටස්වලට පොදු)

1. **නීති නැවත ලියන්නේ නැහැ.** Panel එක දැනට ඇති ශ්‍රිත (`staff.ts`, `review.ts`, `appeals.ts`, `moderators.ts`, `purge.ts`) ම කැඳවයි. Panel එකේ ඇත්තේ තිර (screens) පමණයි; fairness නීති (rule + ලිඟිත හේතුව 20+ අකුරු, අනෙක් admin ගේ අනුමැතිය, audit row, email) කේතයේ දැනටමත් බලාත්මකයි.
2. **Admin පමණයි.** `/admin` ට ඇතුල් වන්නේ ACTIVE ADMIN කෙනෙකු පමණි. ලොග් වී නැත්නම් `/login`; admin නොවේ නම් 404 (පිටුව ඇති බවවත් නොපෙන්වයි). හැම action එකකම "actor" = session එකේ username, ඉදිරිපත් කරන form එකෙන් එන අගයක් නොවේ.
3. **වෙනම frame එකක්.** Admin panel එක public site එකේ Shell (header, sidebar, ads) තුළ නොවේ; `(site)` route group + `admin` ලෙස වෙන් කරයි (Part 1).
4. **Design:** `DESIGN.md` නීති: tokens පමණයි (hex නැත), light + dark දෙකම, පෙළ සියල්ල `t()` හරහා (භාෂා 6), එක තිරයකට එක Primary බොත්තමක්, Danger බොත්තම විනාශකාරී දේට පමණයි. Admin වගුව = `.card` + සරල පේළි, වර්ණ-ලේබල් `pc-badge-*`.
5. **විනාශකාරී action** (ban, remove, erase) සියල්ලටම: හේතු පෙට්ටිය + තහවුරු කිරීමේ පියවරක්.
6. **එක් කොටසක් අවසන් වූ විට:** `npm run lint && npm run build` + README.txt හි a, b, c… අත්පරීක්ෂාව.

## කොටස් ලැයිස්තුව

### Part 1 — රාමුව + ආරක්ෂාව + Overview  [x] (patch-admin1; check ඉතිරියි)
- `(site)` route group (public site එකේ Shell එක එහි පමණක්), `/admin` වෙනම layout එක: sidebar, top bar, theme toggle, "Back to site".
- `requireAdmin()` (`src/lib/admin.ts`): login නැත → `/login`, admin නොවේ → 404.
- Overview පිටුව: සංඛ්‍යා 4ක් (people, communities, posts, comments) + "අවධානය අවශ්‍ය" ලැයිස්තුව (open reports, open appeals, hidden-pending-review, ban proposals, ads waiting).
- හැම ඉදිරි කොටසක්ම sidebar එකට තමන්ගේ මෙනු අයිතමය එකතු කරයි.

### Part 2 — People (පුද්ගලයින්)  [x] (patch-admin2; check ඉතිරියි)
- ලැයිස්තුව + සෙවුම (username / email), status පෙරහන (ACTIVE, SUSPENDED, DELETION_PENDING, DELETED), role ලේබල්.
- එක් පුද්ගලයෙකුගේ පිටුව: තත්වය, ඉතිහාසය (audit rows), posts/comments ගණන.
- Actions: **Suspend** (rule + days + reason), **Lift**, **Make admin**, **Remove admin** (නව: `removeAdmin` එක `staff.ts` ට, අවසාන admin ඉවත් කළ නොහැක, ROLE_CHANGED audit).
- Reuses: `suspendUser`, `liftSuspension`, `makeAdmin`.

### Part 3 — Ban proposals (admin දෙදෙනාගේ ban)  [x] (patch-admin3; check ඉතිරියි)
- "Propose ban" form (person page එකෙන්) + open proposals ලැයිස්තුව: proposer, rule, reason, ඉතිරි දින.
- අනුමැතිය / ප්‍රතික්ෂේපය (සටහනක් සමග). Proposer ට approve බොත්තම නොපෙන්වයි (කේතයද නවත්වයි).
- Reuses: `proposeBan`, `decideBan`, `listBanProposals`.

### Part 4 — Content review (hidden → restore / remove)  [x] (patch-admin4; check ඉතිරියි)
- "දෙවන පුද්ගලයා බලා සිටින" queue (OVERDUE ලේබලය සමග), post/comment excerpt, hide කළ අයගේ rule + හේතුව.
- Restore / Remove (සටහන අනිවාර්යයි). තමන් hide කළ දේ තමන්ටම තීරණය කළ නොහැක (කේතය බලාත්මකයි).
- Reuses: `listPending`, `decideReview`, `hideForReview`, `communityRules`, `findIncomplete`.

### Part 5 — Reports queue  [ ]
- Open reports (OPEN / IN_REVIEW), priority, reporter, rule, content preview. Action: dismiss (හේතුව) හෝ Part 4 හි hide වෙත.
- **Dependency:** TODO 47 (report button + එකම report පද්ධතිය) තවම නැත; ඒ සමග හෝ ඊට පසුව.

### Part 6 — Appeals  [x] (patch-admin6; check ඉතිරියි)
- Open appeals (OVERDUE සමග), appeal එකේ විස්තරය, මුල් තීරණය (audit row), Accept / Reject (සටහන).
- ඔබ appellant / මුල් තීරණයට සම්බන්ධ නම් බොත්තම් නැත ("ඔබට තීරණය කළ නොහැක" පණිවිඩය).
- Reuses: `listOpenAppeals`, `showAppeal`, `decideAppeal`.

### Part 7 — Communities & moderators  [x] (patch-admin7; check ඉතිරියි)
- Communities ලැයිස්තුව (සාමාජික ගණන, "large" ලේබලය), moderators, Add / Remove (reason), over-limit පරීක්ෂාව.
- Reuses: `moderatorsOf`, `appointModerator`, `removeModerator`, `findOverLimit`, `leadershipOf`.

### Part 8 — Ads  [x] (patch-admin8; check ඉතිරියි)
- Review queue (SUBMITTED): approve / reject (ad policy rule + ලිඟිත හේතුව), pause / restore, **mark as paid**, ad එකේ impressions / clicks (AdDailyStat).
- Reuses: ads schema + `adsConfig`; අලුත් `src/lib/ad-review.ts` (audit: AD_APPROVED, AD_REJECTED, AD_PAUSED, AD_RESTORED දැනටමත් enum හි ඇත).

### Part 9 — Audit log + Safety records + Erasure  [ ]
- සම්පූර්ණ audit log (පෙරහන: action, actor, target, දිනය; CSV export).
- Safety records ලැයිස්තුව, legal hold set / release (reason සමග).
- `purge` preview එක (කිසිවක් නොකර බලන්න) + "run" තහවුරු කිරීම.
- Reuses: `listSafetyRecords`, `setPersonHold`, `setRecordHold`, `runPurge`.

### Part 10 — Admin ආරක්ෂාව  [ ]
- විනාශකාරී action වලට password නැවත ඇසීම, admin session කෙටි කාලයක් (idle timeout), failed-attempt සීමාව.
- Optional 2FA (TODO 49) සහ rate limits (TODO 50) සමග සම්බන්ධ කිරීම.

## ඊළඟ පියවර
Part 1 patch එක යොදා පරීක්ෂා කරන්න (patch-admin1/README.txt). හරි නම් **Part 2 (People)** ඉල්ලන්න.
