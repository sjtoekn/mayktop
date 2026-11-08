// patch-social-fair-rank (SOCIAL_TODO B10: fair ranking of replies and reposts).
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-fair-rank.mjs
// It edits existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped. DATABASE CHANGE: one new table (the migration folder is part of the patch).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const p = (...parts) => path.join(root, ...parts);
let problems = 0;

function read(file) {
  if (!fs.existsSync(file)) { console.log("MISSING FILE: " + path.relative(root, file)); problems++; return null; }
  return fs.readFileSync(file, "utf8");
}
function replaceOnce(file, from, to, marker) {
  const src = read(file);
  if (src === null) return;
  if (marker && src.includes(marker)) { console.log("skip (already done): " + path.relative(root, file) + "  [" + marker.slice(0, 50).replace(/\n/g, " ") + "]"); return; }
  const parts = src.split(from);
  if (parts.length !== 2) { console.log(`PROBLEM: in ${path.relative(root, file)} the text was found ${parts.length - 1} times (need exactly 1): ${JSON.stringify(from.slice(0, 80))}`); problems++; return; }
  fs.writeFileSync(file, parts[0] + to + parts[1]);
  console.log("edited: " + path.relative(root, file));
}
function appendOnce(file, text, marker) {
  const src = read(file);
  if (src === null) return;
  if (src.includes(marker)) { console.log("skip (already done): " + path.relative(root, file)); return; }
  fs.writeFileSync(file, src.replace(/\s*$/, "\n") + text);
  console.log("edited: " + path.relative(root, file));
}
function insertAfterFirst(file, anchor, text, marker) {
  const src = read(file);
  if (src === null) return;
  if (src.includes(marker)) { console.log("skip (already done): " + path.relative(root, file)); return; }
  const i = src.indexOf(anchor);
  if (i < 0) { console.log(`PROBLEM: anchor not found in ${path.relative(root, file)}: ${JSON.stringify(anchor.slice(0, 60))}`); problems++; return; }
  const at = i + anchor.length;
  fs.writeFileSync(file, src.slice(0, at) + text + src.slice(at));
  console.log("edited: " + path.relative(root, file));
}
const doc = (name) => { const f = p("docs-social-fair-rank", name); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : (console.log("MISSING NEW FILE: docs-social-fair-rank/" + name), problems++, ""); };


