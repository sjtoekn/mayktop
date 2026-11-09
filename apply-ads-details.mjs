// patch-ads-details: adds the texts (6 languages), the two links and the test script. Run in the project folder (where PROJECT.md is):
//     node apply-ads-details.mjs
// Safe to run twice. It adds only what is missing and never rewrites a shared file as a whole (ADS_PLAN rule 6).
import fs from "node:fs";

const must = (p) => { if (!fs.existsSync(p)) throw new Error(p + " is missing: unzip the patch into the project folder first"); };
for (const p of ["web/src/lib/ad-detail.ts", "web/src/components/AdStatsView.tsx", "web/src/app/admin/ads/stats/page.tsx"]) must(p);

// key: [en, es, fr, zh, hi, ar]
const T = {
  "ad.detail.title": ["Details of ad #{id}", "Detalles del anuncio n.º {id}", "Détails de la publicité n° {id}", "广告 #{id} 的详情", "विज्ञापन #{id} का विवरण", "تفاصيل الإعلان رقم {id}"],
  "ad.detail.title.plain": ["Ad details", "Detalles del anuncio", "Détails de la publicité", "广告详情", "विज्ञापन का विवरण", "تفاصيل الإعلان"],
  "ad.detail.link": ["Details and numbers", "Detalles y cifras", "Détails et chiffres", "详情和数据", "विवरण और आँकड़े", "التفاصيل والأرقام"],
  "ad.detail.back.my": ["Back to my ads", "Volver a mis anuncios", "Retour à mes publicités", "返回我的广告", "मेरे विज्ञापनों पर वापस", "العودة إلى إعلاناتي"],
  "ad.detail.back.admin": ["Back to ads", "Volver a los anuncios", "Retour aux publicités", "返回广告列表", "विज्ञापनों पर वापस", "العودة إلى الإعلانات"],
  "ad.detail.card.shown": ["Times shown", "Veces mostrado", "Nombre d'affichages", "展示次数", "कितनी बार दिखाया गया", "عدد مرات الظهور"],
  "ad.detail.card.clicks": ["Clicks", "Clics", "Clics", "点击次数", "क्लिक", "النقرات"],
  "ad.detail.card.ctr": ["Click rate", "Tasa de clics", "Taux de clic", "点击率", "क्लिक दर", "معدل النقر"],
  "ad.detail.card.week": ["Shown in the last 7 days", "Mostrado en los últimos 7 días", "Affichages ces 7 derniers jours", "近 7 天展示次数", "पिछले 7 दिनों में दिखाया गया", "الظهور في آخر 7 أيام"],
  "ad.detail.card.avg": ["Average shown per day", "Promedio mostrado por día", "Moyenne d'affichages par jour", "日均展示次数", "प्रति दिन औसत प्रदर्शन", "متوسط الظهور يوميًا"],
  "ad.detail.card.avg.days": ["over {days} days", "en {days} días", "sur {days} jours", "共 {days} 天", "{days} दिनों में", "على مدى {days} يومًا"],
  "ad.detail.card.best": ["Best day", "Mejor día", "Meilleur jour", "最佳日期", "सबसे अच्छा दिन", "أفضل يوم"],
  "ad.detail.card.best.shown": ["shown {count} times", "mostrado {count} veces", "affiché {count} fois", "展示 {count} 次", "{count} बार दिखाया गया", "ظهر {count} مرة"],
  "ad.detail.none": ["Nothing has been counted yet.", "Todavía no se ha contado nada.", "Rien n'a encore été compté.", "目前还没有任何统计。", "अभी तक कुछ भी गिना नहीं गया है।", "لم يُحتسب أي شيء بعد."],
  "ad.detail.trend": ["{change} compared with the 7 days before", "{change} frente a los 7 días anteriores", "{change} par rapport aux 7 jours précédents", "与前 7 天相比 {change}", "पिछले 7 दिनों की तुलना में {change}", "{change} مقارنة بالأيام السبعة السابقة"],
  "ad.detail.trend.none": ["Nothing in the last 14 days", "Nada en los últimos 14 días", "Rien ces 14 derniers jours", "近 14 天没有数据", "पिछले 14 दिनों में कुछ नहीं", "لا شيء في آخر 14 يومًا"],
  "ad.detail.trend.new": ["Nothing in the 7 days before", "Nada en los 7 días anteriores", "Rien dans les 7 jours précédents", "前 7 天没有数据", "इससे पहले के 7 दिनों में कुछ नहीं", "لا شيء في الأيام السبعة السابقة"],
  "ad.detail.period.title": ["Progress of the paid period", "Progreso del periodo pagado", "Avancement de la période payée", "付费期进度", "भुगतान की अवधि की प्रगति", "تقدّم الفترة المدفوعة"],
  "ad.detail.period": ["Day {passed} of {total} · {left} days left", "Día {passed} de {total} · quedan {left} días", "Jour {passed} sur {total} · {left} jours restants", "第 {passed} 天，共 {total} 天 · 还剩 {left} 天", "{total} में से दिन {passed} · {left} दिन बाकी", "اليوم {passed} من {total} · تبقّى {left} يومًا"],
  "ad.detail.chart.title": ["Day by day (UTC)", "Día a día (UTC)", "Jour par jour (UTC)", "每日情况（UTC）", "दिन-प्रतिदिन (UTC)", "يومًا بيوم (UTC)"],
  "ad.detail.chart.shown": ["Times shown per day", "Veces mostrado por día", "Affichages par jour", "每日展示次数", "प्रति दिन प्रदर्शन", "مرات الظهور يوميًا"],
  "ad.detail.chart.clicks": ["Clicks per day", "Clics por día", "Clics par jour", "每日点击次数", "प्रति दिन क्लिक", "النقرات يوميًا"],
  "ad.detail.table.title": ["Every day", "Cada día", "Chaque jour", "每一天", "हर दिन", "كل يوم"],
  "ad.detail.table.caption": ["Newest day first (UTC). The last {days} days.", "El día más reciente primero (UTC). Los últimos {days} días.", "Le jour le plus récent d'abord (UTC). Les {days} derniers jours.", "最新的一天在前（UTC）。最近 {days} 天。", "सबसे नया दिन पहले (UTC)। पिछले {days} दिन।", "الأحدث أولًا (UTC). آخر {days} يومًا."],
  "ad.detail.table.older": ["{days} older days are in the totals above but not listed here.", "{days} días anteriores están en los totales de arriba, pero no aparecen aquí.", "{days} jours plus anciens sont dans les totaux ci-dessus mais ne sont pas listés ici.", "更早的 {days} 天已计入上方总数，但不在此列出。", "{days} पुराने दिन ऊपर के कुल में शामिल हैं, पर यहाँ सूचीबद्ध नहीं हैं।", "{days} يومًا أقدم محتسبة في الإجماليات أعلاه لكنها غير مدرجة هنا."],
  "ad.detail.note.how": [
    "These are totals only. We do not keep who saw or clicked an ad. \"Shown\" is counted when at least half of the ad is on screen, once per page view; clicks are counted when the link is followed. Known bots are ignored. Days follow UTC time.",
    "Son solo totales. No guardamos quién vio o hizo clic en un anuncio. «Mostrado» se cuenta cuando al menos la mitad del anuncio está en pantalla, una vez por visita de página; los clics se cuentan al seguir el enlace. Se ignoran los bots conocidos. Los días siguen la hora UTC.",
    "Ce sont uniquement des totaux. Nous ne gardons pas qui a vu ou cliqué sur une publicité. Un affichage est compté quand au moins la moitié de la publicité est à l'écran, une fois par page vue ; les clics sont comptés quand le lien est suivi. Les robots connus sont ignorés. Les jours suivent l'heure UTC.",
    "这里只有总数。我们不会记录是谁看到或点击了广告。当广告至少有一半出现在屏幕上时，每次页面浏览计一次“展示”；点击在链接被打开时计数。已知的机器人会被忽略。日期按 UTC 时间计算。",
    "ये केवल कुल संख्याएँ हैं। हम यह नहीं रखते कि किसने विज्ञापन देखा या उस पर क्लिक किया। जब विज्ञापन का कम से कम आधा हिस्सा स्क्रीन पर हो, तब प्रति पेज व्यू एक बार “दिखाया गया” गिना जाता है; लिंक खोलने पर क्लिक गिना जाता है। जाने-पहचाने बॉट अनदेखे किए जाते हैं। दिन UTC समय के अनुसार हैं।",
    "هذه إجماليات فقط. لا نحتفظ بمن رأى الإعلان أو نقر عليه. يُحتسب «الظهور» عندما يكون نصف الإعلان على الأقل على الشاشة، مرة واحدة لكل زيارة للصفحة؛ وتُحتسب النقرات عند فتح الرابط. تُتجاهل الروبوتات المعروفة. الأيام وفق توقيت UTC.",
  ],
  "ad.detail.note.rotation": [
    "The fee buys a fair share of the rotation, not a promised number of views. These are the real totals.",
    "La tarifa da una parte justa de la rotación, no un número prometido de visualizaciones. Estos son los totales reales.",
    "Le tarif donne une part équitable de la rotation, pas un nombre d'affichages promis. Ce sont les totaux réels.",
    "费用买到的是轮播中的公平份额，而不是承诺的展示次数。以上是真实的总数。",
    "शुल्क से रोटेशन में उचित हिस्सा मिलता है, व्यूज़ की तय संख्या का वादा नहीं। ये असली कुल संख्याएँ हैं।",
    "الرسوم تشتري حصة عادلة من التناوب، وليس عددًا موعودًا من المشاهدات. هذه هي الإجماليات الحقيقية.",
  ],
  "admin.ads.hist.AD_APPROVED": ["Approved", "Aprobado", "Approuvée", "已批准", "स्वीकृत", "تمت الموافقة"],
  "admin.ads.hist.AD_REJECTED": ["Rejected", "Rechazado", "Rejetée", "已拒绝", "अस्वीकृत", "تم الرفض"],
  "admin.ads.hist.AD_PAID": ["Marked as paid", "Marcado como pagado", "Marquée comme payée", "已标记为已付款", "भुगतान हुआ चिह्नित", "تم تعليمه كمدفوع"],
  "admin.ads.hist.AD_PAUSED": ["Paused", "Pausado", "Mise en pause", "已暂停", "रोका गया", "تم الإيقاف المؤقت"],
  "admin.ads.hist.AD_RESTORED": ["Restored", "Restaurado", "Rétablie", "已恢复", "बहाल किया गया", "تمت الاستعادة"],
  "admin.ads.hist.AD_ENDED": ["Ended by the advertiser", "Finalizado por el anunciante", "Terminée par l'annonceur", "广告主已结束", "विज्ञापनदाता ने समाप्त किया", "أنهاه المعلن"],
  "admin.ads.hist.AD_RESUBMITTED": ["Fixed and sent again", "Corregido y enviado de nuevo", "Corrigée et renvoyée", "已修改并重新提交", "सुधारकर फिर भेजा गया", "تم تعديله وإرساله مجددًا"],
  "admin.ads.hist.APPEAL_ACCEPTED": ["Appeal accepted", "Apelación aceptada", "Appel accepté", "申诉已通过", "अपील स्वीकार की गई", "تم قبول الاعتراض"],
  "admin.ads.hist.APPEAL_REJECTED": ["Appeal rejected", "Apelación rechazada", "Appel rejeté", "申诉被驳回", "अपील अस्वीकार की गई", "تم رفض الاعتراض"],
  "admin.ads.detail.paidAt": ["Marked as paid on {date}", "Marcado como pagado el {date}", "Marquée comme payée le {date}", "于 {date} 标记为已付款", "{date} को भुगतान हुआ चिह्नित", "عُلّم كمدفوع في {date}"],
  "admin.ads.detail.history": ["History of decisions", "Historial de decisiones", "Historique des décisions", "决定记录", "निर्णयों का इतिहास", "سجل القرارات"],
  "admin.ads.detail.history.none": ["Nothing has been decided on this ad yet.", "Aún no se ha decidido nada sobre este anuncio.", "Rien n'a encore été décidé pour cette publicité.", "这条广告还没有任何决定记录。", "इस विज्ञापन पर अभी तक कोई निर्णय नहीं हुआ है।", "لم يتم اتخاذ أي قرار بشأن هذا الإعلان بعد."],
  "admin.ads.stats.link": ["Numbers for all ads", "Cifras de todos los anuncios", "Chiffres de toutes les publicités", "所有广告的数据", "सभी विज्ञापनों के आँकड़े", "أرقام كل الإعلانات"],
  "admin.ads.stats.title": ["Ad numbers", "Cifras de anuncios", "Chiffres des publicités", "广告数据", "विज्ञापन आँकड़े", "أرقام الإعلانات"],
  "admin.ads.stats.intro": ["Totals for every ad in one place. Only totals per ad per day exist; nothing about visitors is kept.", "Los totales de todos los anuncios en un solo lugar. Solo existen totales por anuncio y día; no se guarda nada sobre los visitantes.", "Les totaux de chaque publicité au même endroit. Seuls des totaux par publicité et par jour existent ; rien sur les visiteurs n'est conservé.", "所有广告的总数集中在这里。只有每条广告每天的总数，不保存任何访客信息。", "हर विज्ञापन की कुल संख्या एक जगह। केवल प्रति विज्ञापन प्रति दिन के कुल मौजूद हैं; आगंतुकों के बारे में कुछ नहीं रखा जाता।", "إجماليات كل إعلان في مكان واحد. توجد فقط إجماليات لكل إعلان في كل يوم؛ ولا يُحتفظ بأي شيء عن الزوار."],
  "admin.ads.stats.totals": ["All ads together", "Todos los anuncios juntos", "Toutes les publicités ensemble", "所有广告合计", "सभी विज्ञापन मिलाकर", "كل الإعلانات معًا"],
  "admin.ads.stats.period": ["Period", "Periodo", "Période", "时间段", "अवधि", "الفترة"],
  "admin.ads.stats.p7": ["Last 7 days", "Últimos 7 días", "7 derniers jours", "最近 7 天", "पिछले 7 दिन", "آخر 7 أيام"],
  "admin.ads.stats.p30": ["Last 30 days", "Últimos 30 días", "30 derniers jours", "最近 30 天", "पिछले 30 दिन", "آخر 30 يومًا"],
  "admin.ads.stats.all": ["All time", "Desde siempre", "Depuis le début", "全部时间", "अब तक कुल", "كل الأوقات"],
  "admin.ads.stats.running": ["Running now", "En marcha ahora", "En cours", "正在投放", "अभी चल रहे", "يعمل الآن"],
  "admin.ads.stats.group.note": ["Shown, clicks and click rate are for the last 30 days.", "Mostrado, clics y tasa de clics son de los últimos 30 días.", "Affichages, clics et taux de clic concernent les 30 derniers jours.", "展示、点击和点击率均为最近 30 天的数据。", "प्रदर्शन, क्लिक और क्लिक दर पिछले 30 दिनों की हैं।", "الظهور والنقرات ومعدل النقر لآخر 30 يومًا."],
  "admin.ads.stats.fair": ["Fair rotation check", "Control de rotación justa", "Contrôle de la rotation équitable", "公平轮播检查", "निष्पक्ष रोटेशन जाँच", "فحص التناوب العادل"],
  "admin.ads.stats.fair.none": ["No ad is running now.", "Ningún anuncio está en marcha ahora.", "Aucune publicité n'est en cours.", "目前没有正在投放的广告。", "अभी कोई विज्ञापन नहीं चल रहा।", "لا يوجد إعلان يعمل الآن."],
  "admin.ads.stats.fair.line": ["{count} running ads · fewest shown {min} · average {avg} · most shown {max} (last 7 days)", "{count} anuncios en marcha · el que menos {min} · promedio {avg} · el que más {max} (últimos 7 días)", "{count} publicités en cours · le moins affiché {min} · moyenne {avg} · le plus affiché {max} (7 derniers jours)", "{count} 条广告正在投放 · 最少展示 {min} · 平均 {avg} · 最多展示 {max}（最近 7 天）", "{count} विज्ञापन चल रहे हैं · सबसे कम {min} · औसत {avg} · सबसे अधिक {max} (पिछले 7 दिन)", "{count} إعلانًا يعمل · الأقل ظهورًا {min} · المتوسط {avg} · الأكثر ظهورًا {max} (آخر 7 أيام)"],
  "admin.ads.stats.fair.note": ["Every running ad should get a similar share. A big gap between the fewest and the most can mean ads that started late, ads limited to one community, or a problem in the rotation.", "Cada anuncio en marcha debería recibir una parte similar. Una gran diferencia entre el que menos y el que más puede indicar anuncios que empezaron tarde, anuncios limitados a una comunidad o un problema en la rotación.", "Chaque publicité en cours devrait recevoir une part similaire. Un grand écart entre le moins et le plus affiché peut indiquer des publicités commencées tard, limitées à une communauté, ou un problème de rotation.", "每条正在投放的广告应获得相近的份额。最少与最多之间差距很大，可能是广告开始较晚、仅限某个社区，或轮播出了问题。", "हर चल रहे विज्ञापन को लगभग बराबर हिस्सा मिलना चाहिए। सबसे कम और सबसे अधिक के बीच बड़ा अंतर देर से शुरू हुए विज्ञापनों, किसी एक समुदाय तक सीमित विज्ञापनों या रोटेशन की समस्या का संकेत हो सकता है।", "يجب أن يحصل كل إعلان يعمل على حصة متقاربة. الفارق الكبير بين الأقل والأكثر قد يعني إعلانات بدأت متأخرة أو مقيّدة بمجتمع واحد أو مشكلة في التناوب."],
  "admin.ads.stats.bySlot": ["By place", "Por lugar", "Par emplacement", "按位置", "स्थान के अनुसार", "حسب المكان"],
  "admin.ads.stats.byFormat": ["By format", "Por formato", "Par format", "按格式", "प्रारूप के अनुसार", "حسب الصيغة"],
  "admin.ads.stats.every": ["Every ad", "Todos los anuncios", "Toutes les publicités", "每条广告", "हर विज्ञापन", "كل إعلان"],
  "admin.ads.stats.col.ad": ["Ad", "Anuncio", "Publicité", "广告", "विज्ञापन", "الإعلان"],
  "admin.ads.stats.col.week": ["Shown, last 7 days", "Mostrado, últimos 7 días", "Affichages, 7 derniers jours", "最近 7 天展示", "पिछले 7 दिनों में दिखाया", "الظهور، آخر 7 أيام"],
  "admin.ads.stats.limit": ["Showing {shown} of {total} ads (the ones shown most).", "Se muestran {shown} de {total} anuncios (los más mostrados).", "{shown} publicités sur {total} affichées (les plus affichées).", "显示 {total} 条广告中的 {shown} 条（展示最多的）。", "{total} में से {shown} विज्ञापन दिखाए गए (सबसे अधिक दिखाए गए)।", "عرض {shown} من {total} إعلانًا (الأكثر ظهورًا)."],
};

