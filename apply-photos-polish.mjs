// apply-photos-polish.mjs — /photos visual polish. Run from the 7-mayktop folder:  node apply-photos-polish.mjs
// Safe to run twice (it checks first). Makes a .bak copy of both files.
import fs from "node:fs";
import path from "node:path";

const dir = path.join("web", "src", "app", "(site)", "photos");
const pageFile = path.join(dir, "page.tsx");
const cssFile = path.join(dir, "photos.css");

const OLD = "<img src={photoThumbUrl(photo.file)} alt={photo.title || fallbackAlt} width={photo.width} height={photo.height} loading=\"lazy\" decoding=\"async\" />\n                </Link>";
const NEW = "<img src={photoThumbUrl(photo.file)} alt={photo.title || fallbackAlt} width={photo.width} height={photo.height} loading=\"lazy\" decoding=\"async\" />\n                  {photo.title ? (\n                    <span className=\"ph-tileTitle\" aria-hidden=\"true\">\n                      {photo.title}\n                    </span>\n                  ) : null}\n                </Link>";
const CSS = "/* ---- /photos polish (2026-11-09): softer header, lifted tiles, title on hover, nicer \"load more\" ---- */\n.ph-head {\n  padding: 22px 24px;\n  background: linear-gradient(135deg, var(--brandsoft, #eef3ff) 0%, var(--surface, #fff) 70%);\n}\n.ph-head .sf-h1 {\n  margin: 0 0 4px;\n  font-size: 1.9rem;\n  letter-spacing: -0.02em;\n}\n.ph-head .pc-text {\n  margin: 0;\n  color: var(--muted);\n}\n.ph-headActions .btn {\n  border-radius: 999px;\n  padding-inline: 18px;\n  min-height: 42px;\n  transition: transform 150ms ease, box-shadow 150ms ease;\n}\n.ph-headActions .btn:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 6px 16px rgba(31, 94, 255, 0.18);\n}\n.ph-grid {\n  column-gap: 14px;\n}\n.ph-tile {\n  margin-bottom: 14px;\n}\n.ph-tile a {\n  border-radius: 16px;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 14px rgba(0, 0, 0, 0.06);\n  transition: transform 200ms ease, box-shadow 200ms ease;\n}\n.ph-tile a:hover,\n.ph-tile a:focus-visible {\n  transform: translateY(-3px);\n  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);\n}\n.ph-tile a:hover img {\n  transform: scale(1.04);\n  filter: none;\n}\n.ph-tileTitle {\n  position: absolute;\n  inset-inline: 0;\n  bottom: 0;\n  padding: 36px 14px 12px;\n  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0));\n  color: #ffffff;\n  font-size: 0.92rem;\n  font-weight: 600;\n  line-height: 1.25;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  opacity: 0;\n  transform: translateY(6px);\n  transition: opacity 200ms ease, transform 200ms ease;\n  pointer-events: none;\n}\n.ph-tile a:hover .ph-tileTitle,\n.ph-tile a:focus-visible .ph-tileTitle {\n  opacity: 1;\n  transform: none;\n}\n/* phones and tablets have no hover: show the title always, but small */\n@media (hover: none) {\n  .ph-tileTitle {\n    opacity: 1;\n    transform: none;\n    padding-top: 24px;\n    font-size: 0.8rem;\n  }\n}\n.ph-more {\n  margin-top: 24px;\n  margin-bottom: 8px;\n}\n.ph-more .btn {\n  border-radius: 999px;\n  min-width: 180px;\n  min-height: 44px;\n}\n@media (max-width: 900px) {\n  .ph-grid { column-gap: 10px; }\n  .ph-tile { margin-bottom: 10px; }\n}\n@media (max-width: 520px) {\n  .ph-head { padding: 16px; }\n  .ph-head .sf-h1 { font-size: 1.5rem; }\n  .ph-grid { column-gap: 8px; }\n  .ph-tile { margin-bottom: 8px; }\n  .ph-tile a { border-radius: 12px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .ph-tile a,\n  .ph-tile img,\n  .ph-tileTitle,\n  .ph-headActions .btn {\n    transition: none;\n  }\n  .ph-tile a:hover,\n  .ph-tile a:focus-visible {\n    transform: none;\n  }\n}\n";

if (!fs.existsSync(pageFile) || !fs.existsSync(cssFile)) {
  console.error("Run this from the 7-mayktop folder (the one that contains web/).");
  process.exit(1);
}

let page = fs.readFileSync(pageFile, "utf8");
let css = fs.readFileSync(cssFile, "utf8");

if (page.includes("ph-tileTitle")) {
  console.log("page.tsx: already done");
} else if (!page.includes(OLD)) {
  console.error("page.tsx: the expected <img ...></Link> block was not found. Nothing changed.");
  process.exit(1);
} else {
  fs.copyFileSync(pageFile, pageFile + ".bak");
  fs.writeFileSync(pageFile, page.replace(OLD, NEW));
  console.log("page.tsx: updated");
}

if (css.includes("/photos polish (2026-11-09)")) {
  console.log("photos.css: already done");
} else {
  fs.copyFileSync(cssFile, cssFile + ".bak");
  fs.writeFileSync(cssFile, css.replace(/\s*$/, "\n\n") + CSS);
  console.log("photos.css: updated");
}
console.log("Done. Reload http://localhost:3000/photos");
