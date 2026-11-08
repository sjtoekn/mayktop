// patch-ads-sS (ADS_PLAN Session S / SOCIAL_TODO 32: ads in the Social feed).
// Small, safe-to-repeat edits of SHARED files only (Rule 6 of ADS_PLAN.md). Make a backup zip first.
// Run in the project folder (where PROJECT.md is), AFTER copying the patch files.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (f) => fs.readFileSync(f, "utf8");
const write = (f, s) => fs.writeFileSync(f, s);
const stop = (m) => { console.error("STOP: " + m); process.exit(1); };
let problems = 0;
const problem = (m) => { console.log("PROBLEM: " + m); problems++; };

for (const f of ["web/src/lib/ad-positions.ts", "web/src/components/ad-social.css", "web/scripts/test-ad-social.ts", "web/prisma/migrations/20261109090000_ad_social_slot/migration.sql"]) {
  if (!fs.existsSync(path.join(root, f))) stop(`copy the patch files first (${f} is missing).`);
}
if (!fs.existsSync(path.join(root, "web/scripts/check-i18n.ts"))) stop("install patch-ads-s7 first (web/scripts/check-i18n.ts is missing).");

function edit(file, label, done, from, to) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { problem(`${file}: not found (${label})`); return; }
  const s = read(full);
  if (done(s)) { console.log(`${file}: already done (${label})`); return; }
  const n = s.split(from).length - 1;
  if (n !== 1) { problem(`${file}: ${label}: expected 1 place, found ${n} (nothing changed there)`); return; }
  write(full, s.replace(from, () => to));
  console.log(`${file}: ${label} done`);
}
function tick(file, label, start, text) {
  const full = path.join(root, file);
  const lines = read(full).split("\n");
  const i = lines.findIndex((l) => l.startsWith("- [ ] " + start) || l.startsWith("- [x] " + start));
  if (i < 0) { problem(`${file}: ${label}: line starting "${start}" not found`); return; }
  if (lines[i].startsWith("- [x] ")) { console.log(`${file}: already done (${label})`); return; }
  lines[i] = "- [x] " + lines[i].slice(6) + (text ? " " + text : "");
  write(full, lines.join("\n"));
  console.log(`${file}: ${label} done`);
}

// ------------------------------------------------------------------ schema + config
edit("web/prisma/schema.prisma", "AdSlotType SOCIAL_FEED", (s) => s.includes("SOCIAL_FEED"),
  "  FEED // between posts in a feed (max 2 per page, see AdSlot.tsx)\n}",
  "  FEED // between posts in a feed (max 2 per page, see src/lib/ad-positions.ts)\n  SOCIAL_FEED // between posts in the Social feed, in the clearly different social look (ADS_PLAN decision 11, Session S)\n}");
edit("web/src/config/site.ts", "slots", (s) => s.includes('"SOCIAL_FEED"'),
  '  slots: ["SIDEBAR", "FEED"] as const,',
  '  slots: ["SIDEBAR", "FEED", "SOCIAL_FEED"] as const,');

// ------------------------------------------------------------------ server code
edit("web/src/lib/ad-input.ts", "social ad has no community", (s) => s.includes('slot === "SOCIAL_FEED"'),
  'communitySlug: communityRaw === "" ? null : communityRaw,',
  'communitySlug: communityRaw === "" || slot === "SOCIAL_FEED" ? null : communityRaw,');
edit("web/src/lib/queries.ts", "getAdPool slot type", (s) => s.includes('slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED"'),
  'export async function getAdPool(slot: "SIDEBAR" | "FEED", communitySlug',
  'export async function getAdPool(slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED", communitySlug');
edit("web/src/app/api/ad/pool/route.ts", "accept SOCIAL_FEED", (s) => s.includes('slot !== "SOCIAL_FEED"'),
  'if (slot !== "SIDEBAR" && slot !== "FEED") {',
  'if (slot !== "SIDEBAR" && slot !== "FEED" && slot !== "SOCIAL_FEED") {');
edit("web/src/lib/ad-mine.ts", "slot type", (s) => s.includes('"SOCIAL_FEED"'),
  '  slot: "SIDEBAR" | "FEED";', '  slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED";');
edit("web/src/lib/admin-ads.ts", "slot type", (s) => s.includes('"SOCIAL_FEED"'),
  '  slot: "SIDEBAR" | "FEED";', '  slot: "SIDEBAR" | "FEED" | "SOCIAL_FEED";');

