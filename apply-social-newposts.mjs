// apply-social-newposts.mjs (patch-social-newposts, SOCIAL_TODO B4). Run in the project folder (where CHANGELOG.md is):
//   node apply-social-newposts.mjs      (must end with "All done.")
// It only ADDS to existing files (it never replaces a whole file) and can be run twice safely.
import fs from "node:fs";
const DATA = {"q_block": "\n// ---- \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts). How many Social posts and reposts are NEWER than\n// `sinceMs`, with the same visibility rules as the feeds. NOT the viewer's own items; not the people in `hidden` (Block\n// and Mute: usernames, see loadHiddenAuthors); on \"following\" only the people the viewer follows. At most NEW_POSTS_CAP are\n// counted. Not cached: it belongs to one viewer and the shared caches hold no personal data. Logged-in people only.\nexport async function countNewSocialItems(\n  viewerId: string,\n  kind: \"all\" | \"following\",\n  sinceMs: number,\n  hidden: ReadonlySet<string>,\n): Promise<number> {\n  const since = new Date(sinceMs);\n  const hiddenNames = [...hidden];\n\n  let authors: { in: string[] } | { not: string }; // fits both `authorId` (posts) and `userId` (reposts)\n  if (kind === \"following\") {\n    const followed = await prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true }, take: MAX_FOLLOWING_IDS });\n    // the viewer's own items never count, so the viewer is taken out of the list that `followingAuthorIds` builds\n    authors = { in: followingAuthorIds(viewerId, followed.map((row) => row.followingId)).filter((id) => id !== viewerId) };\n  } else {\n    authors = { not: viewerId };\n  }\n\n  const [posts, reposts] = await Promise.all([\n    prisma.socialPost.count({\n      where: {\n        AND: [\n          socialFeedWhere,\n          { createdAt: { gt: since } },\n          { authorId: authors },\n          { author: { username: { notIn: hiddenNames } } },\n        ],\n      },\n      take: NEW_POSTS_CAP,\n    }),\n    prisma.socialRepost.count({\n      where: {\n        AND: [\n          socialRepostWhere,\n          { createdAt: { gt: since } },\n          { userId: authors },\n          { user: { username: { notIn: hiddenNames } } },\n          { socialPost: { author: { username: { notIn: hiddenNames } } } },\n        ],\n      },\n      take: NEW_POSTS_CAP,\n    }),\n  ]);\n  return Math.min(posts + reposts, NEW_POSTS_CAP);\n}\n", "css": "\n/* \"n new posts\" banner (SOCIAL_TODO B4) */\n.sp-newposts { position: sticky; top: 8px; z-index: 5; display: flex; justify-content: center; }\n.sp-newposts:empty { display: none; }\n.sp-newposts .pc-btn { height: 44px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25); }\n", "i18n": {"en": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.one\": \"{n} new post\",\n  \"social.new.posts.other\": \"{n} new posts\",\n  \"social.new.overflow\": \"99+ new posts\",\n", "es": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.one\": \"{n} publicación nueva\",\n  \"social.new.posts.other\": \"{n} publicaciones nuevas\",\n  \"social.new.overflow\": \"Más de 99 publicaciones nuevas\",\n", "fr": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.one\": \"{n} nouvelle publication\",\n  \"social.new.posts.other\": \"{n} nouvelles publications\",\n  \"social.new.overflow\": \"Plus de 99 nouvelles publications\",\n", "zh": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.other\": \"{n} 条新动态\",\n  \"social.new.overflow\": \"99+ 条新动态\",\n", "hi": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.one\": \"{n} नई पोस्ट\",\n  \"social.new.posts.other\": \"{n} नई पोस्ट\",\n  \"social.new.overflow\": \"99+ नई पोस्ट\",\n", "ar": "  // \"n new posts\" banner (SOCIAL_TODO B4, patch-social-newposts)\n  \"social.new.posts.zero\": \"لا منشورات جديدة\",\n  \"social.new.posts.one\": \"منشور جديد واحد\",\n  \"social.new.posts.two\": \"منشوران جديدان\",\n  \"social.new.posts.few\": \"{n} منشورات جديدة\",\n  \"social.new.posts.many\": \"{n} منشورًا جديدًا\",\n  \"social.new.posts.other\": \"{n} منشور جديد\",\n  \"social.new.overflow\": \"أكثر من 99 منشورًا جديدًا\",\n"}, "entry": "- patch-social-newposts (SOCIAL_TODO B4: the \"n new posts\" banner): when the Social feed (`/social`) or the Following feed (`/social/following`) is open on its FIRST page, a small banner asks about once a minute (only while the tab is visible, and at once when you come back to the tab) how many Social posts and reposts are newer than the newest item the page shows. If there are some, a sticky button \"3 new posts\" (\"99+ new posts\" from 100) appears; the feed is NEVER changed by itself, only the button reloads the page (`router.refresh()`) and goes back to the top. Counted: the same visibility rules as the feeds; NOT the viewer's own posts and reposts; NOT blocked or muted people (same lists as the feeds); on Following only the people you follow. Browser part `SocialNewPostsBanner.tsx` (polite live region for screen readers), question `GET /api/social/new-count?feed=all|following&since=<ms>` (`api/social/new-count/route.ts`: login required, never cached, answers `{count, label}` with the label already in the person's language, 429 when asked too often), count in `queries.ts` (`countNewSocialItems`, at most 100 read), pure rules in `social-new-posts.ts`. Rate limit `socialLimits.newPosts` 12 per minute and 2000 per day per person, server memory (shared limiter: TODO 50). 4 new texts per language (`social.new.posts.*`, `social.new.overflow`; plural forms for en, es, fr, hi, zh and ar). NO DATABASE CHANGE. New test `npm run test:social-new-posts` (no database). Not done on purpose: Home feed and hashtag pages (Home also holds Community posts), updating the page title or the tab icon with the count, loading the new posts INTO the page without a reload, push notifications, a banner when you are on page 2 or later (\"Older posts\"), a banner on profile pages, counting edited posts, a setting to turn the banner off.\n"};
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

