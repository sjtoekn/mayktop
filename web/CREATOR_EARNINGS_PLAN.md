# Creator Earnings + Creator Overview Dashboard: වැඩ සැලසුම (TODO 12 / 13 / 14)

> මේ ෆයිල් එක repo එකේ root එකට දාන්න. ඕනෑම Claude ගිණුමකට (හෝ වෙන කෙනෙකුට) එක සැසියකට එක කොටස බැගින් මේක අනුව ගොඩනඟන්න පුළුවන්.
> **හැම සැසියක්ම පටන් ගන්න කලින්:** `AGENTS.md` කියවන්න (මේ Next.js එකේ conventions වෙනස්; `node_modules/next/dist/docs/` බලන්න), `npm install` කරන්න, සහ මේ ෆයිල් එකේ "තත්ත්ව වගුව" බලන්න. සැසිය අවසානයේ ඒ වගුව update කරන්න.

---

## 1. තීරණ කරපු දේවල් (ඔබ කියපු ඒවා)

1. **පළමු අදියර:** නිර්මාණකරුවන්ට ඔවුන්ගේ ප්‍රශ්න/උත්තර පිටුවල පෙන්වන ඇඩ් වලින් ආදායමක් බෙදනවා.
2. **ගෙවන්නේ impressions වලට පමණයි.** Click මත ගෙවුවොත් ක්ලික් කරන පුද්ගලයා ගැන දත්ත එකතු කරන්න වෙනවා. ඒක අපි කරන්නේ නැහැ (පවතින ඇඩ් පද්ධතියේ privacy නීතියට ගැලපෙනවා: visitor ගැන කිසිවක් ගබඩා නොකිරීම).
3. **ගෙවීම් ලබන රටවල්: ශ්‍රී ලංකාව සහ ඉන්දියාව පමණයි (දැනට).**
   - දෙරටටම **PayPal** මගින්.
   - ශ්‍රී ලංකාවට **බැංකු ගිණුමකට** කෙලින්ම ගෙවීමත් කළ හැක.
4. **වෙනත් රටවල අයට:** ගෙවීම තාවකාලිකව නවත්වනවා. ආදායම **සටහන් කරගෙන තබාගන්නවා, නොනැසී.** ගෙවීම් ක්‍රම පැහැදිලි වූ පසු සම්පූර්ණයෙන්ම ගෙවනවා. ඒ අතරතුර ඔවුන්ට කැමති නම් ඒ ශේෂය **තමන්ගේ දේ ප්‍රචාරණය කරන ඇඩ් ගාස්තු විදිහට** භාවිතා කළ හැක.
5. ඒ සියල්ල ගැන පැහැදිලි **notes** (වැඩසටහනට සම්බන්ධ වන විටත්, dashboard එකේත්) පෙන්වනවා.
6. වැඩේ **කොටස් (සැසි) වලට** කඩලා තියෙනවා, එක සැසියක් එකම වරකට කරන්න පුළුවන් විදිහට.
7. TODO 13 (tips, paid sponsored posts, premium questions) **මේකට පස්සේ**. ඒවා මේ ledger එකම භාවිතා කරයි.

## 2. පද්ධතියේ ස්වභාවය (කේතය බලලා)

