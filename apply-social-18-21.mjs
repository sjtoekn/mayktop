// patch-social-18-21 (SOCIAL_TODO 18 Replies + 21 Notifications page).
// Run in the project folder (where PROJECT.md is):   node apply-social-18-21.mjs
// It edits 16 existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped.
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

// 1. Database model (then: ./node_modules/.bin/prisma migrate dev --name social_replies, inside web/)
const schema = p("web/prisma/schema.prisma");
replaceOnce(schema, "  socialPostLikes     SocialPostLike[]\n", "  socialPostLikes     SocialPostLike[]\n  socialReplies       SocialReply[]\n", "  socialReplies       SocialReply[]");
replaceOnce(schema, "  reposts SocialRepost[]\n", "  reposts SocialRepost[]\n  replies SocialReply[]\n", "  replies SocialReply[]");
appendOnce(schema, `
// A reply under a Social post (SOCIAL_TODO 18): a flat list under the post, oldest first. Same rules as a post: deleting
// erases the text and sets deletedAt (the row stays); \`status\` is for moderation (SOCIAL_TODO 27, next step).
model SocialReply {
  id           Int           @id @default(autoincrement())
  socialPostId Int
  authorId     String
  body         String
  status       ContentStatus @default(VISIBLE)
  createdAt    DateTime      @default(now())
  deletedAt    DateTime?

  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)
  author     User       @relation(fields: [authorId], references: [id], onDelete: Restrict)

  @@index([socialPostId, createdAt])
  @@index([authorId, createdAt])
}
`, "model SocialReply {");

// 2. Numbers for replies (end of src/config/site.ts)
appendOnce(p("web/src/config/site.ts"), `
// Replies to a Social post (SOCIAL_TODO 18). PROVISIONAL numbers. The rate limit is counted from the database.
export const socialReplyConfig = {
  maxBody: 1000, // characters in one reply (a post can have 5,000)
  listSize: 200, // replies shown under one post
  limits: [
    { max: 10, windowMinutes: 10 },
    { max: 100, windowMinutes: 24 * 60 },
  ], // replies per person
};
`, "socialReplyConfig");

// 3. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-reply"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-reply"] = "tsx scripts/test-social-reply.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 4. Reply counts in the feeds (queries.ts) and the time helper
const queries = p("web/src/lib/queries.ts");
replaceOnce(queries, "function timeAgo(date: Date): string {", "export function timeAgo(date: Date): string {", "export function timeAgo");
replaceOnce(queries, "  reposts: number;\n  edited?: true;\n};", "  reposts: number;\n  replies: number;\n  edited?: true;\n};", "  replies: number;\n  edited?: true;");
replaceOnce(queries, "      likes: true,\n      reposts: true,\n", "      likes: true,\n      reposts: true,\n      replies: { where: { status: ContentStatus.VISIBLE, deletedAt: null } },\n", "replies: { where: { status: ContentStatus.VISIBLE");
replaceOnce(queries, "    reposts: row._count.reposts,\n", "    reposts: row._count.reposts,\n    replies: row._count.replies,\n", "replies: row._count.replies");

