// patch-social-pagination (SOCIAL_TODO 4 Feed pagination: "Older posts" on /social and /social/following).
// Run in the project folder (where PROJECT.md is):   node apply-social-pagination.mjs
// It edits 10 existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped. NO database change.
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

// 1. queries.ts: the two feeds read one page after a cursor and say where the next page starts
const queries = p("web/src/lib/queries.ts");
replaceOnce(
  queries,
  'import { followingAuthorIds, MAX_FOLLOWING_IDS } from "@/lib/social-following";\n',
  'import { followingAuthorIds, MAX_FOLLOWING_IDS } from "@/lib/social-following";\nimport { afterCursorWhere, comparePageItems, cursorToText, cutPage, parseCursor } from "@/lib/social-paging";\n',
  'from "@/lib/social-paging"',
);
replaceOnce(
  queries,
  `/** Newest first; at the same moment a post comes before a repost; then the higher id first. */
function newestFirst(a: SocialFeedItem, b: SocialFeedItem): number {
  const difference = b.createdAtMs - a.createdAtMs;
  if (difference !== 0) return difference;
  if (a.kind !== b.kind) return a.kind === "post" ? -1 : 1;
  const idA = a.kind === "repost" ? a.repostId : a.post.id;
  const idB = b.kind === "repost" ? b.repostId : b.post.id;
  return idB - idA;
}

const SOCIAL_FEED_SIZE = 50;
`,
  `const SOCIAL_FEED_SIZE = 50;

/** One page of a Social feed: the items, and the cursor of the next page (null = last page). See social-paging.ts. */
export type SocialFeedPage = { items: SocialFeedItem[]; next: string | null };

/** Newest first, cut to one page. \`items\` may hold up to SOCIAL_FEED_SIZE + 1 of each table; the extra one tells there is a next page. */
function toFeedPage(items: SocialFeedItem[]): SocialFeedPage {
  const keyed = items.map((item) => ({
    item,
    createdAtMs: item.createdAtMs,
    rank: (item.kind === "repost" ? 1 : 0) as 0 | 1,
    id: item.kind === "repost" ? item.repostId : item.post.id,
  }));
  keyed.sort(comparePageItems);
  const { items: kept, next } = cutPage(keyed, SOCIAL_FEED_SIZE);
  return { items: kept.map((entry) => entry.item), next: next ? cursorToText(next) : null };
}
`,
  "export type SocialFeedPage",
);
// getSocialFeed
replaceOnce(
  queries,
  `export async function getSocialFeed(): Promise<SocialFeedItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("social-posts");
`,
  `export async function getSocialFeed(before: string | null = null): Promise<SocialFeedPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag("social-posts");

  const cursor = parseCursor(before); // \`before\` is a cursor from the URL (the page passes it on in its clean form)
`,
  "getSocialFeed(before: string | null = null)",
);
replaceOnce(
  queries,
  `    prisma.socialPost.findMany({
      where: socialFeedWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE,
      select: socialPostSelect,
    }),
    prisma.socialRepost.findMany({
      where: socialRepostWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE,
      select: socialRepostSelect,
    }),
  ]);

  const items: SocialFeedItem[] = [
    ...rows.map((row): SocialFeedItem => ({ kind: "post", createdAtMs: row.createdAt.getTime(), post: toSocialSummary(row) })),
    ...repostRows.map(toRepostItem),
  ];
  return items.sort(newestFirst).slice(0, SOCIAL_FEED_SIZE);
}`,
  `    prisma.socialPost.findMany({
      where: { AND: [socialFeedWhere, afterCursorWhere(cursor, 0)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE + 1,
      select: socialPostSelect,
    }),
    prisma.socialRepost.findMany({
      where: { AND: [socialRepostWhere, afterCursorWhere(cursor, 1)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE + 1,
      select: socialRepostSelect,
    }),
  ]);

  const items: SocialFeedItem[] = [
    ...rows.map((row): SocialFeedItem => ({ kind: "post", createdAtMs: row.createdAt.getTime(), post: toSocialSummary(row) })),
    ...repostRows.map(toRepostItem),
  ];
  return toFeedPage(items);
}`,
  "return toFeedPage(items);\n}",
);
// getFollowingFeed
replaceOnce(
  queries,
  `export async function getFollowingFeed(
  viewerId: string,
): Promise<{ following: number; items: SocialFeedItem[] }> {
  const followed`,
  `export async function getFollowingFeed(
  viewerId: string,
  before: string | null = null,
): Promise<{ following: number; items: SocialFeedItem[]; next: string | null }> {
  const cursor = parseCursor(before);
  const followed`,
  "viewerId: string,\n  before: string | null = null,",
);
replaceOnce(
  queries,
  `    prisma.socialPost.findMany({
      where: { ...socialFeedWhere, authorId: { in: authorIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE,
      select: socialPostSelect,
    }),
    prisma.socialRepost.findMany({
      where: { ...socialRepostWhere, userId: { in: authorIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE,
      select: socialRepostSelect,
    }),
  ]);`,
  `    prisma.socialPost.findMany({
      where: { AND: [socialFeedWhere, { authorId: { in: authorIds } }, afterCursorWhere(cursor, 0)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE + 1,
      select: socialPostSelect,
    }),
    prisma.socialRepost.findMany({
      where: { AND: [socialRepostWhere, { userId: { in: authorIds } }, afterCursorWhere(cursor, 1)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE + 1,
      select: socialRepostSelect,
    }),
  ]);`,
  "{ userId: { in: authorIds } }, afterCursorWhere",
);
replaceOnce(
  queries,
  "  return { following: followed.length, items: items.sort(newestFirst).slice(0, SOCIAL_FEED_SIZE) };",
  "  return { following: followed.length, ...toFeedPage(items) };",
  "{ following: followed.length, ...toFeedPage(items) }",
);