- ඇඩ් **මාසික ස්ථාවර මිලකට** (`AdCampaign.priceCents`) විකුණන්නේ. Per-impression මිලක් නැහැ.
- Impressions ගණන් කරන්නේ `POST /api/ad/impression` (`src/app/api/ad/impression/route.ts` + `src/lib/ad-stats.ts`) හරහා, `AdDailyStat(adId, date)` එකේ. **ඒක දැන් කියන්නේ "මොන ඇඩ් එකද" කියලා විතරයි, "මොන පිටුවේද" කියලා නෙමෙයි.** ඒ නිසා නිර්මාණකරුවාට බෙදන්න නම් මේ ඉල්ලීමට **content එක (post id)** එකතු කරන්න වෙනවා. (පුද්ගලයා නෙවෙයි, පිටුව පමණයි.)
- ඇඩ් පෙන්වන තැන්: `AdBox.tsx` / `AdSlot.tsx` (sidebar, feed, social, header), Shorts (`ShortsAdCard`), Photos (`PhotoAdTile`). Q&A පිටුව: `src/app/(site)/post/[id]/page.tsx`.
- ඇඩ් ගෙවීම දැනට **අතින්** (admin `paymentStatus = PAID` කරනවා, `AD_PAID` audit). ඒ නිසා ආදායම ගණන් බලන්නේ **PAID ඇඩ්** වලින් පමණයි.
- Reputation, bounty (`reputation.ts`, `bounty.ts`) තියෙන්නේ ලකුණු පද්ධතියක්. ඒවා මුදල් නෙවෙයි; මේ අලුත් ledger එකට සම්බන්ධ කරන්න එපා.
- කේතයේ නීති: කිසිවක් hard-delete නොකිරීම (`onDelete: Restrict`), හැම admin ක්‍රියාවක්ම `AuditLog` එකට, මුදල් සංඛ්‍යා `src/config/site.ts` එකේ පමණක්, pure rules ෆයිල් + `scripts/test-*.ts` පරීක්ෂණ, භාෂා 6ක් (`npm run check:i18n`).

## 3. මුදල බෙදන ආකෘතිය (නිර්දේශය: "Revenue pool")

ඇඩ් වල මිල ස්ථාවර නිසා "impression එකකට රු. X" කියලා නියත අගයක් දුන්නොත් අපිට ලැබුණාට වඩා වැඩියෙන් ගෙවන්න වෙන්න පුළුවන්. ඒ වෙනුවට:

1. එක ඇඩ් එකක් PAID වූ කාලපරිච්ඡේදයට, ඒකේ මිලෙන් **creatorSharePercent** (config; උදා. 50%) ක් "creator pool" එකට වෙන් වෙනවා.
2. ඒ ඇඩ් එකේ **සියලු impressions** අතරින් creator-attributed impressions වලට (Q&A පිටුවල) පමණක් pool එක බෙදෙනවා:
   `rate = poolCents ÷ ඇඩ් එකේ මුළු impressions`, `creator earning = rate × ඒ creator ගේ content වල impressions`.
3. Creator content නොවන තැන් (header, home feed...) වල impressions අපිටම (platform). ඒ කොටසට creators ගෙවන්නේ නැහැ.
4. **ඒක කවදාවත් ඇඩ් එකෙන් ලැබූ මුදලට වඩා නොයනවා.** ඒ නිසා ආරක්ෂිතයි.
5. එක පිටුවක impression එක බෙදන ආකාරය (v1 නිර්දේශය, තීරණය කරන්න): **ප්‍රශ්නය ඇසූ අයට 30%, පිළිගත් (accepted) උත්තරයට 50%, ඉතිරි 20% ඉහළම ඡන්ද ලද අනිත් උත්තරවලට.** accepted උත්තරයක් නැත්නම් ඒ 50% ඉහළම ඡන්ද ලද උත්තරයට. උත්තර නැත්නම් සම්පූර්ණයම ප්‍රශ්නය ඇසූ අයට.
6. ගණන් රඳා පවතින්නේ **පෙනෙන (VISIBLE) content** එකට පමණයි. Remove/hide කළ දේට ආදායම නැහැ (settlement වේලාවේදී පරීක්ෂා කරනවා).
7. මුදල් ගබඩා කරන්නේ **පූර්ණ සංඛ්‍යා** විදිහට (micro-USD). දශම ගැටලු වලක්වන්න. ඇඩ් මිල USD (config `currency`).

## 4. Privacy ආරක්ෂා කරන ක්‍රම

