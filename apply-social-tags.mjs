// patch-social-tags (SOCIAL_TODO 6: hashtags and @mentions in Social posts).
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-tags.mjs
// It edits 20 existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
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
  "web/src/lib/social-tags.ts",
  "web/src/lib/social-tag-sync.ts",
  "web/src/components/social/SocialBody.tsx",
  "web/src/app/(site)/social/tag/[tag]/page.tsx",
  "web/prisma/migrations/20261109100000_social_tags/migration.sql",
  "web/scripts/test-social-tags.ts",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (unzip the patch first): " + f); problems++; }
}

// 1. Database: two tables (the migration SQL is in the zip: do NOT make a new one with --name)
{
  const schema = p("web/prisma/schema.prisma");
  replaceOnce(
    schema,
    `  replies SocialReply[]
  reports Report[]

  @@index([createdAt, id])`,
    `  replies SocialReply[]
  reports Report[]
  tags    SocialPostTag[]
  mentions SocialMention[]

  @@index([createdAt, id])`,
    "tags    SocialPostTag[]",
  );
  replaceOnce(
    schema,
    `  socialReposts       SocialRepost[]
`,
    `  socialReposts       SocialRepost[]
  socialMentions      SocialMention[]
`,
    "socialMentions      SocialMention[]",
  );
  appendOnce(
    schema,
    `
// ---------------------------------------------------------------- Social hashtags and mentions (SOCIAL_TODO 6)

// One row per hashtag used in a Social post. \`tag\` is the saved form: NFC + lower case, without the #.
model SocialPostTag {
  socialPostId Int
  tag          String
  createdAt    DateTime @default(now())

  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)

  @@id([socialPostId, tag])
  @@index([tag, socialPostId])
}

// One row per person mentioned (@username) in a Social post: only accounts that exist and may be shown.
model SocialMention {
  socialPostId Int
  userId       String
  createdAt    DateTime @default(now())

  socialPost SocialPost @relation(fields: [socialPostId], references: [id], onDelete: Restrict)
  user       User       @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@id([socialPostId, userId])
  @@index([userId])
}
`,
    "model SocialPostTag",
  );
}

// 2. queries.ts: the mentions come with every Social post; the hashtag feed
{
  const queries = p("web/src/lib/queries.ts");
  replaceOnce(
    queries,
    `  replies: number;
  edited?: true;
};`,
    `  replies: number;
  /** Usernames saved as mentioned in the text (accounts that exist and may be shown): only these are links (SOCIAL_TODO 6). */
  mentions: string[];
  edited?: true;
};`,
    "mentions: string[];",
  );
  replaceOnce(
    queries,
    `      replies: { where: { status: ContentStatus.VISIBLE, deletedAt: null } },
    },
  },
} satisfies Prisma.SocialPostSelect;`,
    `      replies: { where: { status: ContentStatus.VISIBLE, deletedAt: null } },
    },
  },
  // SOCIAL_TODO 6: who is mentioned (only accounts that may be shown)
  mentions: {
    where: { user: socialAuthorShown },
    select: { user: { select: { username: true } } },
  },
} satisfies Prisma.SocialPostSelect;`,
    "// SOCIAL_TODO 6: who is mentioned",
  );
  replaceOnce(
    queries,
    `    replies: row._count.replies,
    ...(row.editedAt !== null`,
    `    replies: row._count.replies,
    mentions: row.mentions.map((mention) => mention.user.username),
    ...(row.editedAt !== null`,
    "mentions: row.mentions.map",
  );
  appendOnce(
    queries,
    `
// ---- Hashtag feed (SOCIAL_TODO 6, patch-social-tags). Same visibility rules as the feeds. ONLY for logged-in people
// (PROJECT.md 8j point 11). Not cached: it is read per request, inside the page.

/** The Social posts that use one hashtag (\`tag\` in its saved form), newest first, paged like the feeds. Posts only: reposts are not listed. */
export async function getSocialTagFeed(tag: string, before: string | null = null): Promise<SocialFeedPage> {
  const cursor = parseCursor(before);
  const rows = await prisma.socialPost.findMany({
    where: { AND: [socialFeedWhere, { tags: { some: { tag } } }, afterCursorWhere(cursor, 0)] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: SOCIAL_FEED_SIZE + 1,
    select: socialPostSelect,
  });
  const items: SocialFeedItem[] = rows.map((row): SocialFeedItem => ({
    kind: "post",
    createdAtMs: row.createdAt.getTime(),
    post: toSocialSummary(row),
  }));
  return toFeedPage(items);
}
`,
    "export async function getSocialTagFeed",
  );
}