const langs = ["en", "es", "fr", "zh", "hi", "ar"];
langs.forEach((lang, i) => {
  const p = `web/src/i18n/messages/${lang}.ts`;
  must(p);
  let s = fs.readFileSync(p, "utf8");
  const have = (k) => s.includes(JSON.stringify(k) + ":");
  const lines = Object.entries(T).filter(([k]) => !have(k)).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[i])},`);
  if (lines.length === 0) { console.log("already  " + p); return; }
  const closer = lang === "en" ? "} as const;" : "};";
  const at = s.lastIndexOf("\n" + closer);
  if (at < 0) throw new Error(p + ": cannot find the end of the texts");
  s = s.slice(0, at) + "\n  // Ad details (patch-ads-details)\n" + lines.join("\n") + s.slice(at);
  fs.writeFileSync(p, s, "utf8");
  console.log(`added ${lines.length} texts to ${p}`);
});

function edit(p, anchor, insert, marker) {
  must(p);
  const s = fs.readFileSync(p, "utf8");
  if (s.includes(marker)) { console.log("already  " + p); return; }
  if (!s.includes(anchor)) throw new Error(p + ": cannot find the place to add the link (the file was changed). Add it by hand, see README-patch-ads-details.txt");
  fs.writeFileSync(p, s.replace(anchor, insert), "utf8");
  console.log("changed  " + p);
}

// "Details" link on each ad of /advertise/my
edit(
  "web/src/app/(site)/advertise/my/page.tsx",
  "              <MyAdActions adId={ad.id} actions={ad.actions} text={text} />",
  `              <div className="adv-actions">\n                <Link href={\`/advertise/my/\${ad.id}\`} className="btn btn-ghost btn-sm">\n                  {t("ad.detail.link")}\n                </Link>\n              </div>\n              <MyAdActions adId={ad.id} actions={ad.actions} text={text} />`,
  'ad.detail.link',
);