- Impression beacon එකට එකතු වෙන්නේ `contentRef` (පිටුවේ post id) පමණයි. IP, cookie, user id **කිසිවක් ගබඩා නොකරයි.**
- ගබඩා කරන්නේ දවසකට, ඇඩ් එකකට, content එකකට **එකතු කළ ගණනක්** (`ContentAdStat`). Creator කවුද කියලා අනුමාන කරන්නේ **settlement** එකේදී, content එකේ author ගෙන්.
- Bot filter සහ per-ad rate limit (`ad-guard.ts`) දැනටමත් තියෙනවා. ඒවා නැවත භාවිතා කරනවා. **Impression එක "අඩක් තිරයේ පෙනුණාම" ගණන් ගන්නවා (දැනට `AdBox` එකේ තියෙන විදිහටම).**
- Creator ගේ **ගෙවීම් තොරතුරු** (PayPal email, බැංකු ගිණුම) ඔවුන්ගේම දත්ත. ගිණුම මකන විට (`purge`) මකන්න, ගබඩා කරන විට encrypt කරන්න. බැංකු ගිණුම් අංක plain text ලෙස ගබඩා නොකරන්න (විකල්පය: ගෙවන වේලාවේ පමණක් ඉල්ලීම).

## 5. වංචා/අනිසි භාවිතය ගැන

පුද්ගලයා හඳුනාගන්නේ නැති නිසා සම්පූර්ණ වැළැක්වීමක් බැහැ. ස්ථර කිහිපයක ආරක්ෂාව:
- Creator **තමන්ගේම පිටුව බලන විට** ගණන් නොගන්න (session එක ඇත්නම් beacon එකේදී පරීක්ෂා කරනවා පමණයි, කිසිවක් සුරකින්නේ නැහැ).
- එක content එකකට දවසකට උපරිම ගණනක් (config) සහ අසාමාන්‍ය ඉහළ යාමක් admin ට flag කරනවා.
- ආදායම **hold කාලයක්** (උදා. දින 30) ඇතුළත "ගෙවිය හැකි" වෙන්නේ නැහැ; ඒ කාලයේ වංචාවක් හමු වුණොත් ආපසු හරවන්න (reversal entry) පුළුවන්.
- අවම ගෙවීම් සීමාවක් (උදා. USD 10).

## 6. තීරණ අවශ්‍ය දේවල් (S0: ඔබ තීරණය කරන්න)

| # | තීරණය | නිර්දේශය |
|---|---|---|
| D1 | Creator share % | 50% (අවසන් අගය ඔබ) |
| D2 | පිටුවක impression බෙදීම (ඉහත 3.5) | 30/50/20 |
| D3 | අවම ගෙවීම, hold දින | USD 10, දින 30 |
| D4 | වැඩසටහනට සම්බන්ධ වීම opt-in (නියමයන් පිළිගැනීම) ද? | ඔව්. සම්බන්ධ වූ දින සිට ආදායම ගණන් ගන්නවා |
| D5 | v1 හි ආදායම ලැබෙන්නේ Q&A පිටුවලින් පමණද? (Shorts/Photos/Social පසුව) | ඔව්, Q&A පමණයි |
| D6 | ගෙවීම් පළමුව **අතින්** (admin CSV අපනයනය → PayPal/බැංකුවෙන් ගෙවා → "paid" ලකුණු කිරීම) ද, API හරහාද? | අතින් (ඇඩ් ගෙවීම් වගේම). API පසුව |
| D7 | Ad credit (ගෙවීම් නොලැබෙන රටවල අයට) අවම/උපරිම සීමා | සම්පූර්ණ ශේෂයම භාවිතා කළ හැක, ආපසු මුදලට හැරවීමක් නැත |

### තහවුරු කරගත යුතු බාහිර දේ (ගෙවීම් පෙර)
- **PayPal:** ලංකාවේ බැංකු ගිණුම්වලට PayPal ලැබීම 2026 මැයි 15 සිට ආරම්භ වී ඇති බව වාර්තා වෙනවා (Bank of Ceylon, Commercial, Sampath). **අපේ platform එකෙන් බොහෝ දෙනෙකුට එකවර (mass payout) PayPal ගෙවීම් යැවීම ලංකාවට සහ ඉන්දියාවට ඇත්තටම පුළුවන්ද** කියා PayPal වෙතින්ම තහවුරු කරගන්න. ඉන්දියාවේ PayPal රීති වෙනම බැලිය යුතුයි (මෙහි මම තහවුරු කළේ නැහැ).
- **ශ්‍රී ලංකා බැංකු ගෙවීම:** ඔබේ බැංකුව / Wise / Stripe Global Payouts (LK බැංකු ගිණුම් සඳහා සහාය ඇත) අතරින් එකක් තෝරන්න.
- **බදු සහ නීති:** නිර්මාණකරුවන්ට ගෙවන ආදායම්වලට බදු/Central Bank රීති ගැන ගණකාධිකාරියෙකු හෝ නීතිඥයෙකු සමඟ කතා කරන්න.

