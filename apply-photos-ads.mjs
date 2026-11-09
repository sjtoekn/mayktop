// apply-photos-ads.mjs — a square 300x300 ad tile between the photos on /photos (PHOTO_TODO 16).
// Run from the 7-mayktop folder:  node apply-photos-ads.mjs     (safe to run twice; makes .bak copies)
import fs from "node:fs";
import path from "node:path";

const COMPONENT = "\"use client\";\n\n// One ad tile inside the /photos grid (PHOTO_TODO 16). A square box (about 300 x 300, never wider than 300 px), clearly marked \"Ad\".\n// It uses the ads of the FEED slot (no new slot yet) and the same rules as every ad box: a pick the browser has not shown lately\n// (ad-memory), one impression counted when half of it is on screen, a click goes through /api/ad/click/<id>.\n//  - IMAGE: the picture fills the square (cropped to fit).\n//  - VIDEO: AdVideo = starts by itself, SILENT, inline (playsInline), no controls, at most 10 s, loops; paused when scrolled away.\n//  - TEXT: title + text on a plain card.\n// With no ad running the tile disappears (no empty box). While the ad is loading an empty square keeps the place (no page jump).\n// `group` = the page (cursor + tag): two tiles on one page never show the same ad when there is another one to show.\nimport { useEffect, useRef, useState } from \"react\";\nimport AdVideo from \"@/components/AdVideo\";\nimport { loadPool, sendImpression, type Ad } from \"@/components/AdBox\";\nimport { adsConfig } from \"@/config/site\";\nimport { pickAd } from \"@/lib/ad-memory\";\n\nconst claimed = { group: \"\", ids: new Set<number>() };\n\nexport default function PhotoAdTile({\n  group,\n  noRepeatMinutes,\n  labels,\n}: {\n  group: string;\n  noRepeatMinutes: number;\n  labels: { badge: string; label: string };\n}) {\n  const [shown, setShown] = useState<{ ad: Ad | null } | null>(null); // null = still loading\n  const boxRef = useRef<HTMLAnchorElement>(null);\n\n  useEffect(() => {\n    let cancelled = false;\n    void loadPool(\"FEED\", null).then((pool) => {\n      if (cancelled) return;\n      if (claimed.group !== group) {\n        claimed.group = group;\n        claimed.ids.clear();\n      }\n      const fresh = pool.filter((ad) => !claimed.ids.has(ad.id));\n      const ad = pickAd(fresh.length > 0 ? fresh : pool, Date.now(), noRepeatMinutes * 60_000);\n      if (ad) claimed.ids.add(ad.id);\n      setShown({ ad });\n    });\n    return () => {\n      cancelled = true;\n    };\n  }, [group, noRepeatMinutes]);\n\n  const adId = shown?.ad?.id ?? null;\n  useEffect(() => {\n    const box = boxRef.current;\n    if (adId === null || !box) return;\n    const observer = new IntersectionObserver(\n      (entries) => {\n        if (entries.some((entry) => entry.isIntersecting)) {\n          sendImpression(adId);\n          observer.disconnect();\n        }\n      },\n      { threshold: 0.5 },\n    );\n    observer.observe(box);\n    return () => observer.disconnect();\n  }, [adId]);\n\n  if (shown && !shown.ad) return null;\n  const ad = shown?.ad ?? null;\n\n  return (\n    <li className=\"ph-tile ph-adTile\">\n      {ad ? (\n        <a\n          ref={boxRef}\n          href={`/api/ad/click/${ad.id}`}\n          target=\"_blank\"\n          rel=\"sponsored nofollow noopener noreferrer\"\n          className=\"ph-adBox\"\n          aria-label={`${labels.label}: ${ad.title}`}\n        >\n          {ad.format === \"VIDEO\" && ad.videoUrl ? (\n            <AdVideo src={ad.videoUrl} title={ad.title} seconds={adsConfig.media.videoSeconds} />\n          ) : ad.imageUrl ? (\n            // eslint-disable-next-line @next/next/no-img-element -- our own protected file (/api/ad/media/...)\n            <img src={ad.imageUrl} alt=\"\" loading=\"lazy\" decoding=\"async\" />\n          ) : (\n            <span className=\"ph-adText\">\n              <strong>{ad.title}</strong>\n              <span>{ad.body}</span>\n              {ad.host ? <small>{ad.host}</small> : null}\n            </span>\n          )}\n          <span className=\"badge badge-ad ph-adBadge\">{labels.badge}</span>\n        </a>\n      ) : (\n        <div className=\"ph-adBox ph-adLoading\" aria-hidden=\"true\" />\n      )}\n    </li>\n  );\n}\n";
const CSS = "\n/* ---- /photos ad tile (PHOTO_TODO 16): a square 300 x 300 ad between the photos ---- */\n.ph-adTile {\n  display: block;\n}\n.ph-adTile .ph-adBox {\n  position: relative;\n  display: block;\n  width: 100%;\n  max-width: 300px;\n  margin-inline: auto;\n  aspect-ratio: 1 / 1;\n  overflow: hidden;\n  border-radius: 16px;\n  background: var(--surface2, #eef2f9);\n  box-shadow: 0 0 0 1px var(--adline, rgba(127, 127, 127, 0.3));\n  color: inherit;\n  text-decoration: none;\n}\n.ph-adTile a.ph-adBox:hover,\n.ph-adTile a.ph-adBox:focus-visible {\n  transform: none;\n}\n.ph-adTile .ph-adBox img,\n.ph-adTile .ph-adBox video {\n  display: block;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n}\n.ph-adTile .ph-adBox video {\n  cursor: pointer;\n}\n.ph-adBadge {\n  position: absolute;\n  top: 8px;\n  inset-inline-start: 8px;\n  z-index: 2;\n}\n.ph-adText {\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  gap: 8px;\n  height: 100%;\n  padding: 20px;\n}\n.ph-adText strong {\n  font-size: 1.05rem;\n  line-height: 1.25;\n  overflow-wrap: anywhere;\n}\n.ph-adText small {\n  color: var(--muted);\n}\n.ph-adLoading {\n  box-shadow: none;\n}\n";

