// PHOTO_TODO 6: adds the photo page texts (photo.detail.*) to the 6 language files. Safe to run twice.
// Run from the project folder (where PHOTO_TODO.md is): node apply-photo-detail.mjs
import fs from "node:fs";

const TEXTS = {
  en: { pageTitle: "Photo", back: "Back to photos", by: "by", edited: "edited", tags: "Tags", open: "Open the full-size photo in a new tab", hidden: "This photo is not shown to other people. Only you and the site team can see it." },
  es: { pageTitle: "Foto", back: "Volver a las fotos", by: "por", edited: "editada", tags: "Etiquetas", open: "Abrir la foto en tamaño completo en una pestaña nueva", hidden: "Esta foto no se muestra a otras personas. Solo tú y el equipo del sitio pueden verla." },
  fr: { pageTitle: "Photo", back: "Retour aux photos", by: "par", edited: "modifiée", tags: "Étiquettes", open: "Ouvrir la photo en taille réelle dans un nouvel onglet", hidden: "Cette photo n'est pas visible par les autres personnes. Vous seul et l'équipe du site pouvez la voir." },
  hi: { pageTitle: "फ़ोटो", back: "फ़ोटो पर वापस जाएँ", by: "द्वारा", edited: "संपादित", tags: "टैग", open: "पूरे आकार की फ़ोटो नए टैब में खोलें", hidden: "यह फ़ोटो दूसरे लोगों को नहीं दिखती। इसे केवल आप और साइट की टीम देख सकती है।" },
  zh: { pageTitle: "照片", back: "返回照片", by: "作者", edited: "已编辑", tags: "标签", open: "在新标签页中打开原尺寸照片", hidden: "这张照片不会向其他人显示。只有你和网站团队可以看到。" },
  ar: { pageTitle: "صورة", back: "العودة إلى الصور", by: "بواسطة", edited: "معدّلة", tags: "الوسوم", open: "فتح الصورة بالحجم الكامل في علامة تبويب جديدة", hidden: "هذه الصورة غير ظاهرة للآخرين. أنت وفريق الموقع فقط يمكنكم رؤيتها." },
};

const ANCHOR = /^  "photo\.list\.photoAlt":.*\n/m;
let problems = 0;
for (const [lang, x] of Object.entries(TEXTS)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`MISSING  ${file}`); problems++; continue; }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"photo.detail.pageTitle"')) { console.log(`skip     ${file} (already has the texts)`); continue; }
  const match = src.match(ANCHOR);
  if (!match) { console.log(`NO ANCHOR  ${file}: line "photo.list.photoAlt" not found, nothing changed`); problems++; continue; }
  const lines = [`  // The photo page /photos/<id> (PHOTO_TODO 6)`, ...Object.entries(x).map(([key, value]) => `  "photo.detail.${key}": ${JSON.stringify(value)},`)].join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  console.log(`updated  ${file}`);
}
process.exit(problems ? 1 : 0);
