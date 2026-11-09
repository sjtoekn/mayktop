// patch-photo-save: connects "Save" to the photo page. Safe to run twice; each file is checked first and, if an anchor is
// missing, that file is left untouched and reported. Run from the project folder (where PHOTO_TODO.md is):  node apply-photo-save.mjs
import fs from "node:fs";

let problems = 0;
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
const done = (f, msg) => console.log(`${msg.padEnd(9)} ${f}`);
const fail = (f, why) => { console.log(`PROBLEM   ${f}: ${why} (file not changed)`); problems++; };

/** edits: [{ find: string|RegExp, replace: (match)=>string }] ; marker: text that proves the patch is already there */
function edit(file, marker, edits) {
  const src = read(file);
  if (src === null) return fail(file, "file not found");
  if (src.includes(marker)) return done(file, "skip");
  let out = src;
  for (const { find, replace } of edits) {
    const m = typeof find === "string" ? (out.includes(find) ? [find] : null) : out.match(find);
    if (!m) return fail(file, `anchor not found: ${String(find).slice(0, 70)}`);
    const at = typeof find === "string" ? out.indexOf(find) : m.index;
    out = out.slice(0, at) + replace(m[0]) + out.slice(at + m[0].length);
  }
  fs.writeFileSync(file, out);
  done(file, "updated");
}

