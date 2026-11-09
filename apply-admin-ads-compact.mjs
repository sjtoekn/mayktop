// apply-admin-ads-compact.mjs — 2nd pass of the admin ad card: much lower. Run AFTER apply-admin-ads-tidy.mjs and apply-admin-ad-manage.mjs.
// From the 7-mayktop folder:  node apply-admin-ads-compact.mjs    (safe to run twice; makes .bak copies)
import fs from "node:fs";
import path from "node:path";

const CSS = "\n/* ---- compact admin ad card (2026-11-09, 2nd pass): small preview on the left; facts in ONE flowing line and ALL buttons in ONE row on the right ---- */\n.ads-section .ad-item { gap: 0.5rem; padding: 1rem 1.25rem; }\n.ads-layout { grid-template-columns: 240px minmax(0, 1fr); gap: 8px 24px; }\n@media (max-width: 48rem) { .ads-layout { grid-template-columns: minmax(0, 1fr); } }\n\n.ads-preview { position: relative; max-width: 240px; height: 200px; padding: 0.5rem 0.75rem; gap: 0.25rem; }\n.ads-preview .badge-ad { position: absolute; top: 0.9rem; inset-inline-start: 1.1rem; z-index: 2; }\n.ads-preview:not(:has(.ad-media)) { padding-top: 2.1rem; }\n.ads-preview .ad-media { aspect-ratio: 2 / 1; }\n.ads-preview .ads-previewTitle { font-size: 0.95rem; -webkit-line-clamp: 1; line-clamp: 1; }\n.ads-preview .pc-text { font-size: 0.85rem; line-height: 1.3; -webkit-line-clamp: 2; line-clamp: 2; }\n.ads-preview .pc-meta { display: none; }\n\n.ads-side { display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem; align-self: stretch; min-width: 0; }\n.ads-facts { flex-direction: row; flex-wrap: wrap; gap: 0.25rem 0; align-self: auto; }\n.ads-facts > p { padding: 0 1rem; border-bottom: 0; border-inline-start: 1px solid var(--line); font-size: 0.9rem; }\n.ads-facts > p:first-child { padding-inline-start: 0; border-inline-start: 0; }\n.ads-facts .ads-url { max-width: 24rem; }\n\n.ads-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }\n.ads-actions > * { margin: 0; }\n.ads-actions > .notice { flex: 1 1 100%; }\n.ads-actions > .ad-form { flex: 0 1 auto; gap: 0; }\n.ads-actions > .ad-form:has(form, .ad-sure, .notice) { flex: 1 1 100%; }\n";
const dir = path.join("web", "src", "app", "admin", "ads");
const listFile = path.join(dir, "page.tsx");
const cssFile = path.join(dir, "ads.css");
for (const f of [listFile, cssFile]) {
  if (!fs.existsSync(f)) { console.error(f + ": not found. Run this from the 7-mayktop folder."); process.exit(1); }
}
const backup = (f) => { if (!fs.existsSync(f + ".bak2")) fs.copyFileSync(f, f + ".bak2"); };

let page = fs.readFileSync(listFile, "utf8");
let css = fs.readFileSync(cssFile, "utf8");
const pageDone = page.includes("ads-actions");
const cssDone = css.includes("compact admin ad card (2026-11-09, 2nd pass)");

if (!pageDone) {
  const edits = [
    [
      '              <div className="ad-block ads-facts">',
      '              <div className="ads-side">\n              <div className="ad-block ads-facts">',
    ],
    [
      '              </div>\n\n              <div className="ad-actionRow">\n                <Link href={`/admin/ads/${ad.id}`} className="btn btn-primary btn-sm">',
      '              <div className="ads-actions">\n              <div className="ad-actionRow">\n                <Link href={`/admin/ads/${ad.id}`} className="btn btn-primary btn-sm">',
    ],
    [
      '/>\n            </article>\n          ),\n        )}',
      '/>\n              </div>\n              </div>\n              </div>\n            </article>\n          ),\n        )}',
    ],
  ];
  for (const [a, b] of edits) {
    if (!page.includes(a)) {
      console.error("page.tsx: expected text not found:\n" + a + "\nNothing was changed. (Did you run apply-admin-ads-tidy.mjs and apply-admin-ad-manage.mjs first?)");
      process.exit(1);
    }
    page = page.replace(a, b);
  }
  backup(listFile);
  fs.writeFileSync(listFile, page);
  console.log(listFile + ": updated");
} else console.log(listFile + ": already done");

if (!cssDone) {
  backup(cssFile);
  fs.writeFileSync(cssFile, css.replace(/\s*$/, "\n") + CSS);
  console.log(cssFile + ": updated");
} else console.log(cssFile + ": already done");
console.log("Done. Reload http://localhost:3000/admin/ads");