---

## 7. සැසි (කොටස්) ලැයිස්තුව

හැම සැසියකම: කේතය + `scripts/test-*.ts` පරීක්ෂණ + `npm run lint` + `npm run build` + (text ඇත්නම්) `npm run check:i18n`. සැසිය අවසානයේ ඊළඟ සැසිය ආරම්භ කරන්න පුළුවන් තත්ත්වයක තබන්න.

### S1: නීති සහ config (pure, UI නැත)
- `src/config/site.ts` එකට `creatorsConfig` (share %, split 30/50/20, hold දින, අවම ගෙවීම, payout රටවල් `["LK","IN"]`, උපරිම impressions/content/දින).
- `src/lib/creator-rules.ts`: පිටුවක impression එක author අතර බෙදීම, rate ගණනය, micro-USD rounding (ඉතිරි කොටස් නැතිවීම නොවන සේ), රටක් ගෙවීමට සුදුසුද (`isPayoutCountry`).
- `scripts/test-creator-rules.ts` (+ `package.json` හි `test:creator-rules`).
- **අවසන් නිර්ණායකය:** බෙදුම් එකතුව සෑම විටම pool එකට සමාන; ඇඩ් මිලට වැඩි නොවෙයි.

### S2: Database
- Prisma migration (නව ෆයිල් එකක්, පරණ ඒවා වෙනස් කරන්න එපා):
  - `ContentAdStat(date, contentType, contentId, adId, impressions)` @@id එකතුව.
  - `CreatorProfile(userId @id, joinedAt, termsVersion, payoutCountry, payoutMethod, payoutDetails (encrypted))`.
  - `EarningEntry` (append-only ledger): `id, userId, kind (SHARE | REVERSAL | CREDIT_SPEND | PAYOUT), adId?, periodStart, periodEnd, amountMicroUsd, status (ACCRUED | HELD_COUNTRY | PAYABLE | PAID | VOID), createdAt, note`.
  - `PayoutBatch` + `Payout` (admin ගෙවීම් සටහන්).
  - `AuditAction` වලට: `PAYOUT_MARKED_PAID`, `EARNING_REVERSED`, `CREATOR_HOLD_SET` වැනි අලුත් අගයන්.
- `DATABASE.md` (තියෙනවා නම්) update.
- **නිර්ණායකය:** `prisma migrate` සහ `npm run db:check` සාර්ථකයි.

### S3: Impression collection (content සමඟ)
- `/api/ad/impression` ඉල්ලීමට විකල්ප `post` (post id) එකතු කරන්න; server එක පරීක්ෂා කරයි (post VISIBLE, ඇඩ් ACTIVE+PAID, slot එක Q&A පිටුවකට අයත්).
- `AdBox`/`AdSlot` වලට contentRef prop; `post/[id]/page.tsx` එකෙන් යැවීම.
- `ContentAdStat` ලියන `countAdOnContent` (`ad-stats.ts` ආකාරයටම, සාර්ථක නොවුණොත් නිහඬව).
- Per-content දවසේ සීමාව, creator තමන්ගේම පිටුව බලන විට ගණන් නොගැනීම.
- **නිර්ණායකය:** පවතින `AdDailyStat` ගණන් වෙනස් නොවේ; අලුත් ගණන් නිවැරදිව ලියවේ. පරීක්ෂණ: `scripts/test-creator-collect.ts`.

