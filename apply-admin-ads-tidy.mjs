// apply-admin-ads-tidy.mjs — a tidy admin ad card: fixed 300x300 preview box + the facts as neat rows (list page and detail page).
// Run from the 7-mayktop folder:  node apply-admin-ads-tidy.mjs    (safe to run twice; makes .bak copies)
import fs from "node:fs";
import path from "node:path";

const CSS = "\n/* ---- tidy admin ad card (2026-11-09): a fixed 300 x 300 preview box on the left, the facts as neat rows on the right ---- */\n.ads-layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 20px 28px; align-items: start; }\n.ads-layout > * { min-width: 0; }\n@media (max-width: 48rem) { .ads-layout { grid-template-columns: minmax(0, 1fr); } }\n\n.ads-preview { width: 100%; max-width: 300px; height: 300px; overflow: hidden; gap: 0.4rem; box-sizing: border-box; }\n.ads-preview .badge-ad { align-self: flex-start; flex: none; }\n.ads-preview .ad-media { flex: none; }\n.ads-preview .ads-previewTitle,\n.ads-preview .pc-text { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }\n.ads-preview .ads-previewTitle { -webkit-line-clamp: 2; line-clamp: 2; }\n.ads-preview .pc-text { -webkit-line-clamp: 4; line-clamp: 4; }\n.ads-preview .pc-meta { margin-top: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n.ads-facts { gap: 0; align-self: stretch; }\n.ads-facts > p { padding: 0.5rem 0; border-bottom: 1px solid var(--line); line-height: 1.35; }\n.ads-facts > p:first-child { padding-top: 0; }\n.ads-facts > p:last-child { border-bottom: 0; }\n.ads-facts .ads-url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }\n";
const dir = path.join("web", "src", "app", "admin", "ads");
const listFile = path.join(dir, "page.tsx");
const detailFile = path.join(dir, "[id]", "page.tsx");
const cssFile = path.join(dir, "ads.css");
for (const f of [listFile, detailFile, cssFile]) {
  if (!fs.existsSync(f)) { console.error(f + ": not found. Run this from the 7-mayktop folder."); process.exit(1); }
}
const backup = (f) => { if (!fs.existsSync(f + ".bak")) fs.copyFileSync(f, f + ".bak"); };
const URL_OLD = '<p className="pc-meta ads-url">{t("admin.ads.link", { url: ad.destinationUrl })}</p>';
const URL_NEW = '<p className="pc-meta ads-url" title={ad.destinationUrl}>{t("admin.ads.link", { url: ad.destinationUrl })}</p>';

const plan = [];
function edit(file, marker, pairs) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) { console.log(file + ": already done"); return; }
  for (const [a, b] of pairs) {
    if (!s.includes(a)) { console.error(file + ": expected text not found:\n" + a + "\nNothing was changed."); process.exit(1); }
    s = s.replace(a, b);
  }
  plan.push([file, s]);
}

edit(listFile, "ads-layout", [
  [
    '              <div className="ad-block">\n                <p className="ad-label">{t("admin.ads.preview")}</p>',
    '              <div className="ads-layout">\n              <div className="ad-block">\n                <p className="ad-label">{t("admin.ads.preview")}</p>',
  ],
  [
    '              <div className="ad-actionRow">\n                <Link href={`/admin/ads/${ad.id}`} className="btn btn-primary btn-sm">',
    '              </div>\n\n              <div className="ad-actionRow">\n                <Link href={`/admin/ads/${ad.id}`} className="btn btn-primary btn-sm">',
  ],
  [URL_OLD, URL_NEW],
]);
edit(detailFile, 'title={ad.destinationUrl}>{t("admin.ads.link"', [[URL_OLD, URL_NEW]]);
edit(cssFile, "tidy admin ad card (2026-11-09)", [["", ""]]);

for (const [file, text] of plan) {
  backup(file);
  fs.writeFileSync(file, file === cssFile ? text.replace(/\s*$/, "\n") + CSS : text);
  console.log(file + ": updated");
}
console.log("Done. Reload http://localhost:3000/admin/ads");