// 3. The post card shows the text with links
{
  const card = p("web/src/components/social/SocialPostCard.tsx");
  replaceOnce(
    card,
    `import SocialLikeButton from "@/components/social/SocialLikeButton";
`,
    `import SocialBody from "@/components/social/SocialBody";
import SocialLikeButton from "@/components/social/SocialLikeButton";
`,
    'import SocialBody from',
  );
  replaceOnce(
    card,
    `        <p className="pc-text pc-text-full sp-body">{post.body}</p>`,
    `        <SocialBody body={post.body} mentions={post.mentions} />`,
    "<SocialBody body=",
  );
}

// 4. Saving: new post, edit, delete (each in the SAME transaction as the post)
{
  const submit = p("web/src/app/(site)/social/submit/actions.ts");
  replaceOnce(
    submit,
    `import { checkRules, type RateRule } from "@/lib/social-limits";
`,
    `import { checkRules, type RateRule } from "@/lib/social-limits";
import { syncSocialTags } from "@/lib/social-tag-sync";
`,
    "syncSocialTags }",
  );
  replaceOnce(
    submit,
    `      await tx.socialPost.create({
        data: {
          authorId: author.id,
          body: cleaned.body,
        },
      });
      return rate;`,
    `      const created = await tx.socialPost.create({
        data: {
          authorId: author.id,
          body: cleaned.body,
        },
        select: { id: true },
      });
      // Hashtags and mentions (SOCIAL_TODO 6): saved in the same transaction as the post.
      await syncSocialTags(tx, { socialPostId: created.id, authorId: author.id, body: cleaned.body });
      return rate;`,
    "await syncSocialTags(tx, { socialPostId: created.id",
  );

  const manage = p("web/src/app/(site)/social/manage/actions.ts");
  replaceOnce(
    manage,
    `import { applySocialDelete } from "@/lib/social-delete";
`,
    `import { applySocialDelete } from "@/lib/social-delete";
import { removeSocialTags, syncSocialTags } from "@/lib/social-tag-sync";
`,
    "removeSocialTags, syncSocialTags }",
  );
  replaceOnce(
    manage,
    `    const result = await prisma.$transaction((tx) =>
      applySocialEdit(tx, { id: input.id, authorId: user.id, body: input.body }),
    );`,
    `    const result = await prisma.$transaction(async (tx) => {
      const edited = await applySocialEdit(tx, { id: input.id, authorId: user.id, body: input.body });
      if (edited.ok && edited.changed) {
        // Hashtags and mentions follow the new text (SOCIAL_TODO 6), in the same transaction.
        const row = await tx.socialPost.findUnique({ where: { id: input.id }, select: { body: true } });
        if (row) await syncSocialTags(tx, { socialPostId: input.id, authorId: user.id, body: row.body });
      }
      return edited;
    });`,
    "Hashtags and mentions follow the new text",
  );
  replaceOnce(
    manage,
    `    const result = await prisma.$transaction((tx) => applySocialDelete(tx, { id: input.id, authorId: user.id }));`,
    `    const result = await prisma.$transaction(async (tx) => {
      const deleted = await applySocialDelete(tx, { id: input.id, authorId: user.id });
      if (deleted.ok) await removeSocialTags(tx, input.id); // its hashtags and mentions go with the text (SOCIAL_TODO 6)
      return deleted;
    });`,
    "await removeSocialTags(tx, input.id)",
  );
}

// 5. Notifications: the new type
replaceOnce(
  p("web/src/lib/social-notifications.ts"),
  `import { REPLY_NOTIFICATION } from "@/lib/social-reply";
`,
  `import { REPLY_NOTIFICATION } from "@/lib/social-reply";
import { MENTION_NOTIFICATION } from "@/lib/social-tag-sync";
`,
  "import { MENTION_NOTIFICATION }",
);
replaceOnce(
  p("web/src/lib/social-notifications.ts"),
  `export const NOTIFICATION_TYPES = [FOLLOW_NOTIFICATION, "SOCIAL_POST_LIKE", "SOCIAL_POST_REPOST", REPLY_NOTIFICATION] as const;`,
  `export const NOTIFICATION_TYPES = [FOLLOW_NOTIFICATION, "SOCIAL_POST_LIKE", "SOCIAL_POST_REPOST", REPLY_NOTIFICATION, MENTION_NOTIFICATION] as const;`,
  "REPLY_NOTIFICATION, MENTION_NOTIFICATION]",
);
replaceOnce(
  p("web/src/app/(site)/notifications/page.tsx"),
  `  SOCIAL_POST_REPLY: "notifications.type.reply",
};`,
  `  SOCIAL_POST_REPLY: "notifications.type.reply",
  SOCIAL_MENTION: "notifications.type.mention",
};`,
  "SOCIAL_MENTION:",
);

// 6. Final erasure of an account
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `import { ContentStatus } from "../../generated/prisma/client";
`,
  `import { ContentStatus } from "../../generated/prisma/client";
import { eraseSocialTags } from "./social-tag-sync";
`,
  "import { eraseSocialTags }",
);
replaceOnce(
  p("web/src/lib/purge-social.ts"),
  `  return { posts: posts.count, replies: replies.count,`,
  `  await eraseSocialTags(db, userId); // hashtags and mentions (SOCIAL_TODO 6)
  return { posts: posts.count, replies: replies.count,`,
  "await eraseSocialTags(db, userId)",
);

