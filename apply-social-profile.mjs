// patch-social-profile (SOCIAL_TODO 2: Social profile page /social/u/<username>).
// Needs patch-social-pagination installed first (it uses its cursor and page helpers).
// Run in the project folder (where PROJECT.md is):   node apply-social-profile.mjs
// It edits 13 existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
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

// 0. patch-social-pagination must be there
{
  const src = read(p("web/src/lib/social-paging.ts"));
  if (src === null) console.log("Install patch-social-pagination first.");
}

// 1. queries.ts: the reads for a profile (at the end of the file: they use the private selects and filters above)
appendOnce(
  p("web/src/lib/queries.ts"),
  `
// ---- Social profile (SOCIAL_TODO 2, patch-social-profile). Same visibility rules as the feeds. ONLY for logged-in
// people (PROJECT.md 8j point 11). Not cached: they are read per request and the pages hold the viewer's own state.

/** Replies, likes, followers and following lists show at most this many (the newest). Paging for them comes later. */
export const socialProfileListSize = 100;

export type SocialProfile = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  joinedIso: string;
  posts: number;
  followers: number;
  following: number;
};

/** The profile of an account whose posts may be shown (socialAuthorShown), or null (unknown, deleted, deletion pending). */
export async function getSocialProfile(username: string): Promise<SocialProfile | null> {
  const user = await prisma.user.findFirst({
    where: { AND: [{ username }, socialAuthorShown] },
    select: { id: true, username: true, displayName: true, bio: true, createdAt: true },
  });
  if (!user) return null;
  const [posts, followers, following] = await Promise.all([
    prisma.socialPost.count({ where: { AND: [socialFeedWhere, { authorId: user.id }] } }),
    prisma.follow.count({ where: { followingId: user.id, follower: socialAuthorShown } }),
    prisma.follow.count({ where: { followerId: user.id, following: socialAuthorShown } }),
  ]);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    joinedIso: user.createdAt.toISOString(),
    posts,
    followers,
    following,
  };
}

/** The Posts tab: the person's Social posts AND reposts, newest first, paged like the feeds (social-paging.ts). */
export async function getSocialProfileFeed(profileId: string, before: string | null = null): Promise<SocialFeedPage> {
  const cursor = parseCursor(before);
  const [rows, repostRows] = await Promise.all([
    prisma.socialPost.findMany({
      where: { AND: [socialFeedWhere, { authorId: profileId }, afterCursorWhere(cursor, 0)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_SIZE + 1,
      select: socialPostSelect,
    }),
    prisma.socialRepost.findMany({
      where: { AND: [socialRepostWhere, { userId: profileId }, afterCursorWhere(cursor, 1)] },
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
}

export type SocialProfileReply = { id: number; body: string; time: string; postId: number; postAuthor: string };

/** The Replies tab: the person's visible replies, newest first, only under posts that may be shown. */
export async function getSocialProfileReplies(profileId: string): Promise<SocialProfileReply[]> {
  const rows = await prisma.socialReply.findMany({
    where: { authorId: profileId, status: ContentStatus.VISIBLE, deletedAt: null, socialPost: socialFeedWhere },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: socialProfileListSize,
    select: {
      id: true,
      body: true,
      createdAt: true,
      socialPost: { select: { id: true, author: { select: { username: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    time: timeAgo(row.createdAt),
    postId: row.socialPost.id,
    postAuthor: row.socialPost.author.username,
  }));
}

/**
 * The Likes tab: the Social posts the person liked, the most recently liked first. The PAGE shows it only to the person
 * themselves (decision: nobody else can see which posts you liked); this function does not check who is asking.
 */
export async function getSocialProfileLikes(profileId: string): Promise<SocialFeedItem[]> {
  const rows = await prisma.socialPostLike.findMany({
    where: { userId: profileId, socialPost: socialFeedWhere },
    orderBy: [{ createdAt: "desc" }, { socialPostId: "desc" }],
    take: socialProfileListSize,
    select: { createdAt: true, socialPost: { select: socialPostSelect } },
  });
  return rows.map((row): SocialFeedItem => ({ kind: "post", createdAtMs: row.createdAt.getTime(), post: toSocialSummary(row.socialPost) }));
}

export type SocialPerson = { username: string; displayName: string | null };

/** The Followers / Following tab: accounts that may be shown, the most recent follow first. */
export async function getSocialProfilePeople(profileId: string, kind: "followers" | "following"): Promise<SocialPerson[]> {
  if (kind === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followingId: profileId, follower: socialAuthorShown },
      orderBy: [{ createdAt: "desc" }, { followerId: "desc" }],
      take: socialProfileListSize,
      select: { follower: { select: { username: true, displayName: true } } },
    });
    return rows.map((row) => row.follower);
  }
  const rows = await prisma.follow.findMany({
    where: { followerId: profileId, following: socialAuthorShown },
    orderBy: [{ createdAt: "desc" }, { followingId: "desc" }],
    take: socialProfileListSize,
    select: { following: { select: { username: true, displayName: true } } },
  });
  return rows.map((row) => row.following);
}
`,
  "export async function getSocialProfileFeed",
);