// ------------------------------------------------------------------ pages
edit("web/src/app/(site)/advertise/new/page.tsx", "slot names + social note", (s) => s.includes("SOCIAL_FEED"),
  '    slotNames: { SIDEBAR: t("advertise.new.slot.SIDEBAR"), FEED: t("advertise.new.slot.FEED") },',
  '    slotNames: { SIDEBAR: t("advertise.new.slot.SIDEBAR"), FEED: t("advertise.new.slot.FEED"), SOCIAL_FEED: t("advertise.new.slot.SOCIAL_FEED") },\n    slotSocialNote: t("advertise.new.slot.SOCIAL_FEED.note"),');
edit("web/src/app/(site)/advertise/my/page.tsx", "slot badge", (s) => s.includes("advertise.new.slot.${ad.slot}"),
  '{t(ad.slot === "SIDEBAR" ? "advertise.new.slot.SIDEBAR" : "advertise.new.slot.FEED")}',
  '{t(`advertise.new.slot.${ad.slot}`)}');
edit("web/src/app/admin/ads/page.tsx", "slot badge", (s) => s.includes("admin.ads.slot.${ad.slot}"),
  '{t(ad.slot === "SIDEBAR" ? "admin.ads.slot.SIDEBAR" : "admin.ads.slot.FEED")}',
  '{t(`admin.ads.slot.${ad.slot}`)}');
edit("web/src/app/admin/ads/page.tsx", "social preview look", (s) => s.includes('ad.slot === "SOCIAL_FEED"'),
  '<aside className="card card-ad ads-preview" aria-label={t("ad.label")}>',
  '<aside className={`card card-ad ads-preview${ad.slot === "SOCIAL_FEED" ? " ad-social" : ""}`} aria-label={t("ad.label")}>');
edit("web/src/app/admin/ads/page.tsx", "social css import", (s) => s.includes("ad-social.css"),
  'import "./ads.css";', 'import "@/components/ad-social.css";\nimport "./ads.css";');
edit("web/src/app/(site)/social/page.tsx", "imports", (s) => s.includes("isSocialAdPosition"),
  'import SocialPostCard from "@/components/social/SocialPostCard";',
  'import { Fragment } from "react";\nimport AdSlot, { isSocialAdPosition } from "@/components/AdSlot";\nimport SocialPostCard from "@/components/social/SocialPostCard";');
edit("web/src/app/(site)/social/page.tsx", "ads in the feed", (s) => s.includes('variant="social"'),
  `        feed.map((post) => (
          <SocialPostCard
            key={post.id}
            post={post}
            isLiked={likedIds.has(post.id)}
            viewer={viewer.username}
            isFollowing={followingNames.has(post.author)}
          />
        ))`,
  `        feed.map((post, index) => (
          <Fragment key={post.id}>
            <SocialPostCard
              post={post}
              isLiked={likedIds.has(post.id)}
              viewer={viewer.username}
              isFollowing={followingNames.has(post.author)}
            />
            {/* Social ads (ADS_PLAN decision 11): limited places (src/lib/ad-positions.ts), clearly NOT a post. */}
            {isSocialAdPosition(index) && <AdSlot variant="social" />}
          </Fragment>
        ))`);

// ------------------------------------------------------------------ package.json
edit("web/package.json", "scripts", (s) => s.includes('"test:ad-social"'),
  '    "test:ads": "npm run test:ad-input && npm run test:ad-media && npm run test:ad-own && npm run test:ad-appeal && npm run test:ad-review",',
  '    "test:ad-social": "tsx scripts/test-ad-social.ts",\n    "test:ads": "npm run test:ad-input && npm run test:ad-media && npm run test:ad-own && npm run test:ad-appeal && npm run test:ad-review && npm run test:ad-social",');