// 7. Style
appendOnce(
  p("web/src/app/content.css"),
  `
/* Hashtags and mentions in a Social post (SOCIAL_TODO 6) */
.sp-tag, .sp-mention { color: var(--brand); font-weight: 600; text-decoration: none; }
.sp-tag:hover, .sp-mention:hover, .sp-tag:focus-visible, .sp-mention:focus-visible { text-decoration: underline; }
`,
  ".sp-tag, .sp-mention {",
);

// 8. npm script
{
  const file = p("web/package.json");
  const src = read(file);
  if (src !== null) {
    const json = JSON.parse(src);
    if (json.scripts["test:social-tags"]) console.log("skip (already done): web/package.json");
    else {
      json.scripts["test:social-tags"] = "tsx scripts/test-social-tags.ts";
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
      console.log("edited: web/package.json");
    }
  }
}

// 9. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-tags", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.tag.title"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
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
  "## 2026-11-07\n- patch-social-tags (SOCIAL_TODO 6 Hashtags and @mentions): in a Social post, `#hashtag` and `@username` are now links. A hashtag opens the new page `/social/tag/<tag>` (login only, noindex, plain title; Social posts that use it, newest first, \"Older posts\" paging like the feeds; hidden / removed / deleted posts and posts of accounts that are not shown are left out by the same `socialFeedWhere`; a name that cannot be a hashtag is \"not found\", a hashtag nobody uses is an empty page). A mention opens the profile and notifies the person: new notification type `SOCIAL_MENTION` (\"<name> mentioned you in a post\", on the `/notifications` page and the bell). Rules in `src/lib/social-tags.ts` (pure; ONE scanner is used for saving and for showing, so they cannot disagree): a hashtag is `#` + letters / numbers / `_` / combining marks / zero-width joiners (Sinhala, Hindi, Arabic and Chinese work), starts with a letter or number, has at least one letter (`#123` is not a tag), at most 50 characters, and must not touch a letter or number on the left (`page#section` in a web address is not a tag); saved as NFC + lower case. A mention is `@` + a username (3-20 of a-z 0-9 `_`, any case typed, saved lower case); `me@example.com` is not a mention. LIMITS (PROJECT.md 8j.6, provisional): at most 10 different hashtags and 5 different mentions count per post; the extra ones stay plain text (no error, not saved, not linked, nobody notified). Saving in `src/lib/social-tag-sync.ts` (`syncSocialTags`, called inside the SAME transaction as the post in `social/submit/actions.ts` and as the edit in `social/manage/actions.ts`): only an account that exists and may be shown is a mention; ONE notification per person per post, ever (an edit that keeps the mention does not notify again; an edit that removes it deletes the notification if it is still unread); nobody is notified about their own mention. Deleting your post removes its hashtags and mentions (`removeSocialTags`); final erasure of an account removes the hashtags / mentions of its posts and every mention of the person (`eraseSocialTags`, called from `purge-social.ts`). The card text is the new `SocialBody.tsx`; `getSocialTagFeed` and the `mentions` field of `SocialPostSummary` in `queries.ts`. DATABASE CHANGE: new tables `SocialPostTag` and `SocialMention` in the ready-made migration `20261109100000_social_tags`: run `npx prisma migrate dev` (NOT with `--name`) and `npx prisma generate` inside web/. 3 new texts in six languages. New test `npm run test:social-tags` (no database). Not done on purpose: hashtags and mentions in replies and in quote-repost text (they stay plain text), a hashtag hint under the post box, trending hashtags (SOCIAL_TODO B7), search (B1), hashtag / mention rules for Block and Mute (not built yet: when Block exists a blocked person must not be able to mention the blocker), \"Download my data\" is unchanged (the hashtags are inside the exported post text).\n",
  "patch-social-tags (SOCIAL_TODO 6",
);
appendOnce(
  p("ACCOUNT_RULES.md"),
  `
### 3.14 Hashtags and mentions (SOCIAL_TODO 6, decided 2026-11-08, PROVISIONAL)
- A mention notifies the person mentioned, once per post. Only an account whose posts may be shown (3.8) can be mentioned; anything else stays plain text. Nobody is notified about their own mention.
- Limits: 10 different hashtags and 5 different mentions per post count; the rest stay plain text. The post rate limits (3.9) still apply, so nobody can be flooded.
- Deleting your post, or erasing your account, removes its hashtags and mentions. The notification rows follow the notification rules (3.12 and 3.7).
- Not decided yet: how Block / Mute (SOCIAL_TODO 7) affects mentions, hashtags in replies.
`,
  "### 3.14 Hashtags and mentions",
);

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
