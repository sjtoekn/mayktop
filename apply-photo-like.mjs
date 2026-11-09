// PHOTO_TODO 7: adds the photo Like texts (photo.like.*) to the 6 language files. Safe to run twice.
// Run from the project folder (where PHOTO_TODO.md is): node apply-photo-like.mjs
import fs from "node:fs";

const TEXTS = {
  en: { like: "Like this photo", unlike: "Remove your like from this photo", likeTitle: "Like", unlikeTitle: "Unlike", login: "Please log in to like this photo.", tooMany: "Too many likes in a short time. Please wait a moment.", error: "Could not update the like. Please try again." },
  es: { like: "Me gusta esta foto", unlike: "Quitar tu me gusta de esta foto", likeTitle: "Me gusta", unlikeTitle: "Quitar me gusta", login: "Inicia sesión para dar me gusta a esta foto.", tooMany: "Demasiados me gusta en poco tiempo. Espera un momento.", error: "No se pudo actualizar el me gusta. Inténtalo de nuevo." },
  fr: { like: "Aimer cette photo", unlike: "Retirer votre mention J'aime de cette photo", likeTitle: "J'aime", unlikeTitle: "Je n'aime plus", login: "Connectez-vous pour aimer cette photo.", tooMany: "Trop de mentions J'aime en peu de temps. Patientez un instant.", error: "Impossible de mettre à jour la mention J'aime. Veuillez réessayer." },
  hi: { like: "इस फ़ोटो को पसंद करें", unlike: "इस फ़ोटो से अपनी पसंद हटाएँ", likeTitle: "पसंद", unlikeTitle: "पसंद हटाएँ", login: "इस फ़ोटो को पसंद करने के लिए कृपया लॉग इन करें।", tooMany: "थोड़े समय में बहुत ज़्यादा पसंद। कृपया थोड़ा रुकें।", error: "पसंद अपडेट नहीं हो सकी। कृपया फिर कोशिश करें।" },
  zh: { like: "喜欢这张照片", unlike: "取消对这张照片的喜欢", likeTitle: "喜欢", unlikeTitle: "取消喜欢", login: "请登录后再喜欢这张照片。", tooMany: "短时间内点赞太多，请稍等片刻。", error: "无法更新喜欢状态，请重试。" },
  ar: { like: "أعجبتني هذه الصورة", unlike: "إزالة إعجابك بهذه الصورة", likeTitle: "إعجاب", unlikeTitle: "إزالة الإعجاب", login: "يرجى تسجيل الدخول للإعجاب بهذه الصورة.", tooMany: "عدد كبير من الإعجابات في وقت قصير. يرجى الانتظار قليلاً.", error: "تعذّر تحديث الإعجاب. يرجى المحاولة مرة أخرى." },
};

const ANCHOR = /^  "photo\.detail\.hidden":.*\n/m;
let problems = 0;
for (const [lang, x] of Object.entries(TEXTS)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  if (!fs.existsSync(file)) { console.log(`MISSING  ${file}`); problems++; continue; }
  const src = fs.readFileSync(file, "utf8");
  if (src.includes('"photo.like.like"')) { console.log(`skip     ${file} (already has the texts)`); continue; }
  const match = src.match(ANCHOR);
  if (!match) { console.log(`NO ANCHOR  ${file}: line "photo.detail.hidden" not found, nothing changed`); problems++; continue; }
  const lines = [`  // The Like button of a photo (PHOTO_TODO 7)`, ...Object.entries(x).map(([key, value]) => `  "photo.like.${key}": ${JSON.stringify(value)},`)].join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  console.log(`updated  ${file}`);
}
process.exit(problems ? 1 : 0);