// ------------------------------------------------------------------ texts (six languages)
const T = {
  en: { slot: "Social feed (between Social posts)", note: "Shown between posts in the Social feed, in a box that is clearly not a post: no like, repost or reply buttons. The page choice does not apply; it shows in the whole Social feed.", admin: "Social feed", adv: "Advertiser" },
  es: { slot: "Feed Social (entre publicaciones Social)", note: "Se muestra entre las publicaciones del feed Social, en un recuadro claramente distinto de una publicación: sin botones de me gusta, compartir ni responder. La elección de página no se aplica; se muestra en todo el feed Social.", admin: "Feed Social", adv: "Anunciante" },
  fr: { slot: "Fil Social (entre les publications Social)", note: "Affichée entre les publications du fil Social, dans un encadré clairement différent d'une publication : pas de bouton j'aime, repartager ou répondre. Le choix de la page ne s'applique pas ; elle s'affiche dans tout le fil Social.", admin: "Fil Social", adv: "Annonceur" },
  zh: { slot: "社交动态（社交帖子之间）", note: "显示在社交动态的帖子之间，样式明显不同于帖子：没有点赞、转发或回复按钮。页面选项不适用；广告会显示在整个社交动态中。", admin: "社交动态", adv: "广告主" },
  hi: { slot: "सोशल फ़ीड (सोशल पोस्ट के बीच)", note: "सोशल फ़ीड में पोस्ट के बीच एक ऐसे बॉक्स में दिखता है जो साफ़ तौर पर पोस्ट नहीं है: लाइक, रीपोस्ट या जवाब के बटन नहीं हैं। पेज का चुनाव लागू नहीं होता; यह पूरे सोशल फ़ीड में दिखता है।", admin: "सोशल फ़ीड", adv: "विज्ञापनदाता" },
  ar: { slot: "الخلاصة الاجتماعية (بين المنشورات الاجتماعية)", note: "يظهر بين المنشورات في الخلاصة الاجتماعية داخل صندوق يختلف بوضوح عن المنشور: بلا أزرار إعجاب أو إعادة نشر أو رد. لا ينطبق اختيار الصفحة؛ يظهر في الخلاصة الاجتماعية كلها.", admin: "الخلاصة الاجتماعية", adv: "المعلن" },
};
for (const lang of Object.keys(T)) {
  const file = path.join(root, `web/src/i18n/messages/${lang}.ts`);
  if (!fs.existsSync(file)) { problem(`${lang}.ts not found`); continue; }
  let s = read(file);
  let changed = false;
  const add = (key, anchorRe, value) => {
    if (s.includes(`"${key}":`)) return;
    const m = anchorRe.exec(s);
    if (!m) { problem(`${lang}.ts: anchor for ${key} not found`); return; }
    s = s.replace(m[0], () => m[0] + `  ${JSON.stringify(key)}: ${JSON.stringify(value)},\n`);
    changed = true;
  };
  add("advertise.new.slot.SOCIAL_FEED", /^  "advertise\.new\.slot\.FEED":.*\n/m, T[lang].slot);
  add("advertise.new.slot.SOCIAL_FEED.note", /^  "advertise\.new\.slot\.SOCIAL_FEED":.*\n/m, T[lang].note);
  add("admin.ads.slot.SOCIAL_FEED", /^  "admin\.ads\.slot\.FEED":.*\n/m, T[lang].admin);
  add("ad.social.advertiser", /^  "ad\.badge":.*\n/m, T[lang].adv);
  if (changed) { write(file, s); console.log(`${lang}.ts: texts done`); } else console.log(`${lang}.ts: already done`);
}

// ------------------------------------------------------------------ documents
tick("ADS_PLAN.md", "Session S slot", "Add `SOCIAL_FEED` to `AdSlotType`", "(patch-ads-sS; migration `20261109090000_ad_social_slot`)");
tick("ADS_PLAN.md", "Session S component", "New component for the `social` variant", "(patch-ads-sS: `AdBox` variant \"social\" + `ad-social.css`: dashed thick border, ad colours, \"Ad\" badge first, \"Advertiser: host\", no avatar / profile link / like / repost / reply / share)");
tick("ADS_PLAN.md", "Session S placement", "Place it in the social feed", "(patch-ads-sS: after the posts at `SOCIAL_AD_AFTER` = 3rd and 8th, max 2, never first; `src/lib/ad-positions.ts`; only on `/social`, which is for logged-in people)");
tick("ADS_PLAN.md", "Session S form + review", "`/advertise/new` offers the social slot", "(patch-ads-sS: the page choice is hidden for it, the community is always empty; `/admin/ads` and `/advertise/my` name the slot, the admin preview uses the social look)");
tick("ADS_PLAN.md", "Session S docs", "Update `PROJECT.md` 8i and `DATABASE.md`", "(patch-ads-sS)");
edit("ADS_PLAN.md", "Session S status", (s) => s.includes("## Session S done"),
  "## Rule 6 (added after Session 2)",
  "## Session S done (patch-ads-sS, 2026-11-09)\nSocial ads are built: slot `SOCIAL_FEED`, the social look, two places in `/social`. After copying run `npx prisma migrate dev` and `npx prisma generate`; `npm run test:ad-social` passed in the build chat; `npm run lint`, `npm run build` and the manual flow of `README-patch-ads-sS.txt` are still to be run on the owner's machine. Not in this session: ads on the single post page `/social/[id]` (none on purpose), the Following feed (SOCIAL_TODO 17: when it exists, use `isSocialAdPosition` there too).\n\n## Rule 6 (added after Session 2)");