// 0. The new files must be there (they come in the zip)
for (const f of [
  "web/src/lib/social-fair-rank-rules.ts",
  "web/src/lib/social-reply-like.ts",
  "web/src/lib/social-reply-like-view.ts",
  "web/src/lib/social-replies-query.ts",
  "web/src/components/social/SocialReplyLikeButton.tsx",
  "web/src/components/social/SocialReplyList.tsx",
  "web/src/app/(site)/social/reply-like/actions.ts",
  "web/prisma/migrations/20261117090000_reply_likes/migration.sql",
  "web/scripts/test-social-fair-rank.ts",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (unzip the patch first): " + f); problems++; }
}

// 1. Database: one new table (the migration SQL is in the zip: do NOT make a new one with --name)
{
  const schema = p("web/prisma/schema.prisma");
  replaceOnce(schema, `  socialPostLikes     SocialPostLike[]\n`, `  socialPostLikes     SocialPostLike[]\n  socialReplyLikes    SocialReplyLike[]\n`, `socialReplyLikes    SocialReplyLike[]`);
  replaceOnce(
    schema,
    `  reports    Report[]\n\n  @@index([socialPostId, createdAt])\n  @@index([authorId, createdAt])\n`,
    `  reports    Report[]\n  likes      SocialReplyLike[]\n\n  @@index([socialPostId, createdAt])\n  @@index([authorId, createdAt])\n`,
    `likes      SocialReplyLike[]`,
  );
  appendOnce(
    schema,
    `// A Like on a reply (SOCIAL_TODO B10). One row per person per reply. Only a number is shown to others; it feeds the fair "Top" order.
model SocialReplyLike {
  userId        String
  socialReplyId Int
  createdAt     DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  socialReply SocialReply @relation(fields: [socialReplyId], references: [id], onDelete: Restrict)

  @@id([userId, socialReplyId])
  @@index([socialReplyId])
}
`,
    `model SocialReplyLike {`,
  );
}

// 2. Numbers (config)
appendOnce(
  p("web/src/config/site.ts"),
  `// Fair ranking of replies under a Social post (SOCIAL_TODO B10, ACCOUNT_RULES.md 3.22). PROVISIONAL numbers.
// Same rules and same meaning as rankingConfig (the Popular page), tuned for one conversation: replies fade slower (7 days).
export const socialReplyRank = {
  halfLifeHours: 168,
  sameAuthorFactor: 0.5,
  risingEvery: 4,
  risingWindowHours: 72,
  risingLuck: 2,
  newAccountDays: 30,
  newVoiceMaxPosts: 3,
  seedHours: 6,
  maxCandidates: 300,
};
`,
  `export const socialReplyRank`,
);

// 3. Texts in all six languages (inserted after "social.replies.empty")
const texts = {
  en: [
    ["social.replyRank.label", "Sort replies"],
    ["social.replyRank.oldest", "Oldest"],
    ["social.replyRank.top", "Top"],
    ["social.replyRank.how", "How replies are ranked"],
    ["social.replyLike.like", "Like this reply"],
    ["social.replyLike.unlike", "Remove your like from this reply"],
    ["social.repost.byMany", "{name} and {count} more reposted"],
  ],
  es: [
    ["social.replyRank.label", "Ordenar respuestas"],
    ["social.replyRank.oldest", "Más antiguas"],
    ["social.replyRank.top", "Destacadas"],
    ["social.replyRank.how", "Cómo se ordenan las respuestas"],
    ["social.replyLike.like", "Me gusta esta respuesta"],
    ["social.replyLike.unlike", "Quitar tu me gusta de esta respuesta"],
    ["social.repost.byMany", "{name} y {count} más republicaron"],
  ],
  fr: [
    ["social.replyRank.label", "Trier les réponses"],
    ["social.replyRank.oldest", "Plus anciennes"],
    ["social.replyRank.top", "Meilleures"],
    ["social.replyRank.how", "Comment les réponses sont classées"],
    ["social.replyLike.like", "Aimer cette réponse"],
    ["social.replyLike.unlike", "Retirer votre mention j'aime de cette réponse"],
    ["social.repost.byMany", "{name} et {count} autres ont republié"],
  ],
  zh: [
    ["social.replyRank.label", "回复排序"],
    ["social.replyRank.oldest", "最早"],
    ["social.replyRank.top", "热门"],
    ["social.replyRank.how", "回复如何排序"],
    ["social.replyLike.like", "赞这条回复"],
    ["social.replyLike.unlike", "取消对这条回复的赞"],
    ["social.repost.byMany", "{name} 和另外 {count} 人转发了"],
  ],
  hi: [
    ["social.replyRank.label", "जवाबों को क्रमबद्ध करें"],
    ["social.replyRank.oldest", "सबसे पुराने"],
    ["social.replyRank.top", "शीर्ष"],
    ["social.replyRank.how", "जवाबों का क्रम कैसे तय होता है"],
    ["social.replyLike.like", "इस जवाब को पसंद करें"],
    ["social.replyLike.unlike", "इस जवाब से अपनी पसंद हटाएँ"],
    ["social.repost.byMany", "{name} और {count} अन्य ने रीपोस्ट किया"],
  ],
  ar: [
    ["social.replyRank.label", "ترتيب الردود"],
    ["social.replyRank.oldest", "الأقدم"],
    ["social.replyRank.top", "الأبرز"],
    ["social.replyRank.how", "كيف تُرتَّب الردود"],
    ["social.replyLike.like", "الإعجاب بهذا الرد"],
    ["social.replyLike.unlike", "إزالة إعجابك بهذا الرد"],
    ["social.repost.byMany", "{name} و{count} آخرون أعادوا النشر"],
  ],
};
for (const [lang, rows] of Object.entries(texts)) {
  const file = p(`web/src/i18n/messages/${lang}.ts`);
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.replyRank.label"')) { console.log("skip (already done): " + path.relative(root, file)); continue; }
  const m = src.match(/^[ \t]*"social\.replies\.empty":.*\n/m);
  if (!m) { console.log("PROBLEM: \"social.replies.empty\" not found in " + path.relative(root, file)); problems++; continue; }
  const add = rows.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},\n`).join("");
  const at = m.index + m[0].length;
  fs.writeFileSync(file, src.slice(0, at) + add + src.slice(at));
  console.log("edited: " + path.relative(root, file));
}

// 4. Feeds: merge plain reposts of the same post inside one page
{
  const q = p("web/src/lib/queries.ts");
  replaceOnce(q, `import { rankPopularDetailed, type RankItem } from "@/lib/ranking";\n`, `import { rankPopularDetailed, type RankItem } from "@/lib/ranking";\nimport { collapsePlainReposts } from "@/lib/social-fair-rank-rules";\n`, `import { collapsePlainReposts }`);
  replaceOnce(q, `  quote: string | null;\n  post: SocialPostSummary;\n};`, `  quote: string | null;\n  post: SocialPostSummary;\n  /** Plain reposts of the same post merged into this one on this page (SOCIAL_TODO B10). Absent = none. */\n  alsoCount?: number;\n};`, `alsoCount?: number;`);
  replaceOnce(q, `  return { items: kept.map((entry) => entry.item), next: next ? cursorToText(next) : null };`, `  return { items: collapsePlainReposts(kept.map((entry) => entry.item)), next: next ? cursorToText(next) : null };`, `items: collapsePlainReposts(kept`);
  replaceOnce(q, `  return [...communityItems, ...socialItems, ...repostItems]\n    .sort(`, `  const merged = [...communityItems, ...socialItems, ...repostItems]\n    .sort(`, `const merged = [...communityItems`);
  replaceOnce(q, `      return idOf(b) - idOf(a);\n    })\n    .slice(0, 50);\n}`, `      return idOf(b) - idOf(a);\n    })\n    .slice(0, 50);\n  return collapsePlainReposts(merged); // SOCIAL_TODO B10\n}`, `return collapsePlainReposts(merged)`);
  replaceOnce(
    p("web/src/components/social/SocialRepostCard.tsx"),
    `↻ {t("social.repost.by", { name })} <span dir="ltr">`,
    `↻ {item.alsoCount ? t("social.repost.byMany", { name, count: item.alsoCount }) : t("social.repost.by", { name })} <span dir="ltr">`,
    `social.repost.byMany`,
  );
}

