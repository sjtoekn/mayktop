// patch-social-block (SOCIAL_TODO A7: Block and Mute in Social).
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-block.mjs
// It edits existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped. DATABASE CHANGE: 2 new tables (the migration folder is part of the patch).
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
  "web/src/lib/social-block-rules.ts",
  "web/src/lib/social-block.ts",
  "web/src/lib/social-block-view.ts",
  "web/src/app/(site)/social/block/actions.ts",
  "web/src/components/social/SocialBlockButtons.tsx",
  "web/src/components/social/socialBlockProps.ts",
  "web/prisma/migrations/20261111090000_social_block/migration.sql",
  "web/scripts/test-social-block.ts",
  "docs-social-block/changelog.txt",
  "docs-social-block/account-rules.txt",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (unzip the patch first): " + f); problems++; }
}

// 1. Database: two tables (the migration SQL is in the zip: do NOT make a new one with --name)
{
  const schema = p("web/prisma/schema.prisma");
  replaceOnce(
    schema,
    `  socialMentions      SocialMention[]\n`,
    `  socialMentions      SocialMention[]\n  socialBlocksMade    SocialBlock[]   @relation("SocialBlocker")\n  socialBlocksGot     SocialBlock[]   @relation("SocialBlocked")\n  socialMutesMade     SocialMute[]    @relation("SocialMuter")\n  socialMutesGot      SocialMute[]    @relation("SocialMuted")\n`,
    "socialBlocksMade",
  );
  appendOnce(
    schema,
    `\n// ---------------------------------------------------------------- Social Block and Mute (SOCIAL_TODO A7)\n\n// A blocks B: one row. The meaning is in src/lib/social-block-rules.ts and ACCOUNT_RULES.md 3.16.\nmodel SocialBlock {\n  blockerId String\n  blockedId String\n  createdAt DateTime @default(now())\n\n  blocker User @relation("SocialBlocker", fields: [blockerId], references: [id], onDelete: Restrict)\n  blocked User @relation("SocialBlocked", fields: [blockedId], references: [id], onDelete: Restrict)\n\n  @@id([blockerId, blockedId])\n  @@index([blockedId])\n}\n\n// A mutes B: one row. Private to the muter.\nmodel SocialMute {\n  muterId   String\n  mutedId   String\n  createdAt DateTime @default(now())\n\n  muter User @relation("SocialMuter", fields: [muterId], references: [id], onDelete: Restrict)\n  muted User @relation("SocialMuted", fields: [mutedId], references: [id], onDelete: Restrict)\n\n  @@id([muterId, mutedId])\n  @@index([mutedId])\n}\n`,
    "model SocialBlock",
  );
}

// 2. Limits for Block / Mute (config)
replaceOnce(
  p("web/src/config/site.ts"),
  `  likes: { max: 40, windowSeconds: 60 },\n`,
  `  likes: { max: 40, windowSeconds: 60 },\n  blocks: [\n    { max: 30, windowSeconds: 60 },\n    { max: 300, windowSeconds: 24 * 60 * 60 },\n  ], // block / unblock / mute / unmute together (SOCIAL_TODO A7), counted in server memory\n`,
  "blocks: [",
);