// "Details" link on each ad of /admin/ads, and a link to the numbers of all ads at the top
edit(
  "web/src/app/admin/ads/page.tsx",
  `                <div className="ad-actionRow">\n`,
  `                <div className="ad-actionRow">\n                  <Link href={\`/admin/ads/\${ad.id}\`} className="btn btn-primary btn-sm">\n                    {t("ad.detail.link")}\n                  </Link>\n`,
  'ad.detail.link',
);
edit(
  "web/src/app/admin/ads/page.tsx",
  `        <p className="pc-text">{t("admin.ads.intro")}</p>\n`,
  `        <p className="pc-text">{t("admin.ads.intro")}</p>\n        <div className="ad-actionRow">\n          <Link href="/admin/ads/stats" className="btn btn-ghost btn-sm">\n            {t("admin.ads.stats.link")}\n          </Link>\n        </div>\n`,
  'admin.ads.stats.link',
);
edit(
  "web/src/app/admin/ads/page.tsx",
  `import { formatNumber, t } from "@/i18n";`,
  `import Link from "next/link";\nimport { formatNumber, t } from "@/i18n";`,
  'import Link from "next/link"',
);

// npm scripts
{
  const p = "web/package.json";
  must(p);
  const s = fs.readFileSync(p, "utf8");
  if (s.includes('"test:ad-detail"')) console.log("already  " + p);
  else {
    let out = s.replace('"test:ad-social": "tsx scripts/test-ad-social.ts",', '"test:ad-social": "tsx scripts/test-ad-social.ts",\n    "test:ad-detail": "tsx scripts/test-ad-detail.ts",');
    out = out.replace("&& npm run test:ad-social\"", "&& npm run test:ad-social && npm run test:ad-detail\"");
    if (out === s) throw new Error(p + ": cannot find the test scripts; add \"test:ad-detail\": \"tsx scripts/test-ad-detail.ts\" by hand");
    fs.writeFileSync(p, out, "utf8");
    console.log("changed  " + p);
  }
}
console.log("Done. Now run in web/:  npm run test:ad-detail   npm run check:i18n   npm run lint   npm run build");