// 5. Account erasure and "download my data" know about replies
const purge = p("web/src/lib/purge-social.ts");
replaceOnce(purge, "export type SocialErased = { posts: number; reposts: number; follows: number; notifications: number };", "export type SocialErased = { posts: number; replies: number; reposts: number; follows: number; notifications: number };", "replies: number; reposts: number");
replaceOnce(purge, "  const reposts = await db.socialRepost.updateMany({", "  const replies = await db.socialReply.updateMany({\n    where: { authorId: userId, deletedAt: null },\n    data: { body: \"\", deletedAt: now },\n  });\n  const reposts = await db.socialRepost.updateMany({", "db.socialReply.updateMany");
replaceOnce(purge, "  return { posts: posts.count, reposts: reposts.count,", "  return { posts: posts.count, replies: replies.count, reposts: reposts.count,", "replies: replies.count");
const exp = p("web/src/lib/export-social.ts");
replaceOnce(exp, "const [posts, likes, reposts, following, followersCount, notifications] = await Promise.all([", "const [posts, likes, reposts, following, followersCount, notifications, replies] = await Promise.all([", "notifications, replies]");
replaceOnce(
  exp,
  "actor: { select: { username: true } } },\n    }),\n  ]);",
  "actor: { select: { username: true } } },\n    }),\n    db.socialReply.findMany({\n      where: { authorId: userId },\n      orderBy: { id: \"asc\" },\n      select: { id: true, socialPostId: true, body: true, status: true, createdAt: true, deletedAt: true },\n    }),\n  ]);",
  "db.socialReply.findMany",
);
replaceOnce(exp, "    notifications: notifications.map(", "    replies,\n    notifications: notifications.map(", "    replies,\n    notifications:");

// 5b. The old erasure test counts what the erasure changed: it must know about replies too
const purgeTest = p("web/scripts/test-purge-social.ts");
replaceOnce(
  purgeTest,
  "      await tx.follow.create({ data: { followerId: gone.id, followingId: other.id } });\n",
  "      await tx.socialReply.create({ data: { socialPostId: theirs.id, authorId: gone.id, body: \"my reply\" } });\n      await tx.follow.create({ data: { followerId: gone.id, followingId: other.id } });\n",
  "body: \"my reply\"",
);
replaceOnce(purgeTest, "{ posts: 2, reposts: 1, follows: 2, notifications: 2 }", "{ posts: 2, replies: 1, reposts: 1, follows: 2, notifications: 2 }", "posts: 2, replies: 1");
replaceOnce(purgeTest, "{ posts: 0, reposts: 0, follows: 0, notifications: 0 }", "{ posts: 0, replies: 0, reposts: 0, follows: 0, notifications: 0 }", "posts: 0, replies: 0");
replaceOnce(
  purgeTest,
  "      assert.equal((await tx.socialRepost.findFirstOrThrow({ where: { userId: gone.id } })).quoteText, null);\n",
  "      assert.equal((await tx.socialReply.findFirstOrThrow({ where: { authorId: gone.id } })).body, \"\"); // the reply text is erased, the row stays\n      assert.equal((await tx.socialRepost.findFirstOrThrow({ where: { userId: gone.id } })).quoteText, null);\n",
  "socialReply.findFirstOrThrow",
);

// 6. The bell in the menu: a real link, with the unread number
replaceOnce(p("web/src/components/shell/Shell.tsx"), '{ icon: "bell", label: t("nav.notifications"), href: "/", disabled: true },', '{ icon: "bell", label: t("nav.notifications"), href: "/notifications" },', 'href: "/notifications" }');
const sidebar = p("web/src/components/shell/Sidebar.tsx");
replaceOnce(sidebar, 'import Icon from "./Icon";\n', 'import Icon from "./Icon";\nimport NotificationBadge from "./NotificationBadge";\n', "NotificationBadge from");
replaceOnce(sidebar, '            {n.badge ? <b className="ch-badge">{n.badge}</b> : null}\n', '            {n.href === "/notifications" ? <NotificationBadge /> : n.badge ? <b className="ch-badge">{n.badge}</b> : null}\n', "<NotificationBadge />");

// 7. Reply count (a link to the replies) on the Social post card
replaceOnce(
  p("web/src/components/social/SocialPostCard.tsx"),
  "          <SocialShareButton\n",
  '          <Link href={`/social/${post.id}#replies`} className="pc-pill" aria-label={t("social.reply.label")}>\n            💬 {post.replies}\n          </Link>\n          <SocialShareButton\n',
  "#replies",
);

