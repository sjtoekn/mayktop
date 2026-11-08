// apply-social-views.mjs (patch-social-views, SOCIAL_TODO B5). Run in the project folder (where CHANGELOG.md is):
//   node apply-social-views.mjs      (must end with "All done.")
// It only ADDS to existing files (it never replaces a whole file) and can be run twice safely.
import fs from "node:fs";

const I18N = {
  en: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.one": "{n} view",
  "social.views.other": "{n} views",
  "social.views.title": "Counted when a post has been on screen for a moment. Your own views, and repeat views on the same day, are not counted.",
`,
  es: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.one": "{n} visualización",
  "social.views.other": "{n} visualizaciones",
  "social.views.title": "Se cuenta cuando una publicación ha estado un momento en pantalla. No se cuentan tus propias visualizaciones ni las repetidas el mismo día.",
`,
  fr: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.one": "{n} vue",
  "social.views.other": "{n} vues",
  "social.views.title": "Compté quand une publication est restée un instant à l’écran. Vos propres vues et les vues répétées le même jour ne sont pas comptées.",
`,
  zh: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.other": "{n} 次浏览",
  "social.views.title": "帖子在屏幕上停留片刻后才会计数。你自己的浏览和同一天的重复浏览不会计入。",
`,
  hi: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.one": "{n} व्यू",
  "social.views.other": "{n} व्यू",
  "social.views.title": "पोस्ट कुछ पल स्क्रीन पर रहने पर ही गिनी जाती है। आपके अपने व्यू और उसी दिन के दोहराए गए व्यू नहीं गिने जाते।",
`,
  ar: `  // View counts (SOCIAL_TODO B5, patch-social-views)
  "social.views.zero": "لا مشاهدات",
  "social.views.one": "مشاهدة واحدة",
  "social.views.two": "مشاهدتان",
  "social.views.few": "{n} مشاهدات",
  "social.views.many": "{n} مشاهدة",
  "social.views.other": "{n} مشاهدة",
  "social.views.title": "تُحتسب المشاهدة عندما يبقى المنشور على الشاشة للحظة. لا تُحتسب مشاهداتك الخاصة ولا المشاهدات المتكررة في اليوم نفسه.",
`,
};
const CSS = `
/* Social post view count (SOCIAL_TODO B5) */
.sp-views { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); font-size: 15px; white-space: nowrap; }
`;
const ENTRY = "- patch-social-views (SOCIAL_TODO B5: view counts on the post card): every Social post card now shows a view figure \"👁 1.3K\" beside Like, Repost and Reply (the like, repost and reply counts were already there; only views were missing). ONE running total per post, `SocialPost.viewCount`, that keeps growing for as long as the post exists. NOTHING about who looked is saved: no user id, no IP, no table of views; a bare total is not personal data (decision 2026-11-08, in the way YouTube and Facebook count: only real views). A view counts when at least half of the card has been on screen for 1 second (`SocialViewCount.tsx`, `IntersectionObserver`, once per page load); the browser then calls `POST /api/social/view {id}` (`api/social/view/route.ts`, always answers 204). Not counted: nobody logged in, crawlers and scripts (`looksLikeBot`), the author's own view, a post that may not be shown (`addSocialView` in `social-view-db.ts` uses the same visibility rules as the feeds), a repeat by the same person within 24 hours, anything over the rate limit `socialLimits.views` (120 per minute, 5000 per day per person, server memory). To know \"already looked today\" the server keeps `<personId>:<postId>` in its MEMORY for 24 hours (`firstViewInWindow`, swept at 50,000 entries, hard limit 200,000): never written to disk or the database, gone at a restart, so after a restart one more view of the same post by the same person can count: the total is a close count, not an exact one. The shown number is the short form (1.3K, `formatCompact`) with the full number for screen readers and a tooltip that explains what is counted. MIGRATION `social_post_views` (`SocialPost.viewCount INTEGER NOT NULL DEFAULT 0`; run `npx prisma migrate dev` then `npx prisma generate`). Rules in `src/lib/social-views.ts`. A post's total is not part of the data export (it is a count about the post, not about the person) and survives account erasure as an anonymous number. Updating a post's total also refreshes `SocialPost.updatedAt` (nothing reads it). New test `npm run test:social-views` (no database). 3 new texts per language (`social.views.*`, plural forms for en, es, fr, hi, zh and ar). Not done on purpose: unique-viewer counts, views per day, a view count for replies, showing views on community posts, live updating of the number, a \"seen by\" list, ranking by views (the Social feed stays newest first).\n";

let problems = 0;
const read = (p) => fs.readFileSync(p, "utf8");
function edit(path, label, fn) {
  if (!fs.existsSync(path)) { console.log("PROBLEM  " + path + " not found"); problems++; return; }
  const before = read(path);
  let after;
  try { after = fn(before); } catch (e) { console.log("PROBLEM  " + path + ": " + e.message); problems++; return; }
  if (after === before) { console.log("skip     " + path + " (" + label + " already there)"); return; }
  fs.writeFileSync(path, after);
  console.log("edited   " + path + " (" + label + ")");
}
function need(text, anchor) { if (text.indexOf(anchor) < 0) throw new Error("anchor not found: " + anchor.slice(0, 70)); }
function once(s, anchor, replacement) { need(s, anchor); return s.replace(anchor, () => replacement); }

edit("web/prisma/schema.prisma", "SocialPost.viewCount", (s) => {
  const start = s.indexOf("model SocialPost {");
  if (start < 0) throw new Error("model SocialPost not found");
  const end = s.indexOf("\n}", start);
  if (s.slice(start, end).includes("viewCount")) return s;
  const anchor = "  deletedAt DateTime?\n";
  const at = s.indexOf(anchor, start);
  if (at < 0 || at > end) throw new Error("deletedAt line of SocialPost not found");
  const add = "  // Running total of views (SOCIAL_TODO B5, patch-social-views): a bare number, nothing about who looked is saved.\n  viewCount Int @default(0)\n";
  return s.slice(0, at + anchor.length) + add + s.slice(at + anchor.length);
});

edit("web/src/lib/queries.ts", "views in the post summary", (s) => {
  if (s.includes("views: row.viewCount")) return s;
  s = once(s, "  replies: number;\n  /** Usernames saved as mentioned", "  replies: number;\n  /** Running total of views (SOCIAL_TODO B5). */\n  views: number;\n  /** Usernames saved as mentioned");
  s = once(s, "const socialPostSelect = {\n  id: true,\n  body: true,\n  mediaUrl: true,\n", "const socialPostSelect = {\n  id: true,\n  body: true,\n  mediaUrl: true,\n  viewCount: true,\n");
  s = once(s, "    replies: row._count.replies,\n    mentions: row.mentions", "    replies: row._count.replies,\n    views: row.viewCount,\n    mentions: row.mentions");
  return s;
});

edit("web/src/config/site.ts", "socialLimits.views", (s) => {
  if (s.includes("views: [")) return s;
  const start = s.indexOf("export const socialLimits = {");
  if (start < 0) throw new Error("socialLimits not found");
  const end = s.indexOf("\n};", start);
  if (end < 0) throw new Error("end of socialLimits not found");
  const add = "\n  views: [\n    { max: 120, windowSeconds: 60 },\n    { max: 5000, windowSeconds: 24 * 60 * 60 },\n  ], // views reported by the browser (SOCIAL_TODO B5): scrolling past 50 posts must fit; a script must not; server memory";
  return s.slice(0, end) + add + s.slice(end);
});

edit("web/src/components/social/SocialPostCard.tsx", "view count on the card", (s) => {
  if (s.includes("SocialViewCount")) return s;
  s = once(s, 'import { t } from "@/i18n";\n', 'import { formatCompact, t, tn } from "@/i18n";\nimport SocialViewCount from "@/components/social/SocialViewCount";\n');
  s = once(
    s,
    "            💬 {post.replies}\n          </Link>\n",
    "            💬 {post.replies}\n          </Link>\n" +
      "          <SocialViewCount\n            postId={post.id}\n            text={formatCompact(post.views)}\n            label={tn(\"social.views\", post.views)}\n            title={t(\"social.views.title\")}\n            countable={viewer !== post.author}\n          />\n",
  );
  return s;
});

edit("web/src/app/content.css", "view count style", (s) => (s.includes(".sp-views") ? s : s.replace(/\n*$/, "\n") + CSS));

edit("web/package.json", "test:social-views", (s) => {
  if (s.includes("test:social-views")) return s;
  const m = s.match(/^(\s*)"test:social-new-posts": "[^"]*",\n/m);
  if (!m) throw new Error('"test:social-new-posts" line not found');
  return s.replace(m[0], m[0] + m[1] + '"test:social-views": "tsx scripts/test-social-views.ts",\n');
});

for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  edit(`web/src/i18n/messages/${lang}.ts`, "view texts", (s) => {
    if (s.includes('"social.views.other"')) return s;
    const i = lang === "en" ? s.indexOf("} as const;") : s.lastIndexOf("};");
    if (i < 0) throw new Error("end of the texts not found");
    return s.slice(0, i) + I18N[lang] + s.slice(i);
  });
}

edit("CHANGELOG.md", "entry", (s) => {
  if (s.includes("patch-social-views")) return s;
  const m = s.match(/^## \d{4}-\d{2}-\d{2}\n/m);
  if (!m) throw new Error("no date heading found");
  return s.replace(m[0], () => m[0] + ENTRY);
});

for (const f of [
  "web/src/lib/social-views.ts",
  "web/src/lib/social-view-db.ts",
  "web/src/app/api/social/view/route.ts",
  "web/src/components/social/SocialViewCount.tsx",
  "web/scripts/test-social-views.ts",
  "web/prisma/migrations/20261113090000_social_post_views/migration.sql",
]) {
  if (!fs.existsSync(f)) { console.log("PROBLEM  new file missing: " + f + " (did you unzip patch-social-views.zip?)"); problems++; }
}
console.log(problems === 0 ? "\nAll done." : "\n" + problems + " problem(s). Send me the screen.");
process.exit(problems === 0 ? 0 : 1);