// 3. Write paths: a blocked pair cannot follow, like, repost, quote, reply or mention
{
  const follow = p("web/src/lib/social-follow.ts");
  replaceOnce(
    follow,
    `import { isSocialAuthorShown } from "@/lib/social-visibility";\n`,
    `import { isSocialAuthorShown } from "@/lib/social-visibility";\nimport { isBlockedEitherWay } from "@/lib/social-block";\n`,
    `import { isBlockedEitherWay } from "@/lib/social-block";`,
  );
  replaceOnce(
    follow,
    `      if (!isSocialAuthorShown(target)) return { ok: false, reason: "notfound" };\n      await db.follow.create(`,
    `      if (!isSocialAuthorShown(target)) return { ok: false, reason: "notfound" };\n      // Block (SOCIAL_TODO A7): either person blocked the other. The same "not found", it never says why.\n      if (await isBlockedEitherWay(db, input.followerId, target.id)) return { ok: false, reason: "notfound" };\n      await db.follow.create(`,
    "Block (SOCIAL_TODO A7): either person blocked the other.",
  );

  const like = p("web/src/app/(site)/social/like/actions.ts");
  replaceOnce(
    like,
    `import { socialAuthorShown } from "@/lib/social-visibility";\n`,
    `import { socialAuthorShown } from "@/lib/social-visibility";\nimport { isBlockedEitherWay } from "@/lib/social-block";\n`,
    `import { isBlockedEitherWay } from "@/lib/social-block";`,
  );
  replaceOnce(
    like,
    `      if (!post) return null;\n\n      const key = {`,
    `      if (!post) return null;\n\n      // Block (SOCIAL_TODO A7): liking needs that neither person blocked the other. Unlike is always allowed.\n      if (desiredLiked && (await isBlockedEitherWay(tx, viewer.id, post.authorId))) return null;\n\n      const key = {`,
    "Block (SOCIAL_TODO A7): liking needs",
  );

  const repost = p("web/src/lib/social-repost.ts");
  replaceOnce(
    repost,
    `import { cleanSocialBody } from "@/lib/social-input";\n`,
    `import { cleanSocialBody } from "@/lib/social-input";\nimport { isBlockedEitherWay } from "@/lib/social-block";\n`,
    `import { isBlockedEitherWay } from "@/lib/social-block";`,
  );
  replaceOnce(
    repost,
    `      if (!existing) {\n        await db.socialRepost.create(`,
    `      // Block (SOCIAL_TODO A7): neither person may have blocked the other (repost and quote). Undo is always allowed.\n      if (await isBlockedEitherWay(db, input.userId, post.authorId)) return { ok: false, reason: "notfound" };\n\n      if (!existing) {\n        await db.socialRepost.create(`,
    "Block (SOCIAL_TODO A7): neither person may have blocked",
  );

  const reply = p("web/src/lib/social-reply.ts");
  replaceOnce(
    reply,
    `import { isSocialAuthorShown } from "@/lib/social-visibility";\n`,
    `import { isSocialAuthorShown } from "@/lib/social-visibility";\nimport { isBlockedEitherWay } from "@/lib/social-block";\n`,
    `import { isBlockedEitherWay } from "@/lib/social-block";`,
  );
  replaceOnce(
    reply,
    `    return { ok: false, reason: "notfound" };\n  }\n\n  const reply = await db.socialReply.create(`,
    `    return { ok: false, reason: "notfound" };\n  }\n  // Block (SOCIAL_TODO A7): neither person may have blocked the other. The same "not found", it never says why.\n  if (await isBlockedEitherWay(db, input.authorId, post.authorId)) return { ok: false, reason: "notfound" };\n\n  const reply = await db.socialReply.create(`,
    "Block (SOCIAL_TODO A7): neither person may have blocked the other. The same",
  );

  const sync = p("web/src/lib/social-tag-sync.ts");
  replaceOnce(
    sync,
    `  const wantedIds = people.filter((person) => isSocialAuthorShown(person)).map((person) => person.id);\n`,
    `  // Block (SOCIAL_TODO A7): a person who blocked the author, or was blocked by the author, stays plain text.\n  const blockRows =\n    people.length > 0\n      ? await db.socialBlock.findMany({\n          where: {\n            OR: [\n              { blockerId: authorId, blockedId: { in: people.map((person) => person.id) } },\n              { blockedId: authorId, blockerId: { in: people.map((person) => person.id) } },\n            ],\n          },\n          select: { blockerId: true, blockedId: true },\n        })\n      : [];\n  const blockedIds = new Set(blockRows.flatMap((row) => [row.blockerId, row.blockedId]));\n  const wantedIds = people.filter((person) => isSocialAuthorShown(person) && !blockedIds.has(person.id)).map((person) => person.id);\n`,
    "Block (SOCIAL_TODO A7): a person who blocked the author",
  );
}

