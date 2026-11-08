// patch-social-images (4b: ONE picture per Social post).
// Run in the project folder (where PROJECT.md is), AFTER unzipping the patch:   node apply-social-images.mjs
// It edits 14 existing files (every edit is checked: if a piece of text is not found exactly once, it says which and counts a problem).
// Safe to run twice: a finished edit is skipped. DATABASE CHANGE: only one new INDEX (the migration folder is part of the patch).
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
  "web/src/lib/social-image.ts",
  "web/src/lib/social-image-storage.ts",
  "web/src/app/api/social/media/[file]/route.ts",
  "web/prisma/migrations/20261110090000_social_media_index/migration.sql",
  "web/scripts/test-social-image.ts",
  "web/src/app/(site)/social/submit/actions.ts",
  "web/src/app/(site)/social/submit/page.tsx",
  "web/src/components/social/SocialPostForm.tsx",
]) {
  if (!fs.existsSync(p(f))) { console.log("MISSING NEW FILE (unzip the patch first): " + f); problems++; }
}

// 1. Settings: limits of the picture
replaceOnce(
  p("web/src/config/site.ts"),
  `  ], // repost / quote / undo (SOCIAL_TODO 16), counted in server memory
};
`,
  `  ], // repost / quote / undo (SOCIAL_TODO 16), counted in server memory
};

// The picture of a Social post (patch-social-images, PROJECT.md 8j.5). PROVISIONAL: confirm the numbers.
// ONE picture per post; the real content must be a JPEG, PNG or WebP (src/lib/social-image.ts). The file is rebuilt
// without Exif / location data and kept in OUR storage folder (web/storage/social/, or SOCIAL_MEDIA_DIR).
//  imageMaxBytes: size of the uploaded file.   maxSide / maxPixels: a small file can be a huge picture that uses
//  gigabytes of memory in other people's browsers, so the size in pixels is limited too.
//  checks: how many pictures one person may send to be checked per time window (server memory), because checking is work.
export const socialMedia = {
  imageMaxBytes: 5 * 1024 * 1024,
  maxSide: 10_000,
  maxPixels: 40_000_000,
  imageTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  checks: { max: 20, windowMinutes: 10 },
};
`,
  "export const socialMedia = {",
);

// 2. Database: an index on the picture address (the picture route looks a post up by it)
replaceOnce(
  p("web/prisma/schema.prisma"),
  `  mentions SocialMention[]

  @@index([createdAt, id])
  @@index([authorId, createdAt])
  @@index([status, createdAt])
}`,
  `  mentions SocialMention[]

  @@index([createdAt, id])
  @@index([authorId, createdAt])
  @@index([status, createdAt])
  @@index([mediaUrl])
}`,
  "@@index([mediaUrl])",
);

// 3. queries.ts: the picture address comes with every Social post
{
  const queries = p("web/src/lib/queries.ts");
  replaceOnce(
    queries,
    `export type SocialPostSummary = {
  id: number;
  author: string;
  displayName: string | null;
  body: string;
`,
    `export type SocialPostSummary = {
  id: number;
  author: string;
  displayName: string | null;
  body: string;
  /** Address of the post's picture ("/api/social/media/<file>", login only), or null (patch-social-images). */
  image: string | null;
`,
    "image: string | null;",
  );
  replaceOnce(
    queries,
    `const socialPostSelect = {
  id: true,
  body: true,
`,
    `const socialPostSelect = {
  id: true,
  body: true,
  mediaUrl: true,
`,
    "  body: true,\n  mediaUrl: true,",
  );
  replaceOnce(
    queries,
    `    body: row.body,
    time: timeAgo(row.createdAt),
    createdAtMs: row.createdAt.getTime(),
    likes: row._count.likes,`,
    `    body: row.body,
    image: row.mediaUrl,
    time: timeAgo(row.createdAt),
    createdAtMs: row.createdAt.getTime(),
    likes: row._count.likes,`,
    "image: row.mediaUrl,",
  );
}

