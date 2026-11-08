// patch-social-bookmark (SOCIAL_TODO B2: Bookmarks in Social).
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-bookmark.mjs
// It edits existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped. DATABASE CHANGE: 1 new table (the migration folder is part of the patch).
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

// 0. The new files must be there (they come in the zip)
for (const f of [
  "web/src/lib/social-bookmark-rules.ts",
  "web/src/lib/social-bookmark.ts",
  "web/src/lib/social-bookmark-view.ts",
  "web/src/app/(site)/social/bookmark/actions.ts",
  "web/src/app/(site)/social/bookmarks/page.tsx",
  "web/src/components/social/SocialBookmarkButton.tsx",
  "web/prisma/migrations/20261112090000_social_bookmarks/migration.sql",
  "web/scripts/test-social-bookmark.ts",
  "docs-social-bookmark/changelog.txt",
  "docs-social-bookmark/account-rules.txt",
  "docs-social-bookmark/queries-append.txt",
  "docs-social-bookmark/css-append.txt",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (unzip the patch first): " + f); problems++; }
}

// 1. Database: one table (the migration SQL is in the zip: do NOT make a new one with --name)
{
  const schema = p("web/prisma/schema.prisma");
  replaceOnce(
    schema,
    `  socialBlocksMade    SocialBlock[]   @relation("SocialBlocker")\n`,
    `  socialBlocksMade    SocialBlock[]   @relation("SocialBlocker")\n  socialBookmarks     SocialPostBookmark[]\n`,
    "socialBookmarks     SocialPostBookmark[]",
  );
  replaceOnce(
    schema,
    `  tags    SocialPostTag[]\n  mentions SocialMention[]\n`,
    `  tags    SocialPostTag[]\n  mentions SocialMention[]\n  bookmarks SocialPostBookmark[]\n`,
    "bookmarks SocialPostBookmark[]",
  );
  appendOnce(
    schema,
    `\n// ---------------------------------------------------------------- Social Bookmarks (SOCIAL_TODO B2)\n\n// A person saved a Social post for later. PRIVATE to that person (ACCOUNT_RULES.md 3.17): never counted for anybody else.\nmodel SocialPostBookmark {\n  userId       String\n  socialPostId Int\n  createdAt    DateTime @default(now())\n\n  user       User       @relation(fields: [userId], references: [id], onDelete: Restrict)\n  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)\n\n  @@id([userId, socialPostId])\n  @@index([userId, createdAt])\n  @@index([socialPostId])\n}\n`,
    "model SocialPostBookmark",
  );
}

// 2. Limits (config)
replaceOnce(
  p("web/src/config/site.ts"),
  `  deletes: { max: 20, windowMinutes: 10 },`,
  `  bookmarks: [\n    { max: 60, windowSeconds: 60 },\n    { max: 600, windowSeconds: 24 * 60 * 60 },\n  ], // save / remove a bookmark (SOCIAL_TODO B2), counted in server memory\n  maxBookmarks: 2000, // bookmarks one person may keep; when full, saving another is refused (removing always works)\n  deletes: { max: 20, windowMinutes: 10 },`,
  "maxBookmarks: 2000",
);

// 3. The Bookmarks list query (queries.ts)
{
  const q = p("web/src/lib/queries.ts");
  replaceOnce(
    q,
    `import { afterCursorWhere, comparePageItems, cursorToText, cutPage, parseCursor } from "@/lib/social-paging";\n`,
    `import { afterCursorWhere, comparePageItems, cursorToText, cutPage, parseCursor } from "@/lib/social-paging";\nimport { bookmarkAfterWhere, bookmarkCursorToText, cutBookmarkPage, parseBookmarkCursor } from "@/lib/social-bookmark-rules";\n`,
    `from "@/lib/social-bookmark-rules";`,
  );
  appendOnce(q, fs.readFileSync(p("docs-social-bookmark/queries-append.txt"), "utf8"), "export async function getSocialBookmarks");
}

// 4. The Save button on the cards
{
  const card = p("web/src/components/social/SocialPostCard.tsx");
  replaceOnce(
    card,
    `import SocialLikeButton from "@/components/social/SocialLikeButton";\n`,
    `import SocialLikeButton from "@/components/social/SocialLikeButton";\nimport SocialBookmarkButton from "@/components/social/SocialBookmarkButton";\n`,
    `import SocialBookmarkButton from`,
  );
  replaceOnce(card, `  isReposted = false,\n}: {`, `  isReposted = false,\n  isBookmarked = false,\n}: {`, `isBookmarked = false,`);
  replaceOnce(
    card,
    `  isReposted?: boolean;\n}) {`,
    `  isReposted?: boolean;\n  /** Has the logged-in person saved this post? (getMySocialBookmarks) Private: no count is shown. */\n  isBookmarked?: boolean;\n}) {`,
    `isBookmarked?: boolean;`,
  );
  replaceOnce(
    card,
    `          {canFollow && (\n            <SocialFollowButton`,
    `          {Boolean(viewer) && (\n            <SocialBookmarkButton\n              postId={post.id}\n              initialBookmarked={isBookmarked}\n              text={{\n                save: t("social.bookmark.save"),\n                saved: t("social.bookmark.saved"),\n                saveTitle: t("social.bookmark.save.title"),\n                savedTitle: t("social.bookmark.saved.title"),\n                login: t("social.bookmark.login"),\n                tooMany: t("social.bookmark.toomany"),\n                full: t("social.bookmark.full"),\n                error: t("social.bookmark.error"),\n              }}\n            />\n          )}\n          {canFollow && (\n            <SocialFollowButton`,
    `<SocialBookmarkButton\n              postId`,
  );

  const rep = p("web/src/components/social/SocialRepostCard.tsx");
  replaceOnce(rep, `  isReposted = false,\n  viewer = null,`, `  isReposted = false,\n  isBookmarked = false,\n  viewer = null,`, `isBookmarked = false,`);
  replaceOnce(rep, `  isReposted?: boolean;\n  viewer?: string | null;`, `  isReposted?: boolean;\n  isBookmarked?: boolean;\n  viewer?: string | null;`, `isBookmarked?: boolean;`);
  replaceOnce(
    rep,
    `<SocialPostCard post={original} isLiked={isLiked} isReposted={isReposted} viewer={viewer} isFollowing={isFollowing} />`,
    `<SocialPostCard post={original} isLiked={isLiked} isReposted={isReposted} isBookmarked={isBookmarked} viewer={viewer} isFollowing={isFollowing} />`,
    `isBookmarked={isBookmarked} viewer={viewer}`,
  );
}

// 5. Every page that shows cards asks (per request, never cached) which posts the person saved
{
  const list = p("web/src/components/social/SocialFeedList.tsx");
  replaceOnce(
    list,
    `import { getMyFollowing, getMySocialLikes, getMySocialReposts, type SocialFeedItem } from "@/lib/queries";\n`,
    `import { getMyFollowing, getMySocialLikes, getMySocialReposts, type SocialFeedItem } from "@/lib/queries";\nimport { getMySocialBookmarks } from "@/lib/social-bookmark-view";\n`,
    `import { getMySocialBookmarks }`,
  );
  replaceOnce(
    list,
    `  const repostedIds = new Set(await getMySocialReposts(viewer.id, posts.map((post) => post.id)));\n`,
    `  const repostedIds = new Set(await getMySocialReposts(viewer.id, posts.map((post) => post.id)));\n  const bookmarkedIds = new Set(await getMySocialBookmarks(viewer.id, posts.map((post) => post.id))); // private (SOCIAL_TODO B2)\n`,
    `const bookmarkedIds = new Set(`,
  );
  replaceOnce(
    list,
    `            key={\`repost-\${item.repostId}\`}\n            item={item}\n`,
    `            key={\`repost-\${item.repostId}\`}\n            item={item}\n            isBookmarked={bookmarkedIds.has(item.post.id)}\n`,
    `isBookmarked={bookmarkedIds.has(item.post.id)}\n            isLiked`,
  );
  replaceOnce(
    list,
    `            key={\`post-\${item.post.id}\`}\n            post={item.post}\n`,
    `            key={\`post-\${item.post.id}\`}\n            post={item.post}\n            isBookmarked={bookmarkedIds.has(item.post.id)}\n`,
    `post={item.post}\n            isBookmarked=`,
  );

  const post = p("web/src/app/(site)/social/[id]/page.tsx");
  replaceOnce(
    post,
    `import { dropHiddenAuthors, dropHiddenItems } from "@/lib/social-block-rules";\n`,
    `import { dropHiddenAuthors, dropHiddenItems } from "@/lib/social-block-rules";\nimport { getMySocialBookmarks } from "@/lib/social-bookmark-view";\n`,
    `import { getMySocialBookmarks }`,
  );
  replaceOnce(
    post,
    `  const reposted = (await getMySocialReposts(viewer.id, [post.id])).includes(post.id);\n`,
    `  const reposted = (await getMySocialReposts(viewer.id, [post.id])).includes(post.id);\n  const bookmarked = (await getMySocialBookmarks(viewer.id, [post.id])).includes(post.id);\n`,
    `const bookmarked = (await getMySocialBookmarks`,
  );
  replaceOnce(
    post,
    `        isReposted={reposted}\n        permalink={false}`,
    `        isReposted={reposted}\n        isBookmarked={bookmarked}\n        permalink={false}`,
    `isBookmarked={bookmarked}`,
  );

  const home = p("web/src/app/(site)/page.tsx");
  replaceOnce(
    home,
    `import { dropHiddenItems } from "@/lib/social-block-rules";\n`,
    `import { dropHiddenItems } from "@/lib/social-block-rules";\nimport { getMySocialBookmarks } from "@/lib/social-bookmark-view";\n`,
    `import { getMySocialBookmarks }`,
  );
  replaceOnce(
    home,
    `  const repostedIds = new Set(await getMySocialReposts(viewer?.id, socialPostIds));\n`,
    `  const repostedIds = new Set(await getMySocialReposts(viewer?.id, socialPostIds));\n  // And "did I save these" (SOCIAL_TODO B2): private, this viewer only, never cached.\n  const bookmarkedIds = new Set(await getMySocialBookmarks(viewer?.id, socialPostIds));\n`,
    `const bookmarkedIds = new Set(`,
  );
  replaceOnce(
    home,
    `              ? <SocialRepostCard\n                  item={item}\n`,
    `              ? <SocialRepostCard\n                  item={item}\n                  isBookmarked={bookmarkedIds.has(item.post.id)}\n`,
    `item={item}\n                  isBookmarked=`,
  );
  replaceOnce(
    home,
    `              : <SocialPostCard\n                  post={item.post}\n`,
    `              : <SocialPostCard\n                  post={item.post}\n                  isBookmarked={bookmarkedIds.has(item.post.id)}\n`,
    `post={item.post}\n                  isBookmarked=`,
  );
}

// 6. A "Bookmarks" tab next to All and Following
{
  const tabs = p("web/src/components/social/SocialFeedTabs.tsx");
  replaceOnce(tabs, `active: "all" | "following" }`, `active: "all" | "following" | "bookmarks" }`, `"following" | "bookmarks"`);
  replaceOnce(
    tabs,
    `      </Link>\n    </nav>`,
    `      </Link>\n      <Link href="/social/bookmarks" className={\`sp-tab\${active === "bookmarks" ? " is-active" : ""}\`} aria-current={active === "bookmarks" ? "page" : undefined}>\n        {t("social.tabs.bookmarks")}\n      </Link>\n    </nav>`,
    `href="/social/bookmarks"`,
  );
}

// 7. Final erasure and "Download my data"
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `import { eraseSocialBlocks } from "./social-block";\n`,
  `import { eraseSocialBlocks } from "./social-block";\nimport { eraseSocialBookmarks } from "./social-bookmark";\n`,
  `import { eraseSocialBookmarks } from "./social-bookmark";`,
);
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `  await eraseSocialBlocks(db, userId); // blocks and mutes made or received (SOCIAL_TODO A7)\n`,
  `  await eraseSocialBlocks(db, userId); // blocks and mutes made or received (SOCIAL_TODO A7)\n  await eraseSocialBookmarks(db, userId); // bookmarks made, and bookmarks of the person's posts (SOCIAL_TODO B2)\n`,
  `await eraseSocialBookmarks(db, userId);`,
);
{
  const exp = p("web/src/lib/export-social.ts");
  replaceOnce(exp, `notifications, replies, blocks, mutes] = await Promise.all([`, `notifications, replies, blocks, mutes, bookmarks] = await Promise.all([`, `blocks, mutes, bookmarks]`);
  replaceOnce(
    exp,
    `      select: { createdAt: true, muted: { select: { username: true } } },\n    }),\n  ]);`,
    `      select: { createdAt: true, muted: { select: { username: true } } },\n    }),\n    // Bookmarks (SOCIAL_TODO B2): only the post numbers the person saved, and when. Never who saved THEIR posts.\n    db.socialPostBookmark.findMany({\n      where: { userId },\n      orderBy: { createdAt: "asc" },\n      select: { socialPostId: true, createdAt: true },\n    }),\n  ]);`,
    `db.socialPostBookmark.findMany({`,
  );
  replaceOnce(
    exp,
    `    muted: mutes.map((m) => ({ username: m.muted.username, since: m.createdAt })),\n`,
    `    muted: mutes.map((m) => ({ username: m.muted.username, since: m.createdAt })),\n    bookmarks: bookmarks.map((b) => ({ socialPostId: b.socialPostId, since: b.createdAt })),\n`,
    `bookmarks: bookmarks.map(`,
  );
}

// 8. Style
appendOnce(p("web/src/app/content.css"), fs.readFileSync(p("docs-social-bookmark/css-append.txt"), "utf8"), ".sp-bookmarkButton {");

// 9. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-bookmark"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-bookmark"] = "tsx scripts/test-social-bookmark.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 10. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-bookmark", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.bookmark.save"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 11. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-08\n",
  "## 2026-11-08\n" + fs.readFileSync(p("docs-social-bookmark/changelog.txt"), "utf8").trimEnd() + "\n",
  "patch-social-bookmark (SOCIAL_TODO B2",
);
appendOnce(p("ACCOUNT_RULES.md"), fs.readFileSync(p("docs-social-bookmark/account-rules.txt"), "utf8"), "### 3.17 Bookmarks");

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