### S4: Settlement (ආදායම ගණනය)
- `scripts/creator-settle.ts` (`npm run creator:settle`) සහ `src/lib/creator-settle.ts`.
- ඇඩ් කාලපරිච්ඡේදයක් අවසන් වූ (හෝ මාසික කපන දිනය පැමිණි) PAID ඇඩ් වලට: rate ගණනය, author විසඳීම, `EarningEntry` ලිවීම. **Idempotent** (දෙවරක් දිවුවත් එකම ප්‍රතිඵලය).
- රට අනුව `status`: LK/IN → hold කාලය පසු `PAYABLE`; වෙනත් රටවල් / රටක් නොදුන් → `HELD_COUNTRY` (ආදායම ඉතිරි වේ, නැති නොවේ).
- Removed/hidden content, ban වූ ගිණුම් ඒවායේ ආදායම `VOID`/hold.
- **නිර්ණායකය:** සියලු entries එකතුව ≤ ඒ ඇඩ් වල creator pool.

### S5: Creator Overview dashboard (read-only) (**ඔබ ඉල්ලූ dashboard එක**)
- මාර්ගය: `/creator` (නිර්දේශය), `src/lib/creator-overview.ts` (read-model) + page + css.
- කොටස්:
  1. සාරාංශය: මේ මාසයේ impressions, **ඇස්තමේන්තු** ආදායම (settle නොවූ කොටස "ඇස්තමේන්තු" ලෙස ලේබල් කරන්න), ශේෂ (ACCRUED / PAYABLE / HELD / PAID).
  2. දවස අනුව impressions ප්‍රස්තාරය (අවසන් දින 30).
  3. Content වගුව: කුමන ප්‍රශ්න/උත්තර වලින් කොපමණ ලැබුණාද.
  4. ගෙවීම් තත්ත්වය: ඔබේ රට, ක්‍රමය, ඊළඟ ගෙවීම, ගෙවීම් ඉතිහාසය.
  5. **Note බැනරය** (රට LK/IN නොවේ නම්): "දැනට ගෙවීම් ලංකාවට සහ ඉන්දියාවට පමණයි. ඔබේ ආදායම නැති නොවේ; ගෙවීම් ක්‍රම පැහැදිලි වූ පසු සම්පූර්ණයෙන්ම ගෙවනවා. ඒ අතරතුර ඔබට කැමති නම් ඔබේ දෙයක් ප්‍රචාරණය කිරීමට ඇඩ් ගාස්තු ලෙස මෙය භාවිතා කළ හැක."
- Dataviz skill/රටාව පවතින `AdStatsView.tsx` ට ගැලපෙන ලෙස; පැහැදිලි, dark/light.
- භාෂා 6 (`en`, `zh`, `hi`, `es`, `fr`, `ar`). `check:i18n` සමත් විය යුතුයි.
- **නිර්ණායකය:** දත්ත නැති නව creator ට හිස් තත්ත්වය (empty state) ලස්සනට පෙනේ; සංඛ්‍යා S4 ledger එකට ගැළපේ.

### S6: වැඩසටහනට සම්බන්ධ වීම සහ ගෙවීම් සැකසුම්
- "Join creator program" පෝරමය: නියමයන් පිළිගැනීම, **රට තෝරන්න**, ගෙවීම් ක්‍රමය (PayPal email / ලංකාවේ බැංකු ගිණුම). සම්බන්ධ වන වේලාවේම ඉහත note පෙන්වන්න: **"දැනට ගෙවීම් ශ්‍රී ලංකාවට සහ ඉන්දියාවට පමණයි."**
- `/settings` ට "Creator earnings" කොටසක්; ගෙවීම් තොරතුරු වෙනස් කිරීම (වෙනස් කළ විට hold කාලයක්/සත්‍යාපනයක්).
- Account erase (`purge`) එකට creator දත්ත ඇතුළත් කරන්න (ගෙවීම් තොරතුරු මකා, ledger එකේ ගණන් පමණක් නිර්නාමිකව).