// 2. The name on a post card (and on a quote) is a link to the profile
replaceOnce(
  p("web/src/components/social/SocialPostCard.tsx"),
  `          <strong>{name}</strong>
          {" · @"}{post.author}
`,
  `          <strong><Link href={\`/social/u/\${post.author}\`} className="sp-nameLink">{name}</Link></strong>
          {" · @"}{post.author}
`,
  "sp-nameLink",
);
replaceOnce(
  p("web/src/components/social/SocialRepostCard.tsx"),
  `          <strong>{name}</strong>
          {" · @"}{item.reposter}
`,
  `          <strong><Link href={\`/social/u/\${item.reposter}\`} className="sp-nameLink">{name}</Link></strong>
          {" · @"}{item.reposter}
`,
  "sp-nameLink",
);

// 3. style
appendOnce(
  p("web/src/app/content.css"),
  `
/* Social profile (SOCIAL_TODO 2) */
.sp-nameLink { color: inherit; text-decoration: none; }
.sp-nameLink:hover, .sp-nameLink:focus-visible { text-decoration: underline; }
.sp-profileHead { display: flex; flex-direction: column; gap: 8px; }
.sp-profileTop { display: flex; align-items: center; gap: 16px; }
.sp-profileAvatar { width: 64px; height: 64px; font-size: 1.75rem; flex: none; }
.sp-bio { white-space: pre-line; overflow-wrap: anywhere; }
.sp-counts { display: flex; gap: 16px; flex-wrap: wrap; margin: 0; font-weight: 600; }
.sp-counts a { color: inherit; }
.sp-limit { margin: 8px 4px; }
.sp-people { padding: 4px 16px; }
.sp-peopleList { list-style: none; margin: 0; padding: 0; }
.sp-person { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.sp-person:last-child { border-bottom: 0; }
.sp-personName { flex: 1; min-width: 0; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
.sp-personName:hover { text-decoration: underline; }
`,
  ".sp-profileHead {",
);

// 4. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-profile"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-profile"] = "tsx scripts/test-social-profile.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 5. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-profile", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.profile.title"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
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
  "## 2026-11-07\n- patch-social-profile (SOCIAL_TODO 2 Profile page): new page `/social/u/<username>` (login only, noindex, plain title; a visitor sees the log-in message for any name; \"not found\" for an invalid, unknown, deleted or deletion-pending account, the same rule as the feeds). Header: initial-letter avatar, name, @username, bio, joined month, counts (posts, followers, following), Follow / Unfollow (not on your own profile). Tabs (`?tab=`): Posts (posts AND reposts, newest first, \"Older posts\" paging from patch-social-pagination), Replies (visible replies under posts that may be shown), Likes (ONLY for the person themselves: nobody else can see which posts you liked), Followers and Following (people whose accounts may be shown, Follow button on each). Replies, Likes and the two lists show the newest 100 (`socialProfileListSize`) with a note; paging for them is not done. The name on every Social post card and quote is now a link to the profile. Reads in `queries.ts` (`getSocialProfile`, `getSocialProfileFeed`, `getSocialProfileReplies`, `getSocialProfileLikes`, `getSocialProfilePeople`), rules in `social-profile.ts`, components `SocialProfileTabs.tsx`, `SocialPeopleList.tsx`. No database change. 22 new texts in six languages. New test `npm run test:social-profile` (no database). Not done on purpose: avatar and banner pictures (they need picture upload, SOCIAL_TODO 5), editing your bio / display name from the profile, a profile for people who are not logged in, private accounts, pinned post. The community profile `/u/<username>` (sample data) is unchanged.\n",
  "patch-social-profile (SOCIAL_TODO 2",
);
appendOnce(
  p("ACCOUNT_RULES.md"),
  `
### 3.13 Social profile (SOCIAL_TODO 2, decided 2026-11-08, PROVISIONAL)
- The Social profile (/social/u/<username>) is only for logged-in people, like every Social page. It shows the account's Social posts, reposts, replies, followers and following, for accounts whose posts may be shown (3.8). A deleted or deletion-pending account has no profile.
- Who follows whom is visible to every logged-in person. The Likes tab is visible only to the person themselves.
- Nothing new is stored. Account erasure and "Download my data" already cover posts, replies, likes and follows.
- Not decided yet: private accounts, who may see the follower lists, avatar and banner pictures.
`,
  "### 3.13 Social profile",
);

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
