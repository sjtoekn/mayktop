// patch-ads-list: adds the new texts (6 languages), "test:ad-list" in package.json, a CHANGELOG line and a note in ADS_PLAN.md.
// Run in the project folder (where PROJECT.md is):     node apply-ads-list.mjs        Safe to run twice.
import fs from "node:fs";

const T = {
  "admin.ads.section.history": ["History ({count})", "Historial ({count})", "Historique ({count})", "历史记录（{count}）", "इतिहास ({count})", "السجل ({count})"],
  "admin.ads.tabs": ["Ad lists", "Listas de anuncios", "Listes de publicités", "广告列表", "विज्ञापन सूचियाँ", "قوائم الإعلانات"],
  "admin.ads.search.label": ["Search ads", "Buscar anuncios", "Rechercher des publicités", "搜索广告", "विज्ञापन खोजें", "ابحث في الإعلانات"],
  "admin.ads.search.placeholder": ["number, title, text, advertiser or email", "número, título, texto, anunciante o correo", "numéro, titre, texte, annonceur ou e-mail", "编号、标题、文字、广告主或邮箱", "नंबर, शीर्षक, पाठ, विज्ञापनदाता या ईमेल", "الرقم أو العنوان أو النص أو المعلن أو البريد"],
  "admin.ads.filter.slot": ["Place", "Lugar", "Emplacement", "位置", "स्थान", "المكان"],
  "admin.ads.filter.format": ["Format", "Formato", "Format", "格式", "प्रारूप", "الصيغة"],
  "admin.ads.range": ["Showing {from}–{to} of {total}", "Mostrando {from}–{to} de {total}", "Affichage de {from} à {to} sur {total}", "显示第 {from}–{to} 条，共 {total} 条", "{total} में से {from}–{to} दिखा रहे हैं", "عرض {from}–{to} من {total}"],
  "admin.ads.empty.waiting": ["No ad is waiting for payment.", "Ningún anuncio espera el pago.", "Aucune publicité n'attend le paiement.", "没有等待付款的广告。", "कोई विज्ञापन भुगतान की प्रतीक्षा में नहीं है।", "لا يوجد إعلان ينتظر الدفع."],
  "admin.ads.empty.active": ["No ad is running now.", "Ningún anuncio se está mostrando ahora.", "Aucune publicité n'est diffusée en ce moment.", "目前没有正在投放的广告。", "अभी कोई विज्ञापन चल नहीं रहा है।", "لا يوجد إعلان قيد العرض الآن."],
  "admin.ads.empty.paused": ["No ad is paused.", "Ningún anuncio está en pausa.", "Aucune publicité n'est en pause.", "没有已暂停的广告。", "कोई विज्ञापन रोका नहीं गया है।", "لا يوجد إعلان متوقف مؤقتًا."],
  "admin.ads.empty.history": ["No rejected or ended ads yet.", "Aún no hay anuncios rechazados ni finalizados.", "Aucune publicité refusée ou terminée pour le moment.", "还没有被拒绝或已结束的广告。", "अभी तक कोई अस्वीकृत या समाप्त विज्ञापन नहीं है।", "لا توجد إعلانات مرفوضة أو منتهية بعد."],
  "admin.ads.empty.match": ["No ad matches this search.", "Ningún anuncio coincide con la búsqueda.", "Aucune publicité ne correspond à cette recherche.", "没有符合搜索条件的广告。", "इस खोज से कोई विज्ञापन मेल नहीं खाता।", "لا يوجد إعلان يطابق هذا البحث."],
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
  fs.writeFileSync(p, s.slice(0, at) + "\n  // Paged / searchable /admin/ads (patch-ads-list)\n" + lines.join("\n") + s.slice(at), "utf8");
  console.log(`added ${lines.length} texts to ${p}`);
});

// package.json: the new test, also part of "test:ads"
{
  const p = "web/package.json";
  const s = fs.readFileSync(p, "utf8");
  if (s.includes('"test:ad-list"')) console.log("already  " + p);
  else {
    const out = s
      .replace('"test:ad-csv": "tsx scripts/test-ad-csv.ts",', '"test:ad-csv": "tsx scripts/test-ad-csv.ts",\n    "test:ad-list": "tsx scripts/test-ad-list.ts",')
      .replace("&& npm run test:ad-csv\"", "&& npm run test:ad-csv && npm run test:ad-list\"");
    if (out === s) throw new Error(p + ': add "test:ad-list": "tsx scripts/test-ad-list.ts" by hand');
    fs.writeFileSync(p, out, "utf8");
    console.log("changed  " + p);
  }
}

// CHANGELOG.md: one line at the top of the newest day (never the whole file)
{
  const p = "CHANGELOG.md";
  const mark = "patch-ads-list";
  const line = "- patch-ads-list (/admin/ads: paging, search, History): the screen shows ONE tab at a time (Waiting for review, Waiting for payment, Running, Paused, History), 20 ads a page, so it stays fast with hundreds of ads. New search (ad number, title, text, advertiser name, contact email) and filters (place, format); every tab shows how many ads match. The History tab lists rejected and ended ads in a compact form (rule + reason of a rejection, run dates, totals, link to the details page; no preview, no buttons). Running ads are listed by end date (soonest first). New pure rules `src/lib/admin-ads-list-rules.ts` (`npm run test:ad-list`), new `loadAdsPage` in `admin-ads.ts` (the old `loadAds` stays). No migration, no database change, nothing about visitors.";
  if (!fs.existsSync(p)) console.log("skipped  " + p + " (not found)");
  else {
    const s = fs.readFileSync(p, "utf8");
    if (s.includes(mark)) console.log("already  " + p);
    else {
      const at = s.search(/^- /m);
      if (at < 0) throw new Error(p + ": add the patch-ads-list line by hand");
      fs.writeFileSync(p, s.slice(0, at) + line + "\n" + s.slice(at), "utf8");
      console.log("changed  " + p);
    }
  }
}

// ADS_PLAN.md: a short note at the end
{
  const p = "ADS_PLAN.md";
  const mark = "## Note from patch-ads-list";
  if (!fs.existsSync(p)) console.log("skipped  " + p + " (not found)");
  else {
    const s = fs.readFileSync(p, "utf8");
    if (s.includes(mark)) console.log("already  " + p);
    else {
      fs.writeFileSync(p, s.replace(/\s*$/, "\n") + `\n${mark} (/admin/ads: paging, search, History)\n` +
        "`/admin/ads` shows one tab at a time (queue, waiting for payment, running, paused, History), 20 ads a page (`ADS_PAGE_SIZE` in `admin-ads-list-rules.ts`), with a search (ad number, title, text, advertiser, contact email) and filters (place, format). History = REJECTED + ENDED ads, compact, no buttons. Running ads are sorted by end date. DRAFT ads are never shown to the admin. Still open for this screen: payment note / refund (TODO 46), a \"ends soon\" mark on running ads, a background job for ending-soon emails (TODO 56). Not in this patch: the same paging for `/advertise/my` (it still shows up to 100 of the advertiser's own ads).\n", "utf8");
      console.log("changed  " + p);
    }
  }
}
console.log("Done. In web/: npm run test:ad-list  npm run check:i18n  npm run lint  npm run build");