edit("PROJECT.md", "8i social ads built", (s) => s.includes("**Built (Session S,"),
  "**Not built yet:** the slot `SOCIAL_FEED` (added to `AdSlotType` when the Social feed is built).",
  "**Built (Session S, 2026-11-09):** the slot `SOCIAL_FEED`. In `/social` an ad goes after the 3rd and the 8th post (`SOCIAL_AD_AFTER` in `src/lib/ad-positions.ts`: never first, at most 2). Its look is `AdBox` variant `social` + `ad-social.css`: a thick dashed border and the ad colours (not the post card), the \"Ad\" badge first, \"Advertiser: <site>\", \"Why this ad?\", and nothing else: no avatar, no profile link, no like, repost, reply or share. A Social ad has no community (Social has none); the form hides that choice. It is shown only where the Social feed is shown (logged-in people).");
edit("DATABASE.md", "AdSlotType", (s) => s.includes("slot (SIDEBAR / FEED / SOCIAL_FEED)"),
  "slot (SIDEBAR / FEED)", "slot (SIDEBAR / FEED / SOCIAL_FEED)");
{
  const f = path.join(root, "SOCIAL_TODO.md");
  const lines = read(f).split("\n");
  const i = lines.findIndex((l) => l.startsWith("[ ] 32. `SOCIAL_FEED`") || l.startsWith("[x] 32. `SOCIAL_FEED`"));
  if (i < 0) problem("SOCIAL_TODO.md: item 32 not found");
  else if (lines[i].startsWith("[x]")) console.log("SOCIAL_TODO.md: already done (32)");
  else {
    lines[i] = "[x]" + lines[i].slice(3) + " [2026-11-09 patch-ads-sS: කේතය අවසන්. `SOCIAL_FEED` slot (migration `ad_social_slot`), `AdBox` variant \"social\" + `ad-social.css`, `/social` හි 3 වන සහ 8 වන post වලට පසු උපරිම දැන්වීම් 2ක් (`src/lib/ad-positions.ts`). අත්පරීක්ෂාව + lint + build තවම ඉතිරියි (README-patch-ads-sS.txt)]";
    write(f, lines.join("\n"));
    console.log("SOCIAL_TODO.md: 32 ticked");
  }
}
{
  const f = path.join(root, "CHANGELOG.md");
  const s = read(f);
  if (s.includes("patch-ads-sS")) console.log("CHANGELOG.md: already done");
  else if (!/## 2026-11-07\n/.test(s)) problem("CHANGELOG.md: heading '## 2026-11-07' not found");
  else {
    const line = "- patch-ads-sS (ADS_PLAN Session S, SOCIAL_TODO 32): ads in the Social feed. New `AdSlotType` value `SOCIAL_FEED` (migration `20261109090000_ad_social_slot`, no table change; run `npx prisma migrate dev` and `npx prisma generate`); `adsConfig.slots`, `getAdPool`, `/api/ad/pool`, the form checks (a Social ad never has a community) and the types know it. `AdBox` has a third variant `social` (new `ad-social.css`): thick dashed border and ad colours, \"Ad\" badge first, \"Advertiser: <site>\", \"Why this ad?\"; no avatar, profile link, like, repost, reply or share. `/social` shows an ad after the 3rd and the 8th post (`SOCIAL_AD_AFTER`; the feed positions moved to the pure file `src/lib/ad-positions.ts`, `AdSlot.tsx` re-exports them). `/advertise/new` offers \"Social feed\" (the page choice is replaced by a short note); `/admin/ads` shows the ad in its social look; `/advertise/my` and `/admin/ads` name the slot. 4 new texts in six languages. `npm run test:ad-social` (added to `npm run test:ads`).";
    write(f, s.replace(/(## 2026-11-07\n)/, (m) => m + line + "\n"));
    console.log("CHANGELOG.md: done");
  }
}
console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): read the lines marked PROBLEM above. Nothing else was damaged; fix by hand or ask for help.`);
process.exit(problems === 0 ? 0 : 1);