// 4. The card shows the picture
replaceOnce(
  p("web/src/components/social/SocialPostCard.tsx"),
  `        <SocialBody body={post.body} mentions={post.mentions} />
`,
  `        <SocialBody body={post.body} mentions={post.mentions} />

        {post.image && (
          <div className="sp-media">
            <a href={post.image} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (login only); a plain <img> keeps the route simple */}
              <img src={post.image} alt={t("social.image.alt", { name })} loading="lazy" decoding="async" />
            </a>
          </div>
        )}
`,
  "className=\"sp-media\"",
);

// 5. Deleting your post also deletes the picture file (after the commit)
{
  const manage = p("web/src/app/(site)/social/manage/actions.ts");
  replaceOnce(
    manage,
    `import { applySocialDelete } from "@/lib/social-delete";
`,
    `import { applySocialDelete } from "@/lib/social-delete";
import { deleteSocialImages } from "@/lib/social-image-storage";
`,
    "deleteSocialImages } from",
  );
  replaceOnce(
    manage,
    `  try {
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await applySocialDelete(tx, { id: input.id, authorId: user.id });
      if (deleted.ok) await removeSocialTags(tx, input.id); // its hashtags and mentions go with the text (SOCIAL_TODO 6)
      return deleted;
    });
    if (!result.ok) return { error: true };
    updateTag("social-posts");`,
    `  try {
    let pictureUrl: string | null = null; // the picture file leaves the disk after the commit (patch-social-images)
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.socialPost.findFirst({ where: { id: input.id, authorId: user.id, deletedAt: null }, select: { mediaUrl: true } });
      const deleted = await applySocialDelete(tx, { id: input.id, authorId: user.id });
      if (deleted.ok) {
        await removeSocialTags(tx, input.id); // its hashtags and mentions go with the text (SOCIAL_TODO 6)
        pictureUrl = before?.mediaUrl ?? null;
      }
      return deleted;
    });
    if (!result.ok) return { error: true };
    await deleteSocialImages([pictureUrl]); // never throws; a leftover file is harmless, nothing points to it
    updateTag("social-posts");`,
    "let pictureUrl: string | null = null;",
  );
}

// 6. Final erasure of an account: its picture files leave the disk too (after the commit)
appendOnce(
  p("web/src/lib/purge-social.ts"),
  `
/**
 * The picture addresses of ALL the social posts of a person, read BEFORE \`eraseSocial\` clears them, so purge.ts can delete the
 * files from disk after the commit (patch-social-images). Pictures of posts that go into the safety record are deleted too:
 * the record keeps the text, not the picture (open question for the lawyer, ACCOUNT_RULES.md 3.15).
 */
export async function socialPictureFiles(db: Db, userId: string): Promise<string[]> {
  const rows = await db.socialPost.findMany({ where: { authorId: userId, mediaUrl: { not: null } }, select: { mediaUrl: true } });
  return rows.flatMap((row) => (row.mediaUrl ? [row.mediaUrl] : []));
}
`,
  "socialPictureFiles",
);
{
  const purge = p("web/src/lib/purge.ts");
  replaceOnce(
    purge,
    `import { eraseSocial, socialPostsForRecord } from "@/lib/purge-social";
`,
    `import { eraseSocial, socialPictureFiles, socialPostsForRecord } from "@/lib/purge-social";
import { deleteSocialImages } from "@/lib/social-image-storage";
`,
    "socialPictureFiles, socialPostsForRecord",
  );
  replaceOnce(
    purge,
    `  const adFiles: string[] = []; // picture / video files of the person's ads: deleted from disk AFTER the commit (Session 3b)
`,
    `  const adFiles: string[] = []; // picture / video files of the person's ads: deleted from disk AFTER the commit (Session 3b)
  const socialFiles: string[] = []; // picture files of the person's social posts: deleted from disk AFTER the commit (patch-social-images)
`,
    "const socialFiles: string[] = [];",
  );
  replaceOnce(
    purge,
    `      await eraseSocial(tx, user.id, now); // social posts, quote texts, follows, notifications (SOCIAL_TODO 5)
`,
    `      socialFiles.push(...(await socialPictureFiles(tx, user.id))); // read BEFORE the erasure clears the addresses
      await eraseSocial(tx, user.id, now); // social posts, quote texts, follows, notifications (SOCIAL_TODO 5)
`,
    "socialFiles.push(",
  );
  replaceOnce(
    purge,
    `  await deleteAdFiles(adFiles);
`,
    `  await deleteAdFiles(adFiles);
  await deleteSocialImages(socialFiles); // same for the social picture files (never throws)
`,
    "await deleteSocialImages(socialFiles);",
  );
}

