// PHOTO_TODO 5: adds the /photos texts to the 6 language files and tidies PHOTO_TODO.md. Safe to run twice.
// Run from the project folder (where PHOTO_TODO.md is): node apply-photo-grid.mjs
import fs from "node:fs";

const TEXTS = {
  en: { title: "Photos", sub: "Photos shared by people on MaykTop, newest first.", empty: "No photos yet. Be the first to share one.", upload: "Upload a photo", more: "Load more", newest: "Back to the newest photos", photoAlt: "Photo" },
  es: { title: "Fotos", sub: "Fotos compartidas por personas en MaykTop, las más recientes primero.", empty: "Todavía no hay fotos. Sé la primera persona en compartir una.", upload: "Subir una foto", more: "Cargar más", newest: "Volver a las fotos más recientes", photoAlt: "Foto" },
  fr: { title: "Photos", sub: "Les photos partagées sur MaykTop, les plus récentes d'abord.", empty: "Aucune photo pour le moment. Soyez la première personne à en partager une.", upload: "Envoyer une photo", more: "Charger plus", newest: "Retour aux photos les plus récentes", photoAlt: "Photo" },
  hi: { title: "फ़ोटो", sub: "MaykTop पर लोगों की साझा की गई फ़ोटो, सबसे नई पहले।", empty: "अभी कोई फ़ोटो नहीं है। पहली फ़ोटो आप साझा करें।", upload: "फ़ोटो अपलोड करें", more: "और दिखाएँ", newest: "सबसे नई फ़ोटो पर वापस जाएँ", photoAlt: "फ़ोटो" },
  zh: { title: "照片", sub: "大家在 MaykTop 上分享的照片，最新的在前。", empty: "还没有照片。来分享第一张吧。", upload: "上传照片", more: "加载更多", newest: "回到最新照片", photoAlt: "照片" },
  ar: { title: "الصور", sub: "الصور التي يشاركها الناس على MaykTop، الأحدث أولاً.", empty: "لا توجد صور بعد. كن أول من يشارك صورة.", upload: "رفع صورة", more: "عرض المزيد", newest: "العودة إلى أحدث الصور", photoAlt: "صورة" },
};

const ANCHOR = /^  "photo\.category\.other":.*\n/m;
let problems = 0;
for (const [lang, x] of Object.entries(TEXTS)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`MISSING  ${file}`); problems++; continue; }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"photo.list.title"')) { console.log(`skip     ${file} (already has the texts)`); continue; }
  const match = src.match(ANCHOR);
  if (!match) { console.log(`NO ANCHOR  ${file}: line "photo.category.other" not found, nothing changed`); problems++; continue; }
  const q = (s) => JSON.stringify(s);
  const lines =
    [`  // The /photos grid (PHOTO_TODO 5)`, ...Object.entries(x).map(([key, value]) => `  "photo.list.${key}": ${q(value)},`)].join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  console.log(`updated  ${file}`);
}

// PHOTO_TODO.md: step 4 is finished; the media-route rate limit moves to step 18 (a database write for every picture of
// a grid would be heavy: it needs its own, lighter design); the ad tile is step 16.
const todo = "PHOTO_TODO.md";
if (fs.existsSync(todo)) {
  let text = fs.readFileSync(todo, "utf8");
  const before = text;
  text = text.replace(/^\[ \] 4\./m, "[x] 4.");
  text = text.replace(/, media route එකට rate limit එක, ad slot එකට ඉඩ/, "");
  if (!text.includes("per-IP rate limit")) {
    text = text.replace(/^(\[ \] 18\..*)$/m, "$1; `/api/photos/media` වලට per-IP rate limit (memory counter; හැම පින්තූරයකටම database එකට ලියන්න එපා)");
  }
  if (text !== before) { fs.writeFileSync(todo, text); console.log("updated  PHOTO_TODO.md"); } else console.log("skip     PHOTO_TODO.md");
}
process.exit(problems ? 1 : 0);