// 4. Notifications: nothing from a blocked or muted person (list and bell use the same function)
{
  const notif = p("web/src/lib/social-notifications.ts");
  replaceOnce(
    notif,
    `import { isSocialAuthorShown, socialAuthorShown } from "@/lib/social-visibility";\n`,
    `import { isSocialAuthorShown, socialAuthorShown } from "@/lib/social-visibility";\nimport { loadHiddenAuthors } from "@/lib/social-block-view";\n`,
    `import { loadHiddenAuthors } from "@/lib/social-block-view";`,
  );
  replaceOnce(
    notif,
    `  return rows.filter(\n    (row) => isSocialAuthorShown(row.actor) && (row.socialPostId === null || shownPosts.has(row.socialPostId)),\n  );`,
    `  // Block and Mute (SOCIAL_TODO A7): nothing from a person the reader blocked, who blocked the reader, or whom the reader muted.\n  const hidden = await loadHiddenAuthors(userId);\n  return rows.filter(\n    (row) =>\n      isSocialAuthorShown(row.actor) &&\n      !hidden.all.has(row.actor.username) &&\n      (row.socialPostId === null || shownPosts.has(row.socialPostId)),\n  );`,
    "const hidden = await loadHiddenAuthors(userId);",
  );
}

// 5. Pages: the lists are applied AFTER the shared cache (the cached feeds hold no personal data)
{
  const imports = `import { dropHiddenItems } from "@/lib/social-block-rules";\nimport { loadHiddenAuthors } from "@/lib/social-block-view";\n`;

  // /social
  const feed = p("web/src/app/(site)/social/page.tsx");
  replaceOnce(feed, `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, imports + `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, `import { loadHiddenAuthors }`);
  replaceOnce(
    feed,
    `  const page = await getSocialFeed(cursor ? cursorToText(cursor) : null);\n`,
    `  const fetched = await getSocialFeed(cursor ? cursorToText(cursor) : null);\n  // Block and Mute (SOCIAL_TODO A7): applied after the shared cache, for this viewer only.\n  const hidden = await loadHiddenAuthors(viewer.id);\n  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };\n`,
    "const fetched = await getSocialFeed",
  );
  replaceOnce(feed, `      {page.items.length === 0 && !cursor ? (`, `      {page.items.length === 0 && !cursor && !page.next ? (`, "!cursor && !page.next ? (");

  // /social/following
  const following = p("web/src/app/(site)/social/following/page.tsx");
  replaceOnce(following, `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, imports + `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, `import { loadHiddenAuthors }`);
  replaceOnce(
    following,
    `  const { following, items, next } = await getFollowingFeed(viewer.id, cursor ? cursorToText(cursor) : null);\n`,
    `  const fetched = await getFollowingFeed(viewer.id, cursor ? cursorToText(cursor) : null);\n  // Block and Mute (SOCIAL_TODO A7): applied for this viewer only.\n  const hidden = await loadHiddenAuthors(viewer.id);\n  const items = dropHiddenItems(fetched.items, hidden.all);\n  const { following, next } = fetched;\n`,
    "const fetched = await getFollowingFeed",
  );
  replaceOnce(following, `      {items.length === 0 && !cursor ? (`, `      {items.length === 0 && !cursor && !next ? (`, "!cursor && !next ? (");

  // /social/tag/<tag>
  const tag = p("web/src/app/(site)/social/tag/[tag]/page.tsx");
  replaceOnce(tag, `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, imports + `import { cursorToText, parseCursor } from "@/lib/social-paging";\n`, `import { loadHiddenAuthors }`);
  replaceOnce(
    tag,
    `  const page = await getSocialTagFeed(tag, cursor ? cursorToText(cursor) : null);\n`,
    `  const fetched = await getSocialTagFeed(tag, cursor ? cursorToText(cursor) : null);\n  // Block and Mute (SOCIAL_TODO A7): applied for this viewer only.\n  const hidden = await loadHiddenAuthors(viewer.id);\n  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.all) };\n`,
    "const fetched = await getSocialTagFeed",
  );
  replaceOnce(tag, `      {page.items.length === 0 && !cursor ? (`, `      {page.items.length === 0 && !cursor && !page.next ? (`, "!cursor && !page.next ? (");

  // Home
  const home = p("web/src/app/(site)/page.tsx");
  replaceOnce(
    home,
    `import { getHomeFeed, getMyFollowing, getMySocialLikes, getMySocialReposts } from "@/lib/queries";\n`,
    `import { getHomeFeed, getMyFollowing, getMySocialLikes, getMySocialReposts } from "@/lib/queries";\n` + imports,
    `import { loadHiddenAuthors }`,
  );
  replaceOnce(
    home,
    `  const feed = await getHomeFeed(Boolean(viewer));\n`,
    `  const allItems = await getHomeFeed(Boolean(viewer));\n  // Block and Mute (SOCIAL_TODO A7): Social items only, applied after the shared cache, for this viewer only.\n  const hidden = viewer ? await loadHiddenAuthors(viewer.id) : null;\n  const feed = hidden ? dropHiddenItems(allItems, hidden.all) : allItems;\n`,
    "const allItems = await getHomeFeed",
  );

  // /social/<id>
  const post = p("web/src/app/(site)/social/[id]/page.tsx");
  replaceOnce(
    post,
    `import { getSessionUser } from "@/lib/session";\n`,
    `import { getSessionUser } from "@/lib/session";\nimport { dropHiddenAuthors, dropHiddenItems } from "@/lib/social-block-rules";\nimport { loadHiddenAuthors } from "@/lib/social-block-view";\n`,
    `import { loadHiddenAuthors }`,
  );
  replaceOnce(
    post,
    `  if (!post) notFound();\n\n  const liked`,
    `  if (!post) notFound();\n  // Block (SOCIAL_TODO A7): a post of a person who blocked you, or whom you blocked, is "not found". A muted person's post opens.\n  const hidden = await loadHiddenAuthors(viewer.id);\n  if (hidden.blocked.has(post.author)) notFound();\n\n  const liked`,
    "if (hidden.blocked.has(post.author)) notFound();",
  );
  replaceOnce(
    post,
    `  const quotes = await getSocialQuotes(post.id);\n`,
    `  const quotes = dropHiddenItems(await getSocialQuotes(post.id), hidden.all);\n`,
    "dropHiddenItems(await getSocialQuotes",
  );
  replaceOnce(
    post,
    `  const replies = await getSocialReplies(post.id);\n`,
    `  const replies = dropHiddenAuthors(await getSocialReplies(post.id), hidden.all);\n`,
    "dropHiddenAuthors(await getSocialReplies",
  );

  // Profile
  const prof = p("web/src/app/(site)/social/u/[username]/page.tsx");
  replaceOnce(
    prof,
    `import SocialReportMore from "@/components/social/SocialReportMore";\n`,
    `import SocialBlockButtons from "@/components/social/SocialBlockButtons";\nimport { socialBlockText } from "@/components/social/socialBlockProps";\nimport SocialReportMore from "@/components/social/SocialReportMore";\n`,
    `import SocialBlockButtons from`,
  );
  replaceOnce(
    prof,
    `import { getSessionUser } from "@/lib/session";\n`,
    `import { getSessionUser } from "@/lib/session";\nimport { dropHiddenItems, noRelation } from "@/lib/social-block-rules";\nimport { getBlockRelation, loadHiddenAuthors } from "@/lib/social-block-view";\n`,
    `import { getBlockRelation, loadHiddenAuthors }`,
  );
  replaceOnce(
    prof,
    `  const isOwn = profile.id === viewer.id;\n  const tab = parseProfileTab(rawTab, isOwn);\n`,
    `  const isOwn = profile.id === viewer.id;\n  // Block (SOCIAL_TODO A7): if THEY blocked me the page is "not found" (it never says why); if I blocked them I see a short\n  // page with Unblock. Mute changes nothing here except a note and the Unmute button.\n  const relation = isOwn ? noRelation : await getBlockRelation(viewer.id, profile.id);\n  if (relation.blockedMe && !relation.blockedByMe) notFound();\n  if (relation.blockedByMe) {\n    return (\n      <>\n        <header className="card pg-head sp-profileHead">\n          <h1 className="sf-h1">{profile.displayName?.trim() || profile.username}</h1>\n          <p className="pc-meta" dir="ltr">@{profile.username}</p>\n        </header>\n        <section className="card pg-empty">\n          <span className="pc-avatar pc-a4" aria-hidden="true"><Icon name="shield" size={26} /></span>\n          <p>{t("social.block.profile", { username: profile.username })}</p>\n          <SocialBlockButtons username={profile.username} initialMuted={false} initialBlocked={true} text={socialBlockText(profile.username)} />\n        </section>\n      </>\n    );\n  }\n  const tab = parseProfileTab(rawTab, isOwn);\n`,
    "const relation = isOwn ? noRelation",
  );
  replaceOnce(
    prof,
    `          <div>\n            <SocialFollowButton`,
    `          <div>\n            {relation.mutedByMe && <p className="pc-meta">{t("social.mute.note", { username: profile.username })}</p>}\n            <SocialFollowButton`,
    `{relation.mutedByMe && <p className="pc-meta">`,
  );
  replaceOnce(
    prof,
    `            <SocialReportMore target={{ kind: "account", username: profile.username }} {...socialReportMoreProps("account")} />\n`,
    `            <SocialReportMore target={{ kind: "account", username: profile.username }} {...socialReportMoreProps("account")} />\n            <SocialBlockButtons username={profile.username} initialMuted={relation.mutedByMe} initialBlocked={false} text={socialBlockText(profile.username)} />\n`,
    `initialBlocked={false}`,
  );
  replaceOnce(
    prof,
    `{tab === "replies" && <RepliesTab profileId={profile.id} />}`,
    `{tab === "replies" && <RepliesTab profileId={profile.id} viewerId={viewer.id} />}`,
    `<RepliesTab profileId={profile.id} viewerId`,
  );
  replaceOnce(
    prof,
    `  const page = await getSocialProfileFeed(profileId, cursorText);\n  if (page.items.length === 0 && !cursorText) return <Empty text={t("social.profile.empty.posts")} />;\n`,
    `  const hidden = await loadHiddenAuthors(viewer.id);\n  const fetched = await getSocialProfileFeed(profileId, cursorText);\n  // Block hides what a blocked person wrote or reposted. A MUTED person's own profile still shows their posts.\n  const page = { ...fetched, items: dropHiddenItems(fetched.items, hidden.blocked) };\n  if (page.items.length === 0 && !cursorText && !page.next) return <Empty text={t("social.profile.empty.posts")} />;\n`,
    "const fetched = await getSocialProfileFeed",
  );
  replaceOnce(
    prof,
    `async function RepliesTab({ profileId }: { profileId: string }) {\n  const replies = await getSocialProfileReplies(profileId);\n`,
    `async function RepliesTab({ profileId, viewerId }: { profileId: string; viewerId: string }) {\n  const hidden = await loadHiddenAuthors(viewerId);\n  const replies = (await getSocialProfileReplies(profileId)).filter((reply) => !hidden.blocked.has(reply.postAuthor));\n`,
    `async function RepliesTab({ profileId, viewerId }`,
  );
  replaceOnce(
    prof,
    `  const items = await getSocialProfileLikes(profileId);\n`,
    `  const hidden = await loadHiddenAuthors(viewer.id);\n  const items = dropHiddenItems(await getSocialProfileLikes(profileId), hidden.all);\n`,
    "dropHiddenItems(await getSocialProfileLikes",
  );
  replaceOnce(
    prof,
    `  const people = await getSocialProfilePeople(profileId, kind);\n`,
    `  const hidden = await loadHiddenAuthors(viewer.id);\n  const people = (await getSocialProfilePeople(profileId, kind)).filter((person) => !hidden.blocked.has(person.username));\n`,
    "!hidden.blocked.has(person.username)",
  );
}

