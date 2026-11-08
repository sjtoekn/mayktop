// Edit window + edit history for Social posts (SOCIAL_TODO item 6): changes the SHARED files with exact-text edits.
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-edit-history.mjs
// Safe to run twice: a piece that is already there is not added again. Stops with a clear message if a file does not look as expected.
import fs from "node:fs";

let changed = 0;
const read = (p) => fs.readFileSync(p, "utf8");
function save(p, text) { fs.writeFileSync(p, text, "utf8"); changed++; console.log("changed  " + p); }
function edit(p, pieces) {
  let s = read(p);
  let touched = false;
  for (const { skip, find, replace, label } of pieces) {
    if (s.includes(skip)) continue;
    const count = s.split(find).length - 1;
    if (count !== 1) throw new Error(`${p}: ${label}: expected the text to appear once, found ${count} times`);
    s = s.replace(find, () => replace);
    touched = true;
  }
  if (touched) save(p, s); else console.log("already  " + p);
}

// ---- 1. site.ts: the numbers
edit("web/src/config/site.ts", [{
  label: "socialEdit",
  skip: "export const socialEdit",
  find: "export const socialLimits = {",
  replace: `// Editing your own Social post (SOCIAL_TODO item 6). PROVISIONAL numbers: tune after real use. The usual way (X / Twitter):
// a post can be edited for \`windowMinutes\` after it was WRITTEN (an edit does not restart the time), at most \`maxEdits\` times.
// Every earlier version is kept and shown on /social/<id>/history to everybody who can see the post.
export const socialEdit = {
  windowMinutes: 60,
  maxEdits: 5,
};

export const socialLimits = {`,
}]);

// ---- 2. schema.prisma: the table
{
  const p = "web/prisma/schema.prisma";
  let s = read(p);
  let touched = false;
  if (!/edits\s+SocialPostEdit\[\]/.test(s)) {
    const find = "  pinnedBy  SocialPinnedPost[]\n";
    if (s.split(find).length - 1 !== 1) throw new Error(p + ": cannot find the `pinnedBy` line of model SocialPost");
    s = s.replace(find, () => find + "  edits     SocialPostEdit[]\n");
    touched = true;
  }
  if (!s.includes("model SocialPostEdit")) {
    s = s.replace(/\s*$/, "\n") + `
// Edit history of a Social post (SOCIAL_TODO item 6): one row = one earlier version, saved when an edit replaced it.
// \`writtenAt\` = when that version was written (the post's time, or the time of the edit before). Deleted with the post's text.
model SocialPostEdit {
  id           Int      @id @default(autoincrement())
  socialPostId Int
  body         String
  writtenAt    DateTime

  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)

  @@index([socialPostId, id])
}
`;
    touched = true;
  }
  if (touched) save(p, s); else console.log("already  " + p);
}

// ---- 3. queries.ts: how many edits, and when the last one was
edit("web/src/lib/queries.ts", [
  {
    label: "_count edits",
    skip: "edits: true, // saved earlier versions",
    find: "      reposts: true,\n      replies: { where: { status: ContentStatus.VISIBLE, deletedAt: null } },\n",
    replace: "      reposts: true,\n      edits: true, // saved earlier versions (SOCIAL_TODO item 6)\n      replies: { where: { status: ContentStatus.VISIBLE, deletedAt: null } },\n",
  },
  {
    label: "summary type",
    skip: "  editCount?: number;",
    find: "  mentions: string[];\n  edited?: true;\n};",
    replace: "  mentions: string[];\n  edited?: true;\n  /** When the text was last changed (SOCIAL_TODO item 6). Absent = never edited. */\n  editedAtMs?: number;\n  /** How many earlier versions are saved = how many edits were made since the edit history exists (SOCIAL_TODO item 6). */\n  editCount?: number;\n};",
  },
  {
    label: "summary values",
    skip: "editCount: row._count.edits,",
    find: "    ...(row.editedAt !== null ? { edited: true as const } : {}),",
    replace: "    editCount: row._count.edits,\n    ...(row.editedAt !== null ? { edited: true as const, editedAtMs: row.editedAt.getTime() } : {}),",
  },
]);