// 5. The post page: read the sort, put the replies in order, pass the extras to the list
{
  const page = p("web/src/app/(site)/social/[id]/page.tsx");
  replaceOnce(
    page,
    `import SocialReplyList from "@/components/social/SocialReplyList";`,
    `import SocialReplyList from "@/components/social/SocialReplyList";\nimport { socialReplyRank } from "@/config/site";\nimport { nowMs } from "@/lib/now";\nimport { orderReplies, parseReplySort } from "@/lib/social-fair-rank-rules";\nimport { getMyReplyLikes } from "@/lib/social-reply-like-view";`,
    `import { orderReplies, parseReplySort }`,
  );
  replaceOnce(
    page,
    `export default function SocialPostPage({ params }: { params: Promise<{ id: string }> }) {\n  return (\n    <Suspense fallback={<p className="pc-empty">…</p>}>\n      <SocialPostContent params={params} />`,
    `export default function SocialPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {\n  return (\n    <Suspense fallback={<p className="pc-empty">…</p>}>\n      <SocialPostContent params={params} searchParams={searchParams} />`,
    `searchParams={searchParams}`,
  );
  replaceOnce(
    page,
    `async function SocialPostContent({ params }: { params: Promise<{ id: string }> }) {\n  await connection();\n\n  const { id: rawId } = await params;`,
    `async function SocialPostContent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string | string[] }> }) {\n  await connection();\n\n  const { id: rawId } = await params;\n  const sort = parseReplySort((await searchParams).sort); // SOCIAL_TODO B10: "oldest" (default) or "top"`,
    `const sort = parseReplySort(`,
  );
  replaceOnce(
    page,
    `  const replyAccess = await getReplyAccess(viewer.id, post.id);\n`,
    `  const replyAccess = await getReplyAccess(viewer.id, post.id);\n  // Fair order of replies (SOCIAL_TODO B10): hidden-by-author replies stay in their own part, oldest first.\n  const ordered = orderReplies(replies.filter((reply) => !reply.hiddenByAuthor), sort, nowMs(), socialReplyRank);\n  const orderedReplies = [...ordered.items, ...replies.filter((reply) => reply.hiddenByAuthor)];\n  const likedReplyIds = await getMyReplyLikes(viewer.id, replies.map((reply) => reply.id));\n`,
    `const orderedReplies =`,
  );
  replaceOnce(
    page,
    `        replies={replies}\n`,
    `        replies={orderedReplies}\n`,
    `replies={orderedReplies}`,
  );
  replaceOnce(
    page,
    `        canReply={replyAccess.canReply}\n      />`,
    `        canReply={replyAccess.canReply}\n        sort={sort}\n        likedReplyIds={likedReplyIds}\n        risingIds={[...ordered.rising]}\n      />`,
    `risingIds={[...ordered.rising]}`,
  );
}

