// Puts the three C2 additions back into files that were restored from header-banner-changes.zip.
// Run in the project folder (where PROJECT.md is):   node reapply-c2-additions.mjs
// Safe to run twice: a piece that is already there is not added again.
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
let changed = 0;
function save(p, text) { fs.writeFileSync(p, text, "utf8"); changed++; console.log("changed  " + p); }

// ---- 1. schema.prisma: the RateEvent table
{
  const p = "web/prisma/schema.prisma";
  let s = read(p);
  if (!s.includes("model RateEvent")) {
    s = s.replace(/\s*$/, "\n") + `
// Rate-limit events kept in the database (SOCIAL_TODO C2). One row = one counted action (for example key "like:<userId>").
// Not linked to User on purpose: these rows are temporary counters, not content, and are swept after 2 days (src/lib/rate-limit-db.ts).
// Survives a server restart and is shared by every server that uses this database.
model RateEvent {
  id  Int      @id @default(autoincrement())
  key String
  at  DateTime

  @@index([key, at])
  @@index([at])
}
`;
    save(p, s);
  } else console.log("already  " + p);
}

// ---- 2. site.ts: newAccountLimits and socialDuplicate
{
  const p = "web/src/config/site.ts";
  let s = read(p);
  const marker = "export const socialLimits = {";
  if (!s.includes(marker)) throw new Error("site.ts: cannot find `" + marker + "`");
  let add = "";
  if (!s.includes("export const newAccountLimits")) add += `// Stricter limits for NEW accounts (SOCIAL_TODO C2, part 2). PROVISIONAL numbers: tune after real use.
// An account younger than \`days\` gets \`factor\` of every limit below (rounded down, never less than 1):
// posts, replies, follows, likes (posts and replies), reposts and reports. Spam accounts are almost always brand new.
// Nothing else changes for them. After \`days\` days the normal numbers apply, with no action from anybody.
export const newAccountLimits = {
  days: 7,
  factor: 0.5,
};

`;
  if (!s.includes("export const socialDuplicate")) add += `// The same text sent again and again (SOCIAL_TODO C2, part 3). PROVISIONAL numbers: tune after real use.
// A new post or reply is refused when the SAME person already sent the same text within \`windowHours\`.
// "Same" ignores capital letters, spaces, line breaks, punctuation and emoji ("Buy now!!" = "buy  now").
// Texts shorter than \`minChars\` (after that cleaning) are never counted as repeats, so "thanks" or "+1" can be said twice.
export const socialDuplicate = {
  windowHours: 24,
  minChars: 12,
};

`;
  if (add) save(p, s.replace(marker, add + marker)); else console.log("already  " + p);
}

// ---- 3. the 2 texts in six languages
const texts = {
  en: ["You already posted this text recently. Please write something new.", "You already sent this reply recently. Please write something new."],
  es: ["Ya publicaste este texto hace poco. Escribe algo nuevo.", "Ya enviaste esta respuesta hace poco. Escribe algo nuevo."],
  fr: ["Vous avez déjà publié ce texte récemment. Écrivez quelque chose de nouveau.", "Vous avez déjà envoyé cette réponse récemment. Écrivez quelque chose de nouveau."],
  hi: ["आपने यह टेक्स्ट हाल ही में पहले ही पोस्ट किया है। कृपया कुछ नया लिखें।", "आपने यह जवाब हाल ही में पहले ही भेजा है। कृपया कुछ नया लिखें।"],
  zh: ["你最近已经发布过相同的内容。请写点新的。", "你最近已经发送过相同的回复。请写点新的。"],
  ar: ["لقد نشرت هذا النص مؤخرًا بالفعل. يرجى كتابة شيء جديد.", "لقد أرسلت هذا الرد مؤخرًا بالفعل. يرجى كتابة شيء جديد."],
};
for (const [lang, [formText, replyText]] of Object.entries(texts)) {
  const p = `web/src/i18n/messages/${lang}.ts`;
  let s = read(p);
  let touched = false;
  for (const [after, key, value] of [["social.form.toomany", "social.form.duplicate", formText], ["social.reply.toomany", "social.reply.duplicate", replyText]]) {
    if (s.includes(`"${key}"`)) continue;
    const m = new RegExp(`^([ \\t]*)"${after.replace(/\./g, "\\.")}":.*\\n`, "m").exec(s);
    if (!m) throw new Error(`${p}: cannot find "${after}"`);
    const at = m.index + m[0].length;
    s = s.slice(0, at) + `${m[1]}"${key}": "${value}",\n` + s.slice(at);
    touched = true;
  }
  if (touched) save(p, s); else console.log("already  " + p);
}
console.log(changed ? `\nDone: ${changed} file(s) changed.` : "\nNothing to do: everything was already there.");