// ---- 4. SocialPostCard.tsx: the "Edited" label opens the history; the owner box gets the numbers and 3 more texts
edit("web/src/components/social/SocialPostCard.tsx", [
  {
    label: "css import",
    skip: 'social-history.css',
    find: 'import SocialViewCount from "@/components/social/SocialViewCount";',
    replace: 'import SocialViewCount from "@/components/social/SocialViewCount";\nimport "@/components/social/social-history.css";',
  },
  {
    label: "Edited label",
    skip: "sp-editedLink",
    find: '          {post.edited ? ` · ${t("social.edited")}` : ""}',
    replace: '          {post.edited ? (\n            <>\n              {" · "}\n              <Link href={`/social/${post.id}/history`} className="sp-editedLink" title={t("social.history.open")}>\n                {t("social.edited")}\n              </Link>\n            </>\n          ) : null}',
  },
  {
    label: "owner props",
    skip: "createdAtMs={post.createdAtMs}",
    find: "          author={post.author}\n          body={post.body}\n          text={{\n            edit: t(\"social.edit\"),",
    replace: "          author={post.author}\n          body={post.body}\n          createdAtMs={post.createdAtMs}\n          editCount={post.editCount ?? 0}\n          text={{\n            edit: t(\"social.edit\"),",
  },
  {
    label: "owner texts",
    skip: 'windowClosed: t("social.edit.window"',
    find: '            loginLink: t("topbar.login"),\n            delete: t("social.delete"),',
    replace: '            loginLink: t("topbar.login"),\n            windowClosed: t("social.edit.window", { minutes: socialEdit.windowMinutes }),\n            limitReached: t("social.edit.limit", { max: socialEdit.maxEdits }),\n            hint: t("social.edit.hint", { left: "{left}", max: socialEdit.maxEdits }),\n            delete: t("social.delete"),',
  },
  {
    label: "config import",
    skip: "socialEdit, socialReportConfig",
    find: 'import { socialReportConfig, staffConfig } from "@/config/site";',
    replace: 'import { socialEdit, socialReportConfig, staffConfig } from "@/config/site";',
  },
]);

// ---- 5. purge-social.ts: final erasure also erases the earlier versions
edit("web/src/lib/purge-social.ts", [{
  label: "erase edits",
  skip: "db.socialPostEdit.deleteMany",
  find: "  const replies = await db.socialReply.updateMany({",
  replace: "  // The earlier versions of those posts go too (SOCIAL_TODO item 6): the text is erased for good, in every version.\n  await db.socialPostEdit.deleteMany({ where: { socialPost: { authorId: userId } } });\n  const replies = await db.socialReply.updateMany({",
}]);

// ---- 6. export-social.ts: "Download my data" includes the earlier versions of the person's own posts
edit("web/src/lib/export-social.ts", [
  {
    label: "names",
    skip: "replyLikes, postEdits] = await Promise.all([",
    find: "optOuts, replyLikes] = await Promise.all([",
    replace: "optOuts, replyLikes, postEdits] = await Promise.all([",
  },
  {
    label: "query",
    skip: "db.socialPostEdit.findMany",
    find: "    db.socialReplyLike.findMany({ where: { userId }, orderBy: { createdAt: \"asc\" }, select: { socialReplyId: true, createdAt: true } }),\n  ]);",
    replace: "    db.socialReplyLike.findMany({ where: { userId }, orderBy: { createdAt: \"asc\" }, select: { socialReplyId: true, createdAt: true } }),\n    // Earlier versions of the person's OWN posts (SOCIAL_TODO item 6).\n    db.socialPostEdit.findMany({ where: { socialPost: { authorId: userId } }, orderBy: { id: \"asc\" }, select: { socialPostId: true, body: true, writtenAt: true } }),\n  ]);",
  },
  {
    label: "result",
    skip: "postEdits: postEdits",
    find: "    replyLikes: replyLikes.map(",
    replace: "    postEdits: postEdits.map((e) => ({ socialPostId: e.socialPostId, text: e.body, writtenAt: e.writtenAt })),\n    replyLikes: replyLikes.map(",
  },
]);