// 7. Moderators see the picture (they must judge the post as it really is)
{
  const review = p("web/src/lib/social-review.ts");
  replaceOnce(
    review,
    `export type SocialReportedItem = {
  id: number;
  author: string;
  text: string;
`,
    `export type SocialReportedItem = {
  id: number;
  author: string;
  text: string;
  image: string | null; // address of the post's picture (patch-social-images); the picture route lets admins see it
`,
    "image: string | null; // address of the post's picture",
  );
  replaceOnce(
    review,
    `export type SocialPendingItem = {
  id: number;
  author: string;
  text: string;
`,
    `export type SocialPendingItem = {
  id: number;
  author: string;
  text: string;
  image: string | null;
`,
    "  text: string;\n  image: string | null;\n  hiddenBy",
  );
  replaceOnce(
    review,
    `socialPost: { select: { id: true, body: true, authorId: true, author: { select: { username: true } } } },`,
    `socialPost: { select: { id: true, body: true, mediaUrl: true, authorId: true, author: { select: { username: true } } } },`,
    "body: true, mediaUrl: true, authorId: true",
  );
  replaceOnce(
    review,
    `id: post.id, author: post.author.username, text: excerpt(post.body, SOCIAL_PREVIEW_LENGTH), reports: [], own: post.authorId === meId,`,
    `id: post.id, author: post.author.username, text: excerpt(post.body, SOCIAL_PREVIEW_LENGTH), image: post.mediaUrl, reports: [], own: post.authorId === meId,`,
    "image: post.mediaUrl,",
  );
  replaceOnce(
    review,
    `id: true, body: true, authorId: true, deletedAt: true, statusSiteRule: true, statusNote: true, statusChangedAt: true,`,
    `id: true, body: true, mediaUrl: true, authorId: true, deletedAt: true, statusSiteRule: true, statusNote: true, statusChangedAt: true,`,
    "body: true, mediaUrl: true, authorId: true, deletedAt: true",
  );
  replaceOnce(
    review,
    `      text: p.deletedAt ? "" : excerpt(p.body, SOCIAL_PREVIEW_LENGTH),
`,
    `      text: p.deletedAt ? "" : excerpt(p.body, SOCIAL_PREVIEW_LENGTH),
      image: p.deletedAt ? null : p.mediaUrl,
`,
    "image: p.deletedAt ? null : p.mediaUrl,",
  );
  const page = p("web/src/app/admin/social/page.tsx");
  replaceOnce(
    page,
    `              <div className="ad-quote">
                <p>{item.text}</p>
              </div>
              <ul>`,
    `              <div className="ad-quote">
                <p>{item.text}</p>
              </div>
              {item.image && (
                <div className="sp-media">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (admins and logged-in people only) */}
                  <img src={item.image} alt={t("social.image.alt", { name: item.author })} loading="lazy" decoding="async" />
                </div>
              )}
              <ul>`,
    "{item.image && (\n                <div className=\"sp-media\">",
  );
  replaceOnce(
    page,
    `                <p className="pc-meta">{t("admin.review.erased")}</p>
              )}
`,
    `                <p className="pc-meta">{t("admin.review.erased")}</p>
              )}
              {item.image && (
                <div className="sp-media">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own protected file (admins and logged-in people only) */}
                  <img src={item.image} alt={t("social.image.alt", { name: item.author })} loading="lazy" decoding="async" />
                </div>
              )}
`,
    "{t(\"admin.review.erased\")}</p>\n              )}\n              {item.image",
  );
}

