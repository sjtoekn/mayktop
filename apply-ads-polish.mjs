// patch-ads-polish: proper "1 day / 2 days" texts on the ad details pages (replaces 5 texts in 6 languages).
// Run in the project folder (where PROJECT.md is):   node apply-ads-polish.mjs      Safe to run twice.
import fs from "node:fs";
const L = ["en", "es", "fr", "zh", "hi", "ar"];
// key -> { lang: text }. The text of a key that already exists is replaced.
const T = {
  "ad.detail.period": { en: "Day {passed} of {total}", es: "Día {passed} de {total}", fr: "Jour {passed} sur {total}", zh: "第 {passed} 天，共 {total} 天", hi: "{total} में से दिन {passed}", ar: "اليوم {passed} من {total}" },
  "ad.detail.period.left.one": { en: "{n} day left", es: "queda {n} día", fr: "{n} jour restant", hi: "{n} दिन बाकी", ar: "تبقّى يوم واحد" },
  "ad.detail.period.left.two": { ar: "تبقّى يومان" },
  "ad.detail.period.left.few": { ar: "تبقّت {n} أيام" },
  "ad.detail.period.left.many": { ar: "تبقّى {n} يومًا" },
  "ad.detail.period.left.other": { en: "{n} days left", es: "quedan {n} días", fr: "{n} jours restants", zh: "还剩 {n} 天", hi: "{n} दिन बाकी", ar: "تبقّى {n} يوم" },
  "ad.detail.card.avg.days.one": { en: "over {n} day", es: "en {n} día", fr: "sur {n} jour", hi: "{n} दिन में", ar: "على مدى يوم واحد" },
  "ad.detail.card.avg.days.two": { ar: "على مدى يومين" },
  "ad.detail.card.avg.days.few": { ar: "على مدى {n} أيام" },
  "ad.detail.card.avg.days.many": { ar: "على مدى {n} يومًا" },
  "ad.detail.card.avg.days.other": { en: "over {n} days", es: "en {n} días", fr: "sur {n} jours", zh: "共 {n} 天", hi: "{n} दिनों में", ar: "على مدى {n} يوم" },
  "ad.detail.card.best.shown.one": { en: "shown {n} time", es: "mostrado {n} vez", fr: "affiché {n} fois", hi: "{n} बार दिखाया गया", ar: "ظهر مرة واحدة" },
  "ad.detail.card.best.shown.two": { ar: "ظهر مرتين" },
  "ad.detail.card.best.shown.few": { ar: "ظهر {n} مرات" },
  "ad.detail.card.best.shown.many": { ar: "ظهر {n} مرة" },
  "ad.detail.card.best.shown.other": { en: "shown {n} times", es: "mostrado {n} veces", fr: "affiché {n} fois", zh: "展示 {n} 次", hi: "{n} बार दिखाया गया", ar: "ظهر {n} مرة" },
  "ad.detail.table.caption.one": { en: "Newest day first (UTC). Showing {n} day.", es: "El día más reciente primero (UTC). Se muestra {n} día.", fr: "Le jour le plus récent d'abord (UTC). {n} jour affiché.", hi: "सबसे नया दिन पहले (UTC)। {n} दिन दिखाया गया।", ar: "الأحدث أولًا (UTC). يُعرض يوم واحد." },
  "ad.detail.table.caption.two": { ar: "الأحدث أولًا (UTC). يُعرض يومان." },
  "ad.detail.table.caption.few": { ar: "الأحدث أولًا (UTC). تُعرض آخر {n} أيام." },
  "ad.detail.table.caption.many": { ar: "الأحدث أولًا (UTC). تُعرض آخر {n} يومًا." },
  "ad.detail.table.caption.other": { en: "Newest day first (UTC). Showing the last {n} days.", es: "El día más reciente primero (UTC). Se muestran los últimos {n} días.", fr: "Le jour le plus récent d'abord (UTC). Les {n} derniers jours affichés.", zh: "最新的一天在前（UTC）。显示最近 {n} 天。", hi: "सबसे नया दिन पहले (UTC)। पिछले {n} दिन दिखाए गए।", ar: "الأحدث أولًا (UTC). تُعرض آخر {n} يوم." },
  "ad.detail.table.older.one": { en: "{n} older day is in the totals above but not listed here.", es: "{n} día anterior está en los totales de arriba, pero no aparece aquí.", fr: "{n} jour plus ancien est dans les totaux ci-dessus mais n'est pas listé ici.", hi: "{n} पुराना दिन ऊपर के कुल में शामिल है, पर यहाँ सूचीबद्ध नहीं है।", ar: "يوم واحد أقدم محتسب في الإجماليات أعلاه لكنه غير مدرج هنا." },
  "ad.detail.table.older.two": { ar: "يومان أقدم محتسبان في الإجماليات أعلاه لكنهما غير مدرجين هنا." },
  "ad.detail.table.older.few": { ar: "{n} أيام أقدم محتسبة في الإجماليات أعلاه لكنها غير مدرجة هنا." },
  "ad.detail.table.older.many": { ar: "{n} يومًا أقدم محتسبة في الإجماليات أعلاه لكنها غير مدرجة هنا." },
  "ad.detail.table.older.other": { en: "{n} older days are in the totals above but not listed here.", es: "{n} días anteriores están en los totales de arriba, pero no aparecen aquí.", fr: "{n} jours plus anciens sont dans les totaux ci-dessus mais ne sont pas listés ici.", zh: "更早的 {n} 天已计入上方总数，但不在此列出。", hi: "{n} पुराने दिन ऊपर के कुल में शामिल हैं, पर यहाँ सूचीबद्ध नहीं हैं।", ar: "{n} يوم أقدم محتسب في الإجماليات أعلاه لكنه غير مدرج هنا." },
};
// Old texts that are replaced by the plural forms above.
const OLD = ["ad.detail.card.avg.days", "ad.detail.table.caption", "ad.detail.table.older", "ad.detail.card.best.shown"];

for (const lang of L) {
  const p = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(p)) throw new Error(p + " is missing");
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  const lineOf = (k) => new RegExp(`^  ${JSON.stringify(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:.*\\n`, "m");
  for (const k of [...OLD, ...Object.keys(T)]) s = s.replace(lineOf(k), "");
  const lines = Object.entries(T).filter(([, v]) => v[lang]).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v[lang])},`);
  s = s.split("  // Ad details, singular / plural (patch-ads-polish)\n").join(""); // the comment of an earlier run
  const at = s.lastIndexOf("\n" + (lang === "en" ? "} as const;" : "};"));
  if (at < 0) throw new Error(p + ": cannot find the end of the texts");
  s = s.slice(0, at) + "\n  // Ad details, singular / plural (patch-ads-polish)\n" + lines.join("\n") + s.slice(at);
  if (s !== before) { fs.writeFileSync(p, s, "utf8"); console.log("updated  " + p); } else console.log("already  " + p);
}
console.log("Done. In web/: npm run check:i18n  npm run lint  npm run build");
