// patch-ads-my-list: adds the new texts (6 languages), "test:ad-mine-list" in package.json, a CHANGELOG line and a note in ADS_PLAN.md.
// Run in the project folder (where PROJECT.md is):     node apply-ads-my-list.mjs        Safe to run twice.
import fs from "node:fs";

const T = {
  "advertise.my.tabs": ["Your ads", "Tus anuncios", "Vos publicités", "您的广告", "आपके विज्ञापन", "إعلاناتك"],
  "advertise.my.tab.all": ["All ({count})", "Todos ({count})", "Toutes ({count})", "全部（{count}）", "सभी ({count})", "الكل ({count})"],
  "advertise.my.tab.running": ["Running ({count})", "En curso ({count})", "En cours ({count})", "投放中（{count}）", "चल रहे ({count})", "قيد العرض ({count})"],
  "advertise.my.tab.waiting": ["Waiting ({count})", "En espera ({count})", "En attente ({count})", "等待中（{count}）", "प्रतीक्षा में ({count})", "قيد الانتظار ({count})"],
  "advertise.my.tab.rejected": ["Rejected ({count})", "Rechazados ({count})", "Refusées ({count})", "已拒绝（{count}）", "अस्वीकृत ({count})", "مرفوضة ({count})"],
  "advertise.my.tab.ended": ["Ended ({count})", "Finalizados ({count})", "Terminées ({count})", "已结束（{count}）", "समाप्त ({count})", "منتهية ({count})"],
  "advertise.my.range.label": ["Numbers for", "Cifras de", "Chiffres sur", "数据范围", "आँकड़े", "الأرقام لمدة"],
  "advertise.my.range.7": ["Last 7 days", "Últimos 7 días", "7 derniers jours", "最近 7 天", "पिछले 7 दिन", "آخر 7 أيام"],
  "advertise.my.range.30": ["Last 30 days", "Últimos 30 días", "30 derniers jours", "最近 30 天", "पिछले 30 दिन", "آخر 30 يومًا"],
  "advertise.my.range.90": ["Last 90 days", "Últimos 90 días", "90 derniers jours", "最近 90 天", "पिछले 90 दिन", "آخر 90 يومًا"],
  "advertise.my.range.all": ["All time", "Todo el tiempo", "Depuis le début", "全部时间", "अब तक", "كل الوقت"],
  "advertise.my.stats.range": ["Last {days} days: shown {impressions} times · {clicks} clicks · {ctr} click rate", "Últimos {days} días: mostrado {impressions} veces · {clicks} clics · {ctr} de clics", "{days} derniers jours : affichée {impressions} fois · {clicks} clics · {ctr} de taux de clic", "最近 {days} 天：展示 {impressions} 次 · 点击 {clicks} 次 · 点击率 {ctr}", "पिछले {days} दिन: {impressions} बार दिखा · {clicks} क्लिक · क्लिक दर {ctr}", "آخر {days} يومًا: عُرض {impressions} مرة · {clicks} نقرة · معدل النقر {ctr}"],
  "advertise.my.stats.dayByDay": ["For the numbers day by day, open \"Details and numbers\".", "Para las cifras día a día, abre «Detalles y cifras».", "Pour les chiffres jour par jour, ouvrez « Détails et chiffres ».", "每天的数据请打开“详情与数据”。", "दिन-दर-दिन आँकड़ों के लिए “विवरण और आँकड़े” खोलें।", "للاطلاع على الأرقام يومًا بيوم افتح «التفاصيل والأرقام»."],
  "advertise.my.showing": ["Showing {from}–{to} of {total}", "Mostrando {from}–{to} de {total}", "Affichage de {from} à {to} sur {total}", "显示第 {from}–{to} 条，共 {total} 条", "{total} में से {from}–{to} दिखा रहे हैं", "عرض {from}–{to} من {total}"],
  "advertise.my.empty.tab": ["You have no ads in this list.", "No tienes anuncios en esta lista.", "Vous n'avez aucune publicité dans cette liste.", "此列表中没有广告。", "इस सूची में आपका कोई विज्ञापन नहीं है।", "ليس لديك إعلانات في هذه القائمة."],
  "advertise.my.prev": ["Previous", "Anterior", "Précédent", "上一页", "पिछला", "السابق"],
  "advertise.my.next": ["Next", "Siguiente", "Suivant", "下一页", "अगला", "التالي"],
  "advertise.my.page": ["Page {page} of {pages}", "Página {page} de {pages}", "Page {page} sur {pages}", "第 {page} 页，共 {pages} 页", "पृष्ठ {page} / {pages}", "الصفحة {page} من {pages}"],
};