edit("web/src/lib/queries.ts", "countNewSocialItems", (s) => {
  if (s.includes("export async function countNewSocialItems")) return s;
  const anchor = 'import { afterCursorWhere, comparePageItems, cursorToText, cutPage, parseCursor } from "@/lib/social-paging";\n';
  need(s, anchor);
  s = s.replace(anchor, anchor + 'import { NEW_POSTS_CAP } from "@/lib/social-new-posts";\n');
  return s.replace(/\n*$/, "\n") + DATA.q_block;
});
edit("web/src/config/site.ts", "socialLimits.newPosts", (s) => {
  if (s.includes("newPosts: [")) return s;
  const start = s.indexOf("export const socialLimits = {");
  if (start < 0) throw new Error("socialLimits not found");
  const end = s.indexOf("\n};", start);
  if (end < 0) throw new Error("end of socialLimits not found");
  const add = "\n  newPosts: [\n    { max: 12, windowSeconds: 60 },\n    { max: 2000, windowSeconds: 24 * 60 * 60 },\n  ], // the \"n new posts\" banner asks about once a minute per open tab (SOCIAL_TODO B4), server memory";
  return s.slice(0, end) + add + s.slice(end);
});
edit("web/src/app/content.css", "banner styles", (s) => (s.includes(".sp-newposts") ? s : s.replace(/\n*$/, "\n") + DATA.css));
function page(path, feed, itemsName, before, showCondition) {
  edit(path, "banner", (s) => {
    if (s.includes("SocialNewPostsBanner")) return s;
    const tabs = 'import SocialFeedTabs from "@/components/social/SocialFeedTabs";\n';
    const paging = 'import { cursorToText, parseCursor } from "@/lib/social-paging";\n';
    need(s, tabs); need(s, paging); need(s, before);
    return s
      .replace(tabs, tabs + 'import SocialNewPostsBanner from "@/components/social/SocialNewPostsBanner";\n')
      .replace(paging, paging + 'import { newestMs } from "@/lib/social-new-posts";\n')
      .replace(before, `      {!cursor ? <SocialNewPostsBanner feed="${feed}" since={newestMs(${itemsName}, Date.now())} /> : null}\n\n` + before);
  });
}
page("web/src/app/(site)/social/page.tsx", "all", "page.items", "      {page.items.length === 0 && !cursor && !page.next ? (");
page("web/src/app/(site)/social/following/page.tsx", "following", "items", "      {items.length === 0 && !cursor && !next ? (");
edit("web/package.json", "test:social-new-posts", (s) => {
  if (s.includes("test:social-new-posts")) return s;
  const m = s.match(/^(\s*)"test:social-tags": "[^"]*",\n/m);
  if (!m) throw new Error('"test:social-tags" line not found');
  return s.replace(m[0], m[0] + m[1] + '"test:social-new-posts": "tsx scripts/test-social-new-posts.ts",\n');
});
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  edit(`web/src/i18n/messages/${lang}.ts`, "new-posts texts", (s) => {
    if (s.includes('"social.new.overflow"')) return s;
    const i = lang === "en" ? s.indexOf("} as const;") : s.lastIndexOf("};");
    if (i < 0) throw new Error("end of the texts not found");
    return s.slice(0, i) + DATA.i18n[lang] + s.slice(i);
  });
}
edit("CHANGELOG.md", "entry", (s) => {
  if (s.includes("patch-social-newposts")) return s;
  const m = s.match(/^## \d{4}-\d{2}-\d{2}\n/m);
  if (!m) throw new Error("no date heading found");
  return s.replace(m[0], m[0] + DATA.entry);
});
for (const f of ["web/src/lib/social-new-posts.ts", "web/src/app/api/social/new-count/route.ts", "web/src/components/social/SocialNewPostsBanner.tsx", "web/scripts/test-social-new-posts.ts"]) {
  if (!fs.existsSync(f)) { console.log("PROBLEM  new file missing: " + f + " (did you unzip patch-social-newposts.zip?)"); problems++; }
}
console.log(problems === 0 ? "\nAll done." : "\n" + problems + " problem(s). Send me the screen.");
process.exit(problems === 0 ? 0 : 1);