// 8. Styles
appendOnce(
  p("web/src/app/content.css"),
  `
/* Pictures in Social posts (patch-social-images) */
.sp-media { margin-top: 12px; }
.sp-media a { display: block; width: fit-content; max-width: 100%; }
.sp-media img { display: block; max-width: 100%; max-height: 520px; width: auto; height: auto; object-fit: contain; border-radius: var(--radius-md); background: var(--surface2); box-shadow: 0 0 0 1px var(--line); }
.sf-image { display: grid; gap: 8px; }
.sf-imageRow { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.sf-imageHelp { margin: 0; color: var(--muted); font-size: 14px; }
`,
  "/* Pictures in Social posts (patch-social-images) */",
);

// 9. npm script
replaceOnce(
  p("web/package.json"),
  `    "test:social-tags": "tsx scripts/test-social-tags.ts"
`,
  `    "test:social-tags": "tsx scripts/test-social-tags.ts",
    "test:social-image": "tsx scripts/test-social-image.ts"
`,
  "test:social-image",
);

// 10. Texts in six languages
for (const lang of ["en", "es", "fr", "zh", "hi", "ar"]) {
  const file = p("web/src/i18n/messages", lang + ".ts");
  const add = fs.readFileSync(p("i18n-social-images", lang + ".txt"), "utf8");
  const src = read(file);
  if (src === null) continue;
  if (src.includes('"social.form.image.add"')) { console.log("skip (already done): " + lang + ".ts"); continue; }
  const closing = lang === "en" ? "\n} as const;\n" : "\n};\n";
  const at = src.indexOf(closing);
  if (at < 0) { console.log("PROBLEM: end of the texts not found in " + lang + ".ts"); problems++; continue; }
  fs.writeFileSync(file, src.slice(0, at + 1) + add + src.slice(at + 1));
  console.log("edited: web/src/i18n/messages/" + lang + ".ts");
}