// 6. Style, export, test command, docs
appendOnce(p("web/src/app/content.css"), doc("css-append.txt"), "Fair ranking of replies and reposts (SOCIAL_TODO B10)");
{
  const ex = p("web/src/lib/export-social.ts");
  replaceOnce(ex, `, pinned, optOuts] = await Promise.all([`, `, pinned, optOuts, replyLikes] = await Promise.all([`, `optOuts, replyLikes]`);
  replaceOnce(
    ex,
    `select: { type: true } }),\n  ]);`,
    `select: { type: true } }),\n    // Likes on replies (SOCIAL_TODO B10): only the reply numbers the person liked, and when.\n    db.socialReplyLike.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { socialReplyId: true, createdAt: true } }),\n  ]);`,
    `db.socialReplyLike.findMany`,
  );
  replaceOnce(ex, `    notificationsOff: optOuts.map((row) => row.type),\n`, `    notificationsOff: optOuts.map((row) => row.type),\n    replyLikes: replyLikes.map((l) => ({ socialReplyId: l.socialReplyId, since: l.createdAt })),\n`, `replyLikes: replyLikes.map`);
}
replaceOnce(
  p("web/package.json"),
  `"test:social-reply-control": "tsx scripts/test-social-reply-control.ts"`,
  `"test:social-reply-control": "tsx scripts/test-social-reply-control.ts",\n    "test:social-fair-rank": "tsx scripts/test-social-fair-rank.ts"`,
  `test:social-fair-rank`,
);
appendOnce(p("ACCOUNT_RULES.md"), doc("account-rules.txt"), "### 3.22 Fair ranking of replies and reposts");
appendOnce(p("PROJECT.md"), doc("project-append.txt"), "## 8e-2. Fair ranking of replies and reposts");
insertAfterFirst(p("CHANGELOG.md"), "## 2026-11-08\n", doc("changelog.txt"), "- patch-social-fair-rank");

console.log(problems === 0 ? "\nAll edits done. Next, in web/:  npx prisma migrate dev   (no --name)   then   npx prisma generate" : `\n${problems} problem(s): nothing is lost, but fix them before building.`);
process.exit(problems === 0 ? 0 : 1);
