// apply-photos-ads-more.mjs — the /photos ad tiles use the ads of SEVERAL slots, not only FEED.
// Run from the 7-mayktop folder:  node apply-photos-ads-more.mjs   (safe to run twice; makes a .bak copy)
import fs from "node:fs";

const file = "web/src/components/photos/PhotoAdTile.tsx";
if (!fs.existsSync(file)) { console.error(file + ": not found. Run from the 7-mayktop folder, after apply-photos-ads.mjs."); process.exit(1); }
let s = fs.readFileSync(file, "utf8");
if (s.includes("PHOTO_AD_SLOTS")) { console.log("PhotoAdTile.tsx: already done"); process.exit(0); }

const edits = [
  [
    'const claimed = { group: "", ids: new Set<number>() };\n',
    '// The ad slots whose ads may appear in the photo grid. A running ad of any of these slots can be shown here.\n' +
      '// HEADER (wide banner pictures) is left out on purpose: it does not fit a square. Add "HEADER" to the list to include it.\n' +
      'const PHOTO_AD_SLOTS = ["FEED", "SIDEBAR", "SOCIAL_FEED"] as const;\n\n' +
      'async function loadPhotoAdPool(): Promise<Ad[]> {\n' +
      '  const pools = await Promise.all(PHOTO_AD_SLOTS.map((slot) => loadPool(slot, null)));\n' +
      '  const byId = new Map<number, Ad>();\n' +
      '  for (const pool of pools) for (const ad of pool) if (!byId.has(ad.id)) byId.set(ad.id, ad);\n' +
      '  return [...byId.values()];\n' +
      '}\n\n' +
      'const claimed = { group: "", ids: new Set<number>() };\n',
  ],
  ['void loadPool("FEED", null).then((pool) => {', 'void loadPhotoAdPool().then((pool) => {'],
  ['// It uses the ads of the FEED slot (no new slot yet) and', '// It uses the ads of the slots in PHOTO_AD_SLOTS (FEED, SIDEBAR, SOCIAL_FEED; no PHOTOS slot yet) and'],
];
for (const [a, b] of edits) {
  if (!s.includes(a)) { console.error("PhotoAdTile.tsx: expected text not found:\n" + a + "\nNothing changed."); process.exit(1); }
  s = s.replace(a, b);
}
fs.copyFileSync(file, file + ".bak");
fs.writeFileSync(file, s);
console.log("PhotoAdTile.tsx: updated. Reload http://localhost:3000/photos (then: cd web && npm run lint)");