// 11. Documents
replaceOnce(
  p("CHANGELOG.md"),
  "## 2026-11-07\n",
  "## 2026-11-07\n- patch-social-images (4b: pictures in Social posts): a Social post can now have ONE picture. The post form has an \"Add a picture\" button (JPG, PNG or WebP, at most 5 MB, preview, remove); the text is still required. `createSocialPost` now receives a `FormData` (fields `body`, `image`). Checks on the server (`src/lib/social-image.ts`, pure, `socialMedia` in `site.ts`): size; the REAL content (first bytes, as for ad pictures; SVG is never accepted); the whole file must be well formed; at most 10,000 pixels on a side and 40 million in total (`pixels`). PRIVACY: the saved picture is a REBUILT copy, not the upload: JPEG keeps only picture data, JFIF, colour profile and Adobe marker (Exif with GPS location / camera / date, XMP, IPTC, comments, thumbnails and bytes after the end are removed; the orientation number is kept in a tiny new Exif so phone photos are not turned sideways); PNG loses text / Exif / time chunks; WebP loses Exif / XMP. A file that cannot be understood completely is refused, never saved as it came. Checked against real files: all pixels are identical after cleaning. A person may send 20 pictures to be checked per 10 minutes (`socialMedia.checks`, server memory); the post limits still apply. Files live in `web/storage/social/` (or `SOCIAL_MEDIA_DIR`) with a random name (`src/lib/social-image-storage.ts`), NOT in `web/public/`, and are served only by `GET /api/social/media/[file]`: login required (else 404), only a file that belongs to a post, a post that may be shown is visible to every logged-in person, a hidden / removed post or one of an account that is not shown only to its author and admins, a deleted post has no picture. `private` cache, `nosniff`, `sandbox` policy. The file is written to disk only after the post rate limit said yes, inside the transaction; if the save fails the file is deleted again. Deleting your own post deletes its file after the commit; final erasure of an account deletes all its picture files (`socialPictureFiles` in `purge-social.ts`, called from `purge.ts`). A picture of a post in the safety record is deleted too: the record keeps the text only (open question, ACCOUNT_RULES.md 3.15). Moderators see the picture in /admin/social (reported and hidden posts). The card shows the picture (max height 520 px, click opens the full picture in a new tab, alt text \"Picture in a post by <name>\"). The home feed, /social, profiles, hashtag pages and the single post page all use the same card. DATABASE CHANGE: one index `SocialPost_mediaUrl_idx` (the picture route looks the post up by its picture address), ready-made migration `20261110090000_social_media_index`: run `npx prisma migrate dev` (NOT with `--name`) and `npx prisma generate` inside web/. 8 new texts in six languages. New test `npm run test:social-image` (no database; 50+ checks, with secrets planted in Exif / XMP / PNG text / WebP Exif to prove they do not survive). Not in this patch on purpose: changing or removing the picture when editing a post (delete the post and post again), alt text written by the author, a picture in a reply or in a quote repost, several pictures, video, a daily disk limit per person, backup and disk space of `web/storage/social/` (TODO 56), a virus scan (TODO 52), \"Download my data\" still lists only the picture address, not the file.\n",
  "patch-social-images (4b",
);
replaceOnce(
  p("PROJECT.md"),
  "Security checks come with TODO 52 and the same rules apply to community posts (TODO 59).",
  "Security checks come with TODO 52 and the same rules apply to community posts (TODO 59). **Built (patch-social-images, 4b):** image upload for Social posts with exactly these provisional limits (5 MB; at most 10,000 px on a side and 40 million pixels; JPEG, PNG, WebP; checked by real content), stored in `web/storage/social/`, shown only to logged-in people, rebuilt WITHOUT Exif / location data. The text of a post is still required. See ACCOUNT_RULES.md 3.15.",
  "**Built (patch-social-images, 4b):**",
);
appendOnce(
  p("ACCOUNT_RULES.md"),
  `
### 3.15 Pictures in Social posts (patch-social-images 4b, decided 2026-11-10, PROVISIONAL)
- ONE picture per post, JPG / PNG / WebP, at most 5 MB, at most 10,000 px on a side and 40 million pixels. The text of the post is still required. Checked by the real content of the file; SVG, GIF, video are not accepted.
- Privacy: the stored picture is a rebuilt copy WITHOUT Exif / location / camera / date data (only the orientation number is kept). The original upload is never kept. A file that cannot be fully understood is refused.
- Who may see a picture: only logged-in people (Social is for logged-in people, PROJECT.md 8j.11). A hidden or removed post, or a post of an account that is not shown (3.8), only its author and admins (moderators must see what they judge). A deleted post has no picture.
- Deleting your own post deletes the picture file at once (after the database change). Final erasure (3.7) deletes ALL the picture files of the person.
- Safety record (3.7): a hidden / removed post that goes into the record keeps its TEXT; its PICTURE is deleted with the account like every other picture. Open question for the lawyer: must a picture be kept as evidence for the 180 / 730 days? If yes, the files of those posts must be moved into a protected folder and swept with the record.
- Editing a post does not change its picture (delete the post and post again). A moderator who REMOVES a post (3.11) does not delete the file: it stays for an appeal and goes with the final erasure.
- Limits: 20 pictures per person per 10 minutes sent for checking (server memory, TODO 50 for many servers); the post limits (3.9) still apply, so at most 30 pictures per day.
- Not decided yet: disk space and backup of \`web/storage/social/\` (TODO 56), a virus scan (TODO 52), alt text written by the author, how Block / Mute (SOCIAL_TODO 7) affects who sees a picture.
`,
  "### 3.15 Pictures in Social posts",
);

console.log(problems === 0 ? "\nAll done." : `\n${problems} problem(s): nothing else was changed for them. Send me this screen.`);
process.exit(problems === 0 ? 0 : 1);