### S7: Ad credit (ඉතිරි රටවල අයට, සහ ඕනෑම කෙනෙකුට)
- ශේෂය (ACCRUED/HELD/PAYABLE) ඇඩ් ගෙවීමට යෙදීම: `CREDIT_SPEND` entry + `AdCampaign` ගෙවීමක් ලෙස `PAID` (ගෙවීම් ක්‍රමය "credit" ලෙස සටහන් කරන්න, admin ට පෙනේ, audit).
- `advertise/new` සහ `advertise/my` හි "ඔබේ ආදායමෙන් ගෙවන්න" විකල්පය.
- **අවධානය:** creator ගේ ආදායමෙන්ම ඇඩ් ගෙවා, ඒ ඇඩ් එකෙන් නැවත ආදායම ලැබීම (loop) නිසා වංචාවක් නොවීමට පරීක්ෂා කිරීමක් (උදා. තමන්ගේ ඇඩ් එක තමන්ගේ content වල පෙන්වන විට ආදායම ගණන් නොගැනීම).

### S8: Admin ගෙවීම් කළමනාකරණය
- `src/app/admin/payouts/`: PAYABLE ශේෂ ලැයිස්තුව (රට අනුව පෙරන්න), **CSV අපනයනය** (PayPal / බැංකු ගෙවීම් සඳහා), "paid" ලකුණු කිරීම (batch), hold/reversal (audit සහිතව).
- `AdminNav` ට සබැඳියක්. Ban/removal වූ ගිණුම්වල ආදායම අතින් සමාලෝචනය.
- **නිර්ණායකය:** `PAID` ලකුණු කළාම ledger එකේ `PAYOUT` entry; දෙවරක් ගෙවීම වැළකේ.

### S9: පොදු පිටු සහ පිළිගැනීම
- Creator Program නියමයන්/FAQ පිටුව (පවතින `/fairness` පිටුවේ ආකාරයට), privacy සටහන update: "ගෙවීම impressions මත පමණි; ඔබව හඳුනාගන්නා දත්ත එකතු නොකරයි."
- Advertiser පැත්තට සටහන: ඇඩ් ආදායමෙන් කොටසක් නිර්මාණකරුවන්ට බෙදෙයි.

### S10: පිටවීමට පෙර පරීක්ෂා
- සියලු `test:*`, `lint`, `build`, `check:i18n`.
- ඇත්ත දත්ත සමඟ settle කර අතින් ගණන් සත්‍යාපනය.
- 6 වන කොටසේ "තහවුරු කරගත යුතු බාහිර දේ" (PayPal mass payout, බදු) අවසන් වී ඇත්ද?

### පසුව (TODO 13, වෙනම සැලසුමක්)
Tips, paid sponsored posts, premium questions. S2 හි ledger (`EarningEntry`) එකම භාවිතා කරන්න (`kind` අලුත් අගයන් එක් කර).

---

## 8. තත්ත්ව වගුව (හැම සැසියකින්ම update කරන්න)