// 1. database schema
edit("web/prisma/schema.prisma", "model PhotoBookmark", [
  { find: /^model User \{\n/m, replace: (m) => m + "  photoBookmarks PhotoBookmark[]\n" },
  { find: /^model Photo \{\n/m, replace: (m) => m + "  bookmarks PhotoBookmark[]\n" },
  {
    find: /\s*$/,
    replace: () => `

model PhotoBookmark {
  userId    String
  photoId   Int
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Restrict)
  photo Photo @relation(fields: [photoId], references: [id], onDelete: Restrict)

  @@id([userId, photoId])
  @@index([userId, createdAt])
  @@index([photoId])
}
`,
  },
]);

// 2. the photo page: Save button next to Like and Share
edit("web/src/app/(site)/photos/[id]/page.tsx", "PhotoBookmarkButton", [
  { find: 'import PhotoShareButton from "@/components/photos/PhotoShareButton";\n', replace: (m) => 'import PhotoBookmarkButton from "@/components/photos/PhotoBookmarkButton";\n' + m },
  { find: 'import { prisma } from "@/lib/prisma";\n', replace: (m) => 'import { hasSavedPhoto } from "@/lib/photo-bookmark-view";\n' + m },
  { find: /  const liked = [^\n]*\n/, replace: (m) => m + "  const saved = viewer && shown ? await hasSavedPhoto(viewer.id, photo.id) : false;\n" },
  {
    find: /( *)<PhotoShareButton [^\n]*\/>\n/,
    replace: (m) => {
      const pad = m.match(/^ */)[0];
      return (
        m +
        `${pad}<PhotoBookmarkButton
${pad}  photoId={photo.id}
${pad}  initialBookmarked={saved}
${pad}  text={{
${pad}    save: t("photo.bookmark.save"),
${pad}    saved: t("photo.bookmark.saved"),
${pad}    saveTitle: t("photo.bookmark.save.title"),
${pad}    savedTitle: t("photo.bookmark.saved.title"),
${pad}    login: t("photo.bookmark.login"),
${pad}    tooMany: t("photo.bookmark.toomany"),
${pad}    full: t("photo.bookmark.full"),
${pad}    error: t("photo.bookmark.error"),
${pad}  }}
${pad}/>
`
      );
    },
  },
]);

// 3. /photos header: a link to the saved photos
edit("web/src/app/(site)/photos/page.tsx", "photo.saved.link", [
  {
    find: /( *)<Link href="\/photos\/upload" className="btn btn-primary">\n\s*\{t\("photo\.list\.upload"\)\}\n\s*<\/Link>\n/,
    replace: (m) => {
      const pad = m.match(/^ */)[0];
      return `${pad}<div className="ph-headActions">
${pad}  <Link href="/photos/saved" className="btn btn-secondary">
${pad}    {t("photo.saved.link")}
${pad}  </Link>
${pad}  <Link href="/photos/upload" className="btn btn-primary">
${pad}    {t("photo.list.upload")}
${pad}  </Link>
${pad}</div>
`;
    },
  },
]);

// 4. css
edit("web/src/app/(site)/photos/photos.css", ".ph-headActions", [
  { find: /\s*$/, replace: () => "\n\n/* Header buttons of /photos: Saved photos + Upload */\n.ph-headActions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n}\n" },
]);

// 5. account erasure: delete saved-photo rows before the photos / user go (foreign keys are RESTRICT)
edit("web/src/lib/purge-social.ts", "erasePhotoBookmarks", [
  { find: 'import { eraseSocialBookmarks } from "./social-bookmark";\n', replace: (m) => m + 'import { erasePhotoBookmarks } from "./photo-bookmark";\n' },
  { find: /  await eraseSocialBookmarks\(db, userId\);[^\n]*\n/, replace: (m) => m + "  await erasePhotoBookmarks(db, userId); // saved photos made, and saves of the person's photos (patch-photo-save)\n" },
]);

// 6. npm script
edit("web/package.json", "test:photo-bookmark", [
  { find: /( *)"test:social-bookmark": [^\n]*\n/, replace: (m) => m + `${m.match(/^ */)[0]}"test:photo-bookmark": "tsx scripts/test-photo-bookmark.ts",\n` },
]);

// 7. texts in the 6 languages
const T = {
  en: {
    "photo.bookmark.save": "Save", "photo.bookmark.saved": "Saved",
    "photo.bookmark.save.title": "Save this photo in your private list", "photo.bookmark.saved.title": "Saved in your list. Select to remove it.",
    "photo.bookmark.login": "Please log in first.", "photo.bookmark.toomany": "Too many saves in a short time. Please wait a moment.",
    "photo.bookmark.full": "Your saved list is full. Remove some photos first.", "photo.bookmark.error": "Could not save this. Please try again.",
    "photo.saved.title": "Saved photos", "photo.saved.sub": "Photos you saved, the most recently saved first. Only you can see this list.",
    "photo.saved.empty": "You have not saved any photos yet. Choose Save on a photo and it will be here.", "photo.saved.browse": "Browse photos",
    "photo.saved.all": "All photos", "photo.saved.newest": "Back to the latest saved", "photo.saved.loginRequired": "Please log in to see your saved photos.",
    "photo.saved.link": "Saved photos",
  },
  es: {
    "photo.bookmark.save": "Guardar", "photo.bookmark.saved": "Guardada",
    "photo.bookmark.save.title": "Guardar esta foto en tu lista privada", "photo.bookmark.saved.title": "Guardada en tu lista. Selecciona para quitarla.",
    "photo.bookmark.login": "Inicia sesión primero.", "photo.bookmark.toomany": "Demasiados guardados en poco tiempo. Espera un momento.",
    "photo.bookmark.full": "Tu lista de guardadas está llena. Quita algunas fotos primero.", "photo.bookmark.error": "No se pudo guardar. Inténtalo de nuevo.",
    "photo.saved.title": "Fotos guardadas", "photo.saved.sub": "Las fotos que guardaste, las más recientes primero. Solo tú puedes ver esta lista.",
    "photo.saved.empty": "Aún no has guardado ninguna foto. Elige Guardar en una foto y aparecerá aquí.", "photo.saved.browse": "Ver fotos",
    "photo.saved.all": "Todas las fotos", "photo.saved.newest": "Volver a lo último guardado", "photo.saved.loginRequired": "Inicia sesión para ver tus fotos guardadas.",
    "photo.saved.link": "Fotos guardadas",
  },
  fr: {
    "photo.bookmark.save": "Enregistrer", "photo.bookmark.saved": "Enregistrée",
    "photo.bookmark.save.title": "Enregistrer cette photo dans votre liste privée", "photo.bookmark.saved.title": "Enregistrée dans votre liste. Sélectionnez pour la retirer.",
    "photo.bookmark.login": "Veuillez d'abord vous connecter.", "photo.bookmark.toomany": "Trop d'enregistrements en peu de temps. Patientez un instant.",
    "photo.bookmark.full": "Votre liste est pleine. Retirez d'abord quelques photos.", "photo.bookmark.error": "Impossible d'enregistrer. Veuillez réessayer.",
    "photo.saved.title": "Photos enregistrées", "photo.saved.sub": "Les photos que vous avez enregistrées, les plus récentes d'abord. Vous seul pouvez voir cette liste.",
    "photo.saved.empty": "Vous n'avez encore enregistré aucune photo. Choisissez Enregistrer sur une photo et elle apparaîtra ici.", "photo.saved.browse": "Parcourir les photos",
    "photo.saved.all": "Toutes les photos", "photo.saved.newest": "Retour aux plus récentes", "photo.saved.loginRequired": "Connectez-vous pour voir vos photos enregistrées.",
    "photo.saved.link": "Photos enregistrées",
  },
  hi: {
    "photo.bookmark.save": "सहेजें", "photo.bookmark.saved": "सहेजी गई",
    "photo.bookmark.save.title": "इस फ़ोटो को अपनी निजी सूची में सहेजें", "photo.bookmark.saved.title": "आपकी सूची में सहेजी गई है। हटाने के लिए चुनें।",
    "photo.bookmark.login": "कृपया पहले लॉग इन करें।", "photo.bookmark.toomany": "थोड़े समय में बहुत ज़्यादा सेव हुए। कृपया थोड़ा रुकें।",
    "photo.bookmark.full": "आपकी सहेजी हुई सूची भर गई है। पहले कुछ फ़ोटो हटाएँ।", "photo.bookmark.error": "सहेजा नहीं जा सका। कृपया फिर कोशिश करें।",
    "photo.saved.title": "सहेजी गई फ़ोटो", "photo.saved.sub": "आपकी सहेजी गई फ़ोटो, सबसे हाल की पहले। यह सूची केवल आप देख सकते हैं।",
    "photo.saved.empty": "आपने अभी तक कोई फ़ोटो नहीं सहेजी है। किसी फ़ोटो पर सहेजें चुनें, वह यहाँ दिखेगी।", "photo.saved.browse": "फ़ोटो देखें",
    "photo.saved.all": "सभी फ़ोटो", "photo.saved.newest": "सबसे हाल की सहेजी पर वापस", "photo.saved.loginRequired": "अपनी सहेजी गई फ़ोटो देखने के लिए लॉग इन करें।",
    "photo.saved.link": "सहेजी गई फ़ोटो",
  },
  zh: {
    "photo.bookmark.save": "收藏", "photo.bookmark.saved": "已收藏",
    "photo.bookmark.save.title": "将这张照片收藏到你的私人列表", "photo.bookmark.saved.title": "已收藏到你的列表。选择可取消收藏。",
    "photo.bookmark.login": "请先登录。", "photo.bookmark.toomany": "短时间内收藏过多，请稍等片刻。",
    "photo.bookmark.full": "你的收藏列表已满，请先移除一些照片。", "photo.bookmark.error": "无法收藏，请重试。",
    "photo.saved.title": "收藏的照片", "photo.saved.sub": "你收藏的照片，最近收藏的在前。只有你能看到此列表。",
    "photo.saved.empty": "你还没有收藏任何照片。在照片上选择收藏，它就会出现在这里。", "photo.saved.browse": "浏览照片",
    "photo.saved.all": "全部照片", "photo.saved.newest": "返回最近收藏", "photo.saved.loginRequired": "请登录以查看你收藏的照片。",
    "photo.saved.link": "收藏的照片",
  },
  ar: {
    "photo.bookmark.save": "حفظ", "photo.bookmark.saved": "محفوظة",
    "photo.bookmark.save.title": "احفظ هذه الصورة في قائمتك الخاصة", "photo.bookmark.saved.title": "محفوظة في قائمتك. اضغط لإزالتها.",
    "photo.bookmark.login": "يرجى تسجيل الدخول أولاً.", "photo.bookmark.toomany": "عدد كبير من عمليات الحفظ في وقت قصير. يرجى الانتظار قليلاً.",
    "photo.bookmark.full": "قائمة المحفوظات ممتلئة. أزل بعض الصور أولاً.", "photo.bookmark.error": "تعذّر الحفظ. يرجى المحاولة مرة أخرى.",
    "photo.saved.title": "الصور المحفوظة", "photo.saved.sub": "الصور التي حفظتها، الأحدث حفظاً أولاً. أنت وحدك ترى هذه القائمة.",
    "photo.saved.empty": "لم تحفظ أي صورة بعد. اختر حفظ على صورة وستظهر هنا.", "photo.saved.browse": "تصفّح الصور",
    "photo.saved.all": "كل الصور", "photo.saved.newest": "العودة إلى أحدث المحفوظات", "photo.saved.loginRequired": "سجّل الدخول لرؤية صورك المحفوظة.",
    "photo.saved.link": "الصور المحفوظة",
  },
};
for (const [lang, x] of Object.entries(T)) {
  const file = `web/src/i18n/messages/${lang}.ts`;
  const src = read(file);
  if (src === null) { fail(file, "file not found"); continue; }
  if (src.includes('"photo.bookmark.save"')) { done(file, "skip"); continue; }
  const match = src.match(/^  "photo\.side\.everyone":.*\n/m) ?? src.match(/^  "photo\.visibility\.public":.*\n/m);
  if (!match) { fail(file, 'no anchor ("photo.side.everyone" or "photo.visibility.public")'); continue; }
  const lines = "  // Saved photos (patch-photo-save)\n" + Object.entries(x).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n") + "\n";
  const at = match.index + match[0].length;
  fs.writeFileSync(file, src.slice(0, at) + lines + src.slice(at));
  done(file, "updated");
}

console.log(problems ? `\n${problems} problem(s): read the lines above. Nothing was half-written.` : "\nAll done. Next: cd web && npx prisma migrate dev && npx prisma generate");
process.exit(problems ? 1 : 0);