// 6. Final erasure and "Download my data"
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `  await eraseSocialTags(db, userId); // hashtags and mentions (SOCIAL_TODO 6)\n`,
  `  await eraseSocialTags(db, userId); // hashtags and mentions (SOCIAL_TODO 6)\n  await eraseSocialBlocks(db, userId); // blocks and mutes made or received (SOCIAL_TODO A7)\n`,
  "await eraseSocialBlocks(db, userId);",
);
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `import { eraseSocialTags } from "./social-tag-sync";\n`,
  `import { eraseSocialTags } from "./social-tag-sync";\nimport { eraseSocialBlocks } from "./social-block";\n`,
  `import { eraseSocialBlocks } from "./social-block";`,
);
{
  const exp = p("web/src/lib/export-social.ts");
  replaceOnce(
    exp,
    `  const [posts, likes, reposts, following, followersCount, notifications, replies] = await Promise.all([`,
    `  const [posts, likes, reposts, following, followersCount, notifications, replies, blocks, mutes] = await Promise.all([`,
    "followersCount, notifications, replies, blocks, mutes]",
  );
  replaceOnce(
    exp,
    `      select: { id: true, socialPostId: true, body: true, status: true, createdAt: true, deletedAt: true },\n    }),\n  ]);`,
    `      select: { id: true, socialPostId: true, body: true, status: true, createdAt: true, deletedAt: true },\n    }),\n    // Block and Mute (SOCIAL_TODO A7): only the lists the person made, never who blocked or muted THEM.\n    db.socialBlock.findMany({\n      where: { blockerId: userId },\n      orderBy: { createdAt: "asc" },\n      select: { createdAt: true, blocked: { select: { username: true } } },\n    }),\n    db.socialMute.findMany({\n      where: { muterId: userId },\n      orderBy: { createdAt: "asc" },\n      select: { createdAt: true, muted: { select: { username: true } } },\n    }),\n  ]);`,
    "db.socialBlock.findMany({",
  );
  replaceOnce(
    exp,
    `    replies,\n    notifications: notifications.map(`,
    `    replies,\n    blocked: blocks.map((b) => ({ username: b.blocked.username, since: b.createdAt })),\n    muted: mutes.map((m) => ({ username: m.muted.username, since: m.createdAt })),\n    notifications: notifications.map(`,
    "blocked: blocks.map",
  );
}