const photosDir = path.join("web", "src", "app", "(site)", "photos");
const pageFile = path.join(photosDir, "page.tsx");
const cssFile = path.join(photosDir, "photos.css");
const posFile = path.join("web", "src", "lib", "ad-positions.ts");
const compFile = path.join("web", "src", "components", "photos", "PhotoAdTile.tsx");

for (const f of [pageFile, cssFile, posFile]) {
  if (!fs.existsSync(f)) { console.error(f + ": not found. Run this from the 7-mayktop folder."); process.exit(1); }
}

function backup(f) { if (!fs.existsSync(f + ".bak")) fs.copyFileSync(f, f + ".bak"); }

// 1) the new component
if (fs.existsSync(compFile) && fs.readFileSync(compFile, "utf8") === COMPONENT) console.log("PhotoAdTile.tsx: already done");
else { fs.writeFileSync(compFile, COMPONENT); console.log("PhotoAdTile.tsx: written"); }

// 2) css
let css = fs.readFileSync(cssFile, "utf8");
if (css.includes("/photos ad tile (PHOTO_TODO 16)")) console.log("photos.css: already done");
else { backup(cssFile); fs.writeFileSync(cssFile, css.replace(/\s*$/, "\n") + CSS); console.log("photos.css: updated"); }

// 3) positions: after the 6th and the 16th photo (at most 2 per page, never first, 3+ apart)
let pos = fs.readFileSync(posFile, "utf8");
if (pos.includes("PHOTO_AD_AFTER")) console.log("ad-positions.ts: already done");
else {
  backup(posFile);
  pos = pos.replace(/\s*$/, "\n") +
    "\n// The Photos grid (PHOTO_TODO 16): an ad tile AFTER the photo at these 0-based indexes (never first, at most 2 per page).\n" +
    "export const PHOTO_AD_AFTER = [5, 15] as const;\n\n" +
    "export function isPhotoAdPosition(index: number): boolean {\n  return (PHOTO_AD_AFTER as readonly number[]).includes(index);\n}\n";
  fs.writeFileSync(posFile, pos);
  console.log("ad-positions.ts: updated");
}

// 4) the page
let page = fs.readFileSync(pageFile, "utf8");
if (page.includes("PhotoAdTile")) console.log("page.tsx: already done");
else {
  const edits = [
    ['import { Suspense } from "react";', 'import { Fragment, Suspense } from "react";'],
    ['import { t } from "@/i18n";', 'import PhotoAdTile from "@/components/photos/PhotoAdTile";\nimport { adsConfig } from "@/config/site";\nimport { t } from "@/i18n";\nimport { isPhotoAdPosition } from "@/lib/ad-positions";'],
    ['  const fallbackAlt = t("photo.list.photoAlt");\n', '  const fallbackAlt = t("photo.list.photoAlt");\n  const adGroup = `${tag ?? ""}:${cursor ?? 0}`;\n  const adLabels = { badge: t("ad.badge"), label: t("ad.label") };\n'],
    ['{page.items.map((photo) => (\n              <li key={photo.id} className="ph-tile">', '{page.items.map((photo, index) => (\n              <Fragment key={photo.id}>\n              <li className="ph-tile">'],
    ['              </li>\n            ))}', '              </li>\n              {isPhotoAdPosition(index) && index < page.items.length - 1 ? (\n                <PhotoAdTile group={adGroup} noRepeatMinutes={adsConfig.rotation.noRepeatMinutes} labels={adLabels} />\n              ) : null}\n              </Fragment>\n            ))}'],
  ];
  for (const [oldText, newText] of edits) {
    if (!page.includes(oldText)) { console.error("page.tsx: expected text not found:\n" + oldText + "\nNothing changed in page.tsx."); process.exit(1); }
    page = page.replace(oldText, newText);
  }
  backup(pageFile);
  fs.writeFileSync(pageFile, page);
  console.log("page.tsx: updated");
}
console.log("Done. Reload http://localhost:3000/photos, then: cd web && npm run lint && npm run build");