// ---- 7. the 11 texts in six languages
const T = {
  en: {
    "social.edit.window": "Editing is possible for {minutes} minutes after posting. That time has passed.",
    "social.edit.limit": "A post can be edited {max} times at most. This post has used them all.",
    "social.edit.hint": "{left} of {max} edits left. Everyone who can see this post can see its earlier versions.",
    "social.history.open": "Show earlier versions",
    "social.history.title": "Edit history",
    "social.history.intro": "Everyone who can see this post can also see its earlier versions.",
    "social.history.current": "Current version · {time}",
    "social.history.earlier": "Earlier version · {time}",
    "social.history.none": "This post has not been edited.",
    "social.history.unsaved": "This post was edited before edit history existed, so its earlier versions were not saved.",
    "social.history.back": "Back to the post",
  },
  es: {
    "social.edit.window": "Puedes editar durante {minutes} minutos después de publicar. Ese tiempo ya pasó.",
    "social.edit.limit": "Una publicación se puede editar {max} veces como máximo. Esta ya las usó todas.",
    "social.edit.hint": "Te quedan {left} de {max} ediciones. Quien pueda ver esta publicación puede ver sus versiones anteriores.",
    "social.history.open": "Mostrar versiones anteriores",
    "social.history.title": "Historial de ediciones",
    "social.history.intro": "Quien pueda ver esta publicación también puede ver sus versiones anteriores.",
    "social.history.current": "Versión actual · {time}",
    "social.history.earlier": "Versión anterior · {time}",
    "social.history.none": "Esta publicación no se ha editado.",
    "social.history.unsaved": "Esta publicación se editó antes de que existiera el historial, por eso no se guardaron sus versiones anteriores.",
    "social.history.back": "Volver a la publicación",
  },
  fr: {
    "social.edit.window": "Vous pouvez modifier pendant {minutes} minutes après la publication. Ce délai est écoulé.",
    "social.edit.limit": "Une publication peut être modifiée {max} fois au maximum. Celle-ci les a toutes utilisées.",
    "social.edit.hint": "Il vous reste {left} modification(s) sur {max}. Toute personne qui voit cette publication peut voir ses versions précédentes.",
    "social.history.open": "Afficher les versions précédentes",
    "social.history.title": "Historique des modifications",
    "social.history.intro": "Toute personne qui peut voir cette publication peut aussi voir ses versions précédentes.",
    "social.history.current": "Version actuelle · {time}",
    "social.history.earlier": "Version précédente · {time}",
    "social.history.none": "Cette publication n'a pas été modifiée.",
    "social.history.unsaved": "Cette publication a été modifiée avant l'existence de l'historique, ses versions précédentes n'ont donc pas été conservées.",
    "social.history.back": "Retour à la publication",
  },
  hi: {
    "social.edit.window": "पोस्ट करने के बाद {minutes} मिनट तक संपादन किया जा सकता है। वह समय बीत चुका है।",
    "social.edit.limit": "एक पोस्ट को अधिकतम {max} बार संपादित किया जा सकता है। इस पोस्ट में सभी बार हो चुके हैं।",
    "social.edit.hint": "{max} में से {left} संपादन बाकी हैं। जो भी इस पोस्ट को देख सकता है, वह इसके पिछले संस्करण भी देख सकता है।",
    "social.history.open": "पिछले संस्करण दिखाएँ",
    "social.history.title": "संपादन इतिहास",
    "social.history.intro": "जो भी इस पोस्ट को देख सकता है, वह इसके पिछले संस्करण भी देख सकता है।",
    "social.history.current": "वर्तमान संस्करण · {time}",
    "social.history.earlier": "पिछला संस्करण · {time}",
    "social.history.none": "इस पोस्ट को संपादित नहीं किया गया है।",
    "social.history.unsaved": "यह पोस्ट संपादन इतिहास शुरू होने से पहले संपादित हुई थी, इसलिए इसके पिछले संस्करण सहेजे नहीं गए।",
    "social.history.back": "पोस्ट पर वापस जाएँ",
  },
  zh: {
    "social.edit.window": "发布后 {minutes} 分钟内可以编辑，这段时间已经过去。",
    "social.edit.limit": "一条帖子最多可以编辑 {max} 次，这条帖子已用完。",
    "social.edit.hint": "还可编辑 {left} 次（共 {max} 次）。所有能看到这条帖子的人都能看到它的历史版本。",
    "social.history.open": "查看历史版本",
    "social.history.title": "编辑历史",
    "social.history.intro": "所有能看到这条帖子的人，也能看到它的历史版本。",
    "social.history.current": "当前版本 · {time}",
    "social.history.earlier": "历史版本 · {time}",
    "social.history.none": "这条帖子没有被编辑过。",
    "social.history.unsaved": "这条帖子是在编辑历史功能出现之前编辑的，所以没有保存它的历史版本。",
    "social.history.back": "返回帖子",
  },
  ar: {
    "social.edit.window": "يمكن التعديل خلال {minutes} دقيقة بعد النشر. وقد انتهت هذه المدة.",
    "social.edit.limit": "يمكن تعديل المنشور {max} مرات على الأكثر. وقد استُنفدت جميعها.",
    "social.edit.hint": "تبقّى {left} من {max} تعديلات. كل من يستطيع رؤية هذا المنشور يستطيع رؤية نسخه السابقة.",
    "social.history.open": "عرض النسخ السابقة",
    "social.history.title": "سجل التعديلات",
    "social.history.intro": "كل من يستطيع رؤية هذا المنشور يستطيع أيضًا رؤية نسخه السابقة.",
    "social.history.current": "النسخة الحالية · {time}",
    "social.history.earlier": "نسخة سابقة · {time}",
    "social.history.none": "لم يتم تعديل هذا المنشور.",
    "social.history.unsaved": "عُدّل هذا المنشور قبل وجود سجل التعديلات، لذلك لم تُحفظ نسخه السابقة.",
    "social.history.back": "العودة إلى المنشور",
  },
};
for (const [lang, texts] of Object.entries(T)) {
  const p = `web/src/i18n/messages/${lang}.ts`;
  let s = read(p);
  const m = /^([ \t]*)"social\.edit\.login":.*\n/m.exec(s);
  if (!m) throw new Error(`${p}: cannot find "social.edit.login"`);
  const missing = Object.entries(texts).filter(([key]) => !s.includes(`"${key}"`));
  if (!missing.length) { console.log("already  " + p); continue; }
  const at = m.index + m[0].length;
  const lines = missing.map(([key, value]) => `${m[1]}${JSON.stringify(key)}: ${JSON.stringify(value)},\n`).join("");
  save(p, s.slice(0, at) + lines + s.slice(at));
}