// 2. the two pages
const feedPage = p("web/src/app/(site)/social/page.tsx");
replaceOnce(feedPage, 'import SocialFeedList from "@/components/social/SocialFeedList";\n', 'import SocialFeedList from "@/components/social/SocialFeedList";\nimport SocialFeedPager from "@/components/social/SocialFeedPager";\n', "SocialFeedPager");
replaceOnce(feedPage, 'import { getSessionUser } from "@/lib/session";\n', 'import { getSessionUser } from "@/lib/session";\nimport { cursorToText, parseCursor } from "@/lib/social-paging";\n', 'from "@/lib/social-paging"');
replaceOnce(
  feedPage,
  `export default async function SocialFeedPage() {
  await connection();
`,
  `export default async function SocialFeedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parseCursor(before); // anything that is not a cursor means the first page
`,
  "SocialFeedPage({ searchParams }",
);
replaceOnce(feedPage, "  const feed = await getSocialFeed();\n", "  const page = await getSocialFeed(cursor ? cursorToText(cursor) : null);\n", "const page = await getSocialFeed(");
replaceOnce(feedPage, "      {feed.length === 0 ? (", "      {page.items.length === 0 && !cursor ? (", "page.items.length === 0 && !cursor");
replaceOnce(
  feedPage,
  `      ) : (
        <SocialFeedList feed={feed} viewer={viewer} />
      )}`,
  `      ) : (
        <>
          <SocialFeedList feed={page.items} viewer={viewer} />
          <SocialFeedPager basePath="/social" next={page.next} isFirstPage={!cursor} />
        </>
      )}`,
  '<SocialFeedPager basePath="/social"',
);

const followingPage = p("web/src/app/(site)/social/following/page.tsx");
replaceOnce(followingPage, 'import SocialFeedList from "@/components/social/SocialFeedList";\n', 'import SocialFeedList from "@/components/social/SocialFeedList";\nimport SocialFeedPager from "@/components/social/SocialFeedPager";\n', "SocialFeedPager");
replaceOnce(followingPage, 'import { getSessionUser } from "@/lib/session";\n', 'import { getSessionUser } from "@/lib/session";\nimport { cursorToText, parseCursor } from "@/lib/social-paging";\n', 'from "@/lib/social-paging"');
replaceOnce(
  followingPage,
  `export default async function SocialFollowingPage() {
  await connection();
`,
  `export default async function SocialFollowingPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection();
  const { before } = await searchParams;
  const cursor = parseCursor(before); // anything that is not a cursor means the first page
`,
  "SocialFollowingPage({ searchParams }",
);
replaceOnce(followingPage, "  const { following, items } = await getFollowingFeed(viewer.id);\n", "  const { following, items, next } = await getFollowingFeed(viewer.id, cursor ? cursorToText(cursor) : null);\n", "const { following, items, next } = await");
replaceOnce(followingPage, "      {items.length === 0 ? (", "      {items.length === 0 && !cursor ? (", "items.length === 0 && !cursor");
replaceOnce(
  followingPage,
  `      ) : (
        <SocialFeedList feed={items} viewer={viewer} />
      )}`,
  `      ) : (
        <>
          <SocialFeedList feed={items} viewer={viewer} />
          <SocialFeedPager basePath="/social/following" next={next} isFirstPage={!cursor} />
        </>
      )}`,
  '<SocialFeedPager basePath="/social/following"',
);

// 3. a little style for the pager (next to the tabs)
appendOnce(
  p("web/src/app/content.css"),
  `
/* "Older posts" under a Social feed (SOCIAL_TODO 4) */
.sp-pager { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: center; padding: 16px; }
.sp-pager .pc-text { margin: 0; }
`,
  ".sp-pager {",
);

// 4. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-paging"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-paging"] = "tsx scripts/test-social-paging.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 5. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-pagination", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.feed.older"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 6. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-07\n",
  "## 2026-11-07\n- patch-social-pagination (SOCIAL_TODO 4 Feed pagination): `/social` and `/social/following` show 50 items per page and an \"Older posts\" link (plain link, `?before=<cursor>`), \"Back to the newest posts\" on later pages, and an end message on the last page. The cursor is the LAST item shown (`<time in ms>.<0 post | 1 repost>.<id>`) and the next page is everything strictly after it in the feed order (newest first; a post before a repost at the same moment; then the higher id first), so nothing is skipped or shown twice even when items share the same time. A cursor in the URL that is not exactly digits and dots is ignored (first page). The rules are in `src/lib/social-paging.ts`, the pager is `SocialFeedPager.tsx`; `getSocialFeed(before)` and `getFollowingFeed(viewerId, before)` now return the cursor of the next page (`next`). No database change, no new setting. 4 new texts in six languages. New test `npm run test:social-paging` (no database). Not done: Home (`/`) still shows only its newest 50 mixed items; \"New posts\" banner (SOCIAL_TODO B4); infinite scroll (plain links on purpose: no script, works with the keyboard and screen readers).\n",
  "patch-social-pagination (SOCIAL_TODO 4",
);

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