| සැසිය | තත්ත්වය | සටහන |
|---|---|---|
| S0 තීරණ | ✅ 2026-11-24 | D1–D7 සියල්ල නිර්දේශිත අගයන්ට අනුමත කළා (`creatorsConfig` හි තියෙනවා) |
| S1 නීති/config | ✅ 2026-11-24 | `creatorsConfig` (site.ts), `src/lib/creator-rules.ts`, `npm run test:creator-rules` සමත්. `lint`/`build` දිවුවේ නැහැ (node_modules/network නැති පරිසරයක); ඊළඟ සැසියේ `npm install` කර දුවන්න |
| S2 Database | ✅ 2026-11-24 (ඔබේ පරිසරයේ migrate පරීක්ෂා කරන්න) | migration `20261201090000_creator_earnings`: `ContentAdStat`, `CreatorProfile`, `EarningEntry`, `PayoutBatch`, `Payout`; `AuditAction` (+4) සහ `AuditTarget` (+2) අගයන්. "held/payable" ගබඩා නොකරයි, `earningState()` මගින් ගණනය කරයි. `payoutId` මගින් ගෙවූ rows සලකුණු. `settleAd` දැන් ledger rows (`entries`) දෙයි |
| S3 Collection | ✅ 2026-11-24 (ඔබේ පරිසරයේ lint/tsc/අතින් පරීක්ෂා කරන්න) | `/api/ad/impression` දැන් `{id, post?}` පිළිගනී; `post` ඇත්නම් `ContentAdStat` ලියයි (post VISIBLE, creator තමන්ගේම පිටුව බැලුවොත් නොගනී, පිටුවකට විනාඩියකට 120 / ඇඩ් එකකට දවසට 5000 සීමා). `AdBox` pathname (`/post/<id>`) එකෙන් පිටුව තීරණය කරයි, Shell/post page වෙනස් කළේ නැහැ. `npm run test:creator-collect` |
| S4 Settlement | ✅ කේතය 2026-11-24 (ඔබේ පරිසරයේ migrate/tsc/`creator:settle` preview පරීක්ෂා කරන්න) | migration `20261202090000_ad_creator_settled` (`AdCampaign.creatorSettledAt`). `creator-settle-rules.ts` (pure), `creator-settle.ts` (DB), `npm run creator:settle` (preview; `-- --run` ලියයි). ඇඩ් එක ENDED හෝ endDate ඉකුත්, PAID, unsettled වූ විට එක්වරක් settle වේ. CreatorProfile ඇති අයට පමණක්, joined දවසේ සිට; banned/erased = VOID; උත්තරවලට ධනාත්මක vote score අවශ්‍යයි. **S7 සටහන:** credit වලින් ගෙවූ ඇඩ් වල pool එක ගැන නීතියක් එකතු කරන්න |
| S5 Dashboard | ✅ කේතය 2026-11-24 (ඔබේ පරිසරයේ `lint`/`tsc`/`build` සහ ඇත්ත දත්ත සමඟ බලන්න) | `/creator` (read-only). `creator-overview-rules.ts` (pure: දින 30, මාසික, balances, next payout) + `creator-overview.ts` (DB) + page + `creator-overview.css` (`ad-detail.css` හි `adt-*` භාවිතා). කාඩ්: මාසික impressions, **ඇස්තමේන්තු** (settle නොවූ PAID ඇඩ් `computeSettlement` මගින්, කිසිවක් නොලියයි), බලා සිටින/ගෙවිය හැකි/රඳවාගත් (රට)/payout එකක/ගෙවූ. ප්‍රස්තාරය, පිටු වගුව (ඉහළම 25), ගෙවීම් තත්ත්වය + ඉතිහාසය. Join නොවූවන්ට ආරාධනාව; LK/IN නොවන රටවලට note බැනරය. Impressions ගණන් කරන්නේ join වූ දිනයෙන් (D4). `creator-settle.ts` හි `computeSettlement` වෙන් කළා (`settleOneAd` එයම භාවිතා කරයි). `npm run test:creator-overview`. **S8 සටහන:** payout `PENDING/PAID/FAILED` බව dashboard එක බලයි |
| S6 Join + settings | ✅ කේතය 2026-11-24 (ඔබේ පරිසරයේ `npm install`, `lint`, `tsc`/`build` සහ අතින් පරීක්ෂා කරන්න) | `/settings/creator` (join: terms + රට + ක්‍රමය; edit: මුරපදය නැවත ඉල්ලයි, වෙනස් කළොත් දින `detailsChangeHoldDays` (7) hold + e-mail දැනුම්දීම). `creator-profile-rules.ts` (pure, AES-256-GCM, masking), `creator-profile.ts` (DB), `CreatorProgramForm`, `npm run test:creator-profile`. **අවශ්‍ය setting:** `.env` හි `CREATOR_PAYOUT_KEY` (hex 64 ක්: `openssl rand -hex 32`); නැත්නම් ගෙවීම් තොරතුරු සුරැකෙන්නේ නැහැ (රට පමණක් සුරැකේ). `purge` දැන් payout රට/ක්‍රමය/තොරතුරු මකයි (ledger සහ join දිනය ඉතිරි); `/settings/export` හි `creator` කොටසක් (තොරතුරු masked). Settings hub හි සබැඳිය. **S8 සටහන:** payout එකකට ඇතුළත් කිරීමට පෙර `detailsHoldOver(profile.payoutDetailsChangedAt)` සහ `earningsHold` පරීක්ෂා කරන්න; ගෙවන වේලාවේ `decryptDetails` භාවිතා කරන්න. **S5 සටහන:** `/creator` dashboard එකේ `/settings/creator` සබැඳියක් දමන්න |
| S7 Ad credit | ☐ | |
| S8 Admin payouts | ✅ කේතය 2026-11-24 (ඔබේ පරිසරයේ `npx prisma generate`, `lint`, `tsc`/`build` සහ අතින් පරීක්ෂා කරන්න) | `/admin/payouts`: ready ලැයිස්තුව (රට පෙරහන LK/IN), **payout round** සෑදීම (transaction එක ඇතුළේ නැවත ගණනය, row එකක් payout එකකට පමණක්), CSV (PayPal / බැංකු; `/admin/payouts/export?batch=&method=`, cents වලට පහළට රවුම්, formula-safe, තොරතුරු decrypt වන්නේ ගොනුව තුළ පමණයි, `CREATOR_PAYOUT_KEY` අවශ්‍යයි), **paid** ලකුණු (reference අනිවාර්යයි, එකම reference දෙවරක් වැළකේ, දෙවරක් ගෙවීම වැළකේ), **failed** (මුදල් ආපසු open balance එකට), freeze/release, open balance reverse (freeze වූ හෝ ACTIVE නොවන ගිණුමකට පමණයි; REVERSAL row, කිසිවක් නොමැකේ). `creator-payout-rules.ts` (pure), `creator-payouts.ts` (DB), `PayoutAction.tsx`, `npm run test:creator-payouts`. Audit: `PAYOUT_BATCH_CREATED`, `PAYOUT_FAILED` (schema හි අලුත් enum 2ක්; migration SQL අවශ්‍ය නැහැ, `prisma generate` පමණයි) + දැනටමත් තිබූ `PAYOUT_MARKED_PAID`, `EARNING_REVERSED`, `CREATOR_HOLD_SET/RELEASED`. "PAYOUT entry" නිර්ණායකය: `EarningEntry.payoutId` + `Payout.status=PAID` (S2 ආකෘතිය). CSV export එකට audit row නැහැ. Payout round සෑදූ පසු creator ගේ තොරතුරු වෙනස් කළොත් ඒ payout එක CSV වලින් ඉවත් වේ (failed කරන්න) |
| S9 පිටු | ✅ කේතය 2026-11-24 (ඔබේ පරිසරයේ `lint`/`tsc`/`build` සහ පිටුව අතින් බලන්න) | `/creator-program` (නියමයන් + FAQ, `/fairness` ආකාරයට; සියලු සංඛ්‍යා `creatorsConfig` වෙතින්), privacy සටහන ("impressions පමණයි, ඔබව හඳුනාගන්නා දත්ත නැත"), `/advertise` හි advertiser සටහන ("ඇඩ් මිලෙන් {share}% creators ට"), `/creator` පිටු වලින් සබැඳිය, sitemap (`staticSitemapPaths`) එකට එකතු කළා. භාෂා 6. **S7 සටහන:** "ඇඩ් ගාස්තු ලෙස භාවිතා කළ හැක" යන වාක්‍යය නියමයන් පිටුවේ "හැකි වේවි" ලෙස ලියා ඇත; S7 කරන විට නිවැරදි කරන්න |
| S10 Launch checks | ☐ | |

## 9. වෙනත් Claude ගිණුමකට දීමට ආරම්භක පණිවිඩය (කොපි කරන්න)

> මේ repo එක (zip) සහ `CREATOR_EARNINGS_PLAN.md` බලන්න. `AGENTS.md` කියවන්න, `npm install` කරන්න. තත්ත්ව වගුවේ ඊළඟ අසම්පූර්ණ සැසිය (S__) පමණක් කරන්න. එහි "නිර්ණායකය" සපුරන තුරු; සම්පූර්ණ කළාම පරීක්ෂණ දිවුවා, වගුව update කළා, සහ අවසානයේ වෙනස් වූ ෆයිල් ලැයිස්තුවක් දෙන්න. D1–D7 තීරණ මුලින් මගෙන් ඇසිය යුතුයි, අනුමාන කරන්න එපා.