// ---- 8. CHANGELOG (one line, at the top of the newest day)
{
  const p = "CHANGELOG.md";
  if (fs.existsSync(p)) {
    let s = read(p);
    if (!s.includes("patch-social-edit-history")) {
      const m = /^- patch-/m.exec(s);
      if (m) {
        const line = "- patch-social-edit-history (SOCIAL_TODO item 6: edit window + edit history): a Social post can be edited only for `socialEdit.windowMinutes` (60) after it was written (an edit does not restart the time) and at most `socialEdit.maxEdits` (5) times; the server refuses later edits (`window` / `limit`) and the Edit button is hidden. Every edit saves the replaced text as a `SocialPostEdit` row in the same transaction (`applySocialEdit`); the \"Edited\" label is now a link to `/social/<id>/history` showing the current text and all earlier versions, for everybody who can see the post (same visibility as the post page: hidden, removed, deleted or blocked = not found). Deleting your own post and the final erasure also erase the earlier versions; \"Download my data\" includes the earlier versions of your own posts (`postEdits`). New migration `social_post_edits`. 11 new texts in six languages. Posts edited BEFORE this patch have no saved earlier versions (the history page says so). New rules in `src/lib/social-edit-rules.ts` (pure); `test:social-edit` extended. Not done on purpose: replies and community posts/comments (no edit history yet), a moderator view of the history of a hidden post, a way to hide a harmful earlier version.\n";
        save(p, s.slice(0, m.index) + line + s.slice(m.index));
      }
    } else console.log("already  " + p);
  }
}

console.log(changed ? `\nDone: ${changed} file(s) changed.\nNext, in web/:  npx prisma migrate dev   npx prisma generate   npm run test:social-edit   npm run lint   npm run build` : "\nNothing to do: everything was already there.");