// 8. Replies on the post page
const page = p("web/src/app/(site)/social/[id]/page.tsx");
replaceOnce(page, 'import { parseSocialPostId } from "@/lib/social-id";\n', 'import { parseSocialPostId } from "@/lib/social-id";\nimport { getSocialReplies } from "@/lib/social-replies-query";\nimport SocialReplyList from "@/components/social/SocialReplyList";\n', "getSocialReplies");
replaceOnce(page, "  const quotes = await getSocialQuotes(post.id);\n", "  const quotes = await getSocialQuotes(post.id);\n  // Replies (SOCIAL_TODO 18): the post is already known to be shown, so the list is safe to read.\n  const replies = await getSocialReplies(post.id);\n", "await getSocialReplies");
replaceOnce(page, "      {quotes.length > 0 && (\n", "      <SocialReplyList postId={post.id} replies={replies} viewer={viewer.username} />\n\n      {quotes.length > 0 && (\n", "<SocialReplyList");

// 9. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-18-21", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"notifications.markAll"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 10. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-07\n",
  "## 2026-11-07\n- patch-social-18-21 (SOCIAL_TODO 18 Replies + 21 Notifications page): REPLIES under a Social post (`/social/<id>`, flat list, oldest first, up to 1,000 characters, `socialReplyConfig`; rate limit 10 per 10 minutes and 100 per day counted from the database): `SocialReplyForm.tsx`, `SocialReplyList.tsx`, `SocialReplyDelete.tsx`, server actions `createSocialReply` / `deleteSocialReply` in `social/reply/actions.ts`, rules in `social-reply.ts` (a post that may be shown only; own post allowed; the post's author gets a `SOCIAL_POST_REPLY` notification, but only ONE unread one per person per post; deleting your own reply erases the text and keeps the row), list query `social-replies-query.ts`. Every Social post card shows the reply count as a link. NOTIFICATIONS: new page `/notifications` (login only, newest first, unread marked, \"Mark all as read\"), the bell in the left menu is now a real link with the unread number (`NotificationBadge.tsx` asks `/notifications/count`), logic in `social-notifications.ts`. Notifications about a post that is no longer shown (deleted, hidden, removed), or from an account that is not shown, are not listed (the row stays; it comes back if the post is restored). DATABASE CHANGE: new table `SocialReply` (+ relations): run `./node_modules/.bin/prisma migrate dev --name social_replies` inside web/. Account erasure (`purge-social.ts`) now erases the text of a person's replies, and \"Download my data\" (`export-social.ts`) includes their replies. 24 new texts in six languages. New test `npm run test:social-reply` (no database). Not done on purpose: replies to replies, hiding / removing / reporting a reply (SOCIAL_TODO 27 / 30 for replies, the `status` column is ready), a notification marked read by opening it (only \"Mark all as read\"), notifications about community posts and comments. SOCIAL_TODO 18 and 21 are ticked once lint, build, the test and the manual check pass on your machine.\n",
  "patch-social-18-21 (SOCIAL_TODO 18",
);
appendOnce(p("ACCOUNT_RULES.md"), `
### 3.12 Replies and notifications (SOCIAL_TODO 18 + 21, decided 2026-11-08, PROVISIONAL)
- Anyone logged in can reply to a Social post that is shown (also their own). A reply is a flat list under the post, oldest first. Only the author of a reply can delete it, only while it is visible; the text is erased, the row stays.
- A person who replies is rate limited (10 per 10 minutes, 100 per day). The author of the post is notified once per replier until they have read it.
- Account erasure erases the text of the person's replies (the rows stay, anonymous). "Download my data" includes the person's own replies.
- A notification about a post that is no longer shown is not listed, and comes back if the post is restored. Notifications of an erased account are deleted (purge-social.ts).
- Not decided yet: replies to replies, hiding / removing / reporting a reply (3.11 will be extended), notification settings.
`, "### 3.12 Replies and notifications");

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s). Fix them (or send the message above) and run again; finished edits are skipped.`);
process.exit(problems === 0 ? 0 : 1);