// 7. The stand-in databases of four older tests need an empty block table
replaceOnce(
  p("web/scripts/test-social-follow.ts"),
  `    user: {\n      findFirst: async ({ where }: { where: Record<string, unknown> }) =>`,
  `    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)\n    user: {\n      findFirst: async ({ where }: { where: Record<string, unknown> }) =>`,
  "nobody is blocked in this test",
);
replaceOnce(
  p("web/scripts/test-social-repost.ts"),
  `    notifications,\n    socialPost: {\n`,
  `    notifications,\n    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)\n    socialPost: {\n`,
  "nobody is blocked in this test",
);
replaceOnce(
  p("web/scripts/test-social-reply.ts"),
  `  const db = {\n    socialPost: { findUnique:`,
  `  const db = {\n    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)\n    socialPost: { findUnique:`,
  "nobody is blocked in this test",
);
replaceOnce(
  p("web/scripts/test-social-tags.ts"),
  `    user: { findMany: table(db.users).findMany },\n`,
  `    socialBlock: { findMany: async () => [] }, // nobody is blocked in this test (patch-social-block)\n    user: { findMany: table(db.users).findMany },\n`,
  "nobody is blocked in this test",
);

// 8. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-block"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-block"] = "tsx scripts/test-social-block.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 9. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-block", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.block.confirm"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 10. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-08\n",
  "## 2026-11-08\n" + fs.readFileSync(p("docs-social-block/changelog.txt"), "utf8").trimEnd() + "\n",
  "patch-social-block (SOCIAL_TODO A7",
);
appendOnce(p("ACCOUNT_RULES.md"), fs.readFileSync(p("docs-social-block/account-rules.txt"), "utf8"), "### 3.16 Block and Mute");

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