const langs = ["en", "es", "fr", "zh", "hi", "ar"];
langs.forEach((lang, i) => {
  const p = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(p)) throw new Error(p + " is missing");
  const s = fs.readFileSync(p, "utf8");
  const lines = Object.entries(T).filter(([k]) => !s.includes(JSON.stringify(k) + ":")).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[i])},`);
  if (!lines.length) return console.log("already  " + p);
  const at = s.lastIndexOf("\n" + (lang === "en" ? "} as const;" : "};"));
  if (at < 0) throw new Error(p + ": cannot find the end of the texts");
  fs.writeFileSync(p, s.slice(0, at) + "\n  // Tabs, number range and paging of /advertise/my (patch-ads-my-list)\n" + lines.join("\n") + s.slice(at), "utf8");
  console.log(`added ${lines.length} texts to ${p}`);
});

// package.json: the new test, also part of "test:ads"
{
  const p = "web/package.json";
  const s = fs.readFileSync(p, "utf8");
  if (s.includes('"test:ad-mine-list"')) console.log("already  " + p);
  else {
    const entry = '"test:ad-mine-list": "tsx scripts/test-ad-mine-list.ts",';
    const after = s.includes('"test:ad-list": "tsx scripts/test-ad-list.ts",') ? '"test:ad-list": "tsx scripts/test-ad-list.ts",' : '"test:ad-csv": "tsx scripts/test-ad-csv.ts",';
    const tail = s.includes("&& npm run test:ad-list\"") ? "&& npm run test:ad-list\"" : "&& npm run test:ad-csv\"";
    const out = s.replace(after, after + "\n    " + entry).replace(tail, tail.slice(0, -1) + " && npm run test:ad-mine-list\"");
    if (out === s) throw new Error(p + ": add " + entry + " by hand");
    fs.writeFileSync(p, out, "utf8");
    console.log("changed  " + p);
  }
}

// CHANGELOG.md: one line at the top of the newest day (never the whole file)
{
  const p = "CHANGELOG.md";
  const mark = "patch-ads-my-list";
  const line = "- patch-ads-my-list (/advertise/my: tabs, number range, paging): the advertiser's list now has tabs (All, Running = running + paused, Waiting = draft + sent + approved, Rejected, Ended) that show how many ads each holds, 10 ads a page (it used to load up to 100 at once), and a choice of range for the numbers: last 7 days (the day-by-day table, as before), last 30 or 90 days (one line with shown / clicks / click rate; the day-by-day table is on the details page) or all time. The tab and the range stay when the other one changes. New pure rules `src/lib/ad-mine-list-rules.ts` (`npm run test:ad-mine-list`), new `loadMyAdsPage` in `ad-mine.ts` (replaces `loadMyAds`, which only this page used). No migration, no database change, nothing about visitors.";
  if (!fs.existsSync(p)) console.log("skipped  " + p + " (not found)");
  else {
    const s = fs.readFileSync(p, "utf8");
    if (s.includes(mark)) console.log("already  " + p);
    else {
      const at = s.search(/^- /m);
      if (at < 0) throw new Error(p + ": add the patch-ads-my-list line by hand");
      fs.writeFileSync(p, s.slice(0, at) + line + "\n" + s.slice(at), "utf8");
      console.log("changed  " + p);
    }
  }
}

// ADS_PLAN.md: a short note at the end
{
  const p = "ADS_PLAN.md";
  const mark = "## Note from patch-ads-my-list";
  if (!fs.existsSync(p)) console.log("skipped  " + p + " (not found)");
  else {
    const s = fs.readFileSync(p, "utf8");
    if (s.includes(mark)) console.log("already  " + p);
    else {
      fs.writeFileSync(p, s.replace(/\s*$/, "\n") + `\n${mark} (/advertise/my: tabs, number range, paging)\n` +
        "`/advertise/my` has tabs (All, Running, Waiting, Rejected, Ended), 10 ads a page (`MY_PAGE_SIZE` in `ad-mine-list-rules.ts`) and a range for the numbers (last 7 / 30 / 90 days or all time; default 7). The range is a preset, not free dates; the day-by-day numbers (last 60 days) are on the details page (`/advertise/my/<id>`). Still open for this screen: payment details and a refund request (TODO 46), \"run this ad again\" for an ended ad, a live \"N ads running now\" number (TODO 46).\n", "utf8");
      console.log("changed  " + p);
    }
  }
}
console.log("Done. In web/: npm run test:ad-mine-list  npm run check:i18n  npm run lint  npm run build");
