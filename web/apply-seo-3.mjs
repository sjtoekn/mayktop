// patch-seo-3: SEO stage 3 = structured data (JSON-LD) on every post page + "nofollow ugc" on the website links of profiles.
// Needs patch-seo-2 first. Run from the web/ folder (where package.json is):
//   node apply-seo-3.mjs           -> only SHOWS what would change (nothing is written)
//   node apply-seo-3.mjs --apply   -> writes the changes (old versions of the edited files are saved in .seo3-backup/)
//   node apply-seo-3.mjs --undo    -> puts the old versions back and removes the new files (if the build complains)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");
const BACKUP = ".seo3-backup";
if (!existsSync("package.json") || !existsSync("src/app/layout.tsx")) {
  console.error("Run this inside the web/ folder (package.json and src/app/layout.tsx must be here).");
  process.exit(1);
}

const newFiles = {
 "src/lib/seo-jsonld.ts": "// Structured data (JSON-LD) for a post page (SEO stage 3). Pure code (no database): npm run test:seo-jsonld\n// Google reads this next to the visible page. Only what the page already shows is put in it.\nimport { absoluteUrl } from \"./site-url\";\nimport { cutText, summarize } from \"./seo-text\";\n\n/** JSON for a <script type=\"application/ld+json\"> tag. \"<\", \">\" and \"&\" are escaped so that a post can never close the tag early. */\nexport function jsonLdString(data: unknown): string {\n  return JSON.stringify(data)\n    .replace(/</g, \"\\\\u003c\")\n    .replace(/>/g, \"\\\\u003e\")\n    .replace(/&/g, \"\\\\u0026\")\n    .replace(/\\u2028/g, \"\\\\u2028\")\n    .replace(/\\u2029/g, \"\\\\u2029\");\n}\n\nexport type PostLdInput = {\n  id: number;\n  title: string;\n  body: string;\n  /** Username of the author, or \"\" when it must not be shown. */\n  author: string;\n  createdAtMs: number;\n  comments: number;\n};\n\n/** A post as a \"DiscussionForumPosting\". The caller gives this only for posts that anybody may see (not hidden, not erased). */\nexport function postJsonLd(input: PostLdInput, env: string | undefined = process.env.SITE_URL): Record<string, unknown> {\n  const url = absoluteUrl(`/post/${input.id}`, env);\n  const text = summarize(input.body, 500);\n  return {\n    \"@context\": \"https://schema.org\",\n    \"@type\": \"DiscussionForumPosting\",\n    \"@id\": url,\n    url,\n    mainEntityOfPage: url,\n    headline: cutText(input.title, 110),\n    ...(text ? { text } : {}),\n    datePublished: new Date(input.createdAtMs).toISOString(),\n    ...(input.author\n      ? { author: { \"@type\": \"Person\", name: input.author, url: absoluteUrl(`/u/${encodeURIComponent(input.author)}`, env) } }\n      : {}),\n    interactionStatistic: {\n      \"@type\": \"InteractionCounter\",\n      interactionType: \"https://schema.org/CommentAction\",\n      userInteractionCount: input.comments,\n    },\n  };\n}\n",
 "scripts/test-seo-jsonld.ts": "// Test: structured data of a post page (SEO stage 3). Run:  npm run test:seo-jsonld\n// Needs no database. Prints \"OK\" lines and stops with an error message at the first failure.\nimport assert from \"node:assert/strict\";\nimport { jsonLdString, postJsonLd } from \"../src/lib/seo-jsonld\";\n\nfunction ok(name: string) { console.log(\"OK  \" + name); }\nconst ENV = \"https://falvenco.com\";\n\n// ---- jsonLdString\nconst evil = jsonLdString({ a: \"</script><script>alert(1)</script> & more\", b: \"x\\u2028y\" });\nassert.ok(!evil.includes(\"<\") && !evil.includes(\">\") && !evil.includes(\"&\"), \"no tag characters in the output\");\nassert.ok(!evil.includes(\"\\u2028\"));\nassert.deepEqual(JSON.parse(evil), { a: \"</script><script>alert(1)</script> & more\", b: \"x\\u2028y\" }, \"the data comes back unchanged\");\nok(\"jsonLdString: a post can never close the script tag\");\n\n// ---- postJsonLd\nconst ld = postJsonLd({ id: 5, title: \"How do I fix X?\", body: \"Look at https://example.com/a first.\", author: \"maya\", createdAtMs: Date.UTC(2026, 10, 24, 5, 0, 0), comments: 3 }, ENV);\nassert.equal(ld[\"@type\"], \"DiscussionForumPosting\");\nassert.equal(ld.url, \"https://falvenco.com/post/5\");\nassert.equal(ld.headline, \"How do I fix X?\");\nassert.equal(ld.text, \"Look at first.\", \"web addresses are left out of the text\");\nassert.equal(ld.datePublished, \"2026-11-24T05:00:00.000Z\");\nassert.deepEqual(ld.author, { \"@type\": \"Person\", name: \"maya\", url: \"https://falvenco.com/u/maya\" });\nassert.deepEqual(ld.interactionStatistic, { \"@type\": \"InteractionCounter\", interactionType: \"https://schema.org/CommentAction\", userInteractionCount: 3 });\nok(\"postJsonLd: type, address, title, text, date, author, comment count\");\n\nconst noAuthor = postJsonLd({ id: 6, title: \"T\", body: \"\", author: \"\", createdAtMs: 0, comments: 0 }, ENV);\nassert.equal(\"author\" in noAuthor, false, \"no author given: none invented\");\nassert.equal(\"text\" in noAuthor, false, \"no text given: none invented\");\nok(\"postJsonLd: nothing is invented\");\n\nconst long = postJsonLd({ id: 7, title: \"word \".repeat(80), body: \"w \".repeat(1000), author: \"a\", createdAtMs: 0, comments: 0 }, ENV);\nassert.ok(Array.from(String(long.headline)).length <= 110);\nassert.ok(Array.from(String(long.text)).length <= 500);\nok(\"postJsonLd: long title and text are cut\");\nconsole.log(\"\\nAll SEO structured-data tests passed.\");\n"
};
const edits = [
 {
  "path": "src/app/(site)/post/[id]/page.tsx",
  "reps": [
   [
    "import { noIndexMetadata, pageMetadata } from \"@/lib/seo-text\";",
    "import { noIndexMetadata, pageMetadata } from \"@/lib/seo-text\";\nimport { jsonLdString, postJsonLd } from \"@/lib/seo-jsonld\";"
   ],
   [
    "      <PostCard post={post} full />\n",
    "      {/* Structured data for search engines (SEO stage 3): only for a post that anybody may see. */}\n      {!post.hidden && !post.deleted && post.title && post.author && (\n        <script\n          type=\"application/ld+json\"\n          dangerouslySetInnerHTML={{\n            __html: jsonLdString(postJsonLd({ id: post.id, title: post.title, body: post.body, author: post.author, createdAtMs: post.createdAtMs, comments: post.comments })),\n          }}\n        />\n      )}\n\n      <PostCard post={post} full />\n"
   ]
  ]
 },
 {
  "path": "src/components/profile/SideCards.tsx",
  "reps": [
   [
    "<a href={`https://${profile.website}`} target=\"_blank\" rel=\"noopener noreferrer\">",
    "<a href={`https://${profile.website}`} target=\"_blank\" rel=\"noopener noreferrer nofollow ugc\">"
   ]
  ]
 },
 {
  "path": "src/app/(site)/u/[username]/SampleProfile.tsx",
  "reps": [
   [
    "<a href={`https://${profile.website}`} target=\"_blank\" rel=\"noopener noreferrer\">",
    "<a href={`https://${profile.website}`} target=\"_blank\" rel=\"noopener noreferrer nofollow ugc\">"
   ]
  ]
 },
 {
  "path": "package.json",
  "reps": [
   [
    "    \"test:seo\": \"tsx scripts/test-seo.ts\",\n",
    "    \"test:seo\": \"tsx scripts/test-seo.ts\",\n    \"test:seo-jsonld\": \"tsx scripts/test-seo-jsonld.ts\",\n"
   ]
  ]
 }
];

if (undo) {
  if (!existsSync(BACKUP)) { console.error(`No ${BACKUP}/ folder: nothing to undo.`); process.exit(1); }
  for (const { path } of edits) {
    const saved = join(BACKUP, path);
    if (existsSync(saved)) { cpSync(saved, path); console.log(`RESTORED  ${path}`); }
  }
  for (const path of Object.keys(newFiles)) if (existsSync(path)) { rmSync(path); console.log(`REMOVED   ${path}`); }
  rmSync(BACKUP, { recursive: true, force: true });
  console.log("\nUndone. Run:  npm run build");
  process.exit(0);
}

if (!existsSync("src/lib/seo-text.ts")) {
  console.error("patch-seo-2 is not applied yet (src/lib/seo-text.ts is missing). Apply it first.");
  process.exit(1);
}
if (apply && existsSync(BACKUP)) {
  console.error(`${BACKUP}/ already exists: an earlier run was not finished. Run --undo first, or delete that folder if the build passed.`);
  process.exit(1);
}

let problems = 0;
const say = (verb, p, note = "") => console.log(`${apply ? verb[0] : verb[1]}  ${p}${note ? "  - " + note : ""}`);

// Work out every edit first; write nothing unless ALL of them fit.
const plan = [];
for (const { path, reps } of edits) {
  if (!existsSync(path)) { console.log(`SKIPPED  ${path}  - file not found`); problems++; continue; }
  let text = readFileSync(path, "utf8");
  if (reps.every(([, to]) => text.includes(to))) { console.log(`(already done)  ${path}`); continue; }
  let ok = true;
  for (const [from, to] of reps) {
    if (text.includes(to)) continue;
    const count = text.split(from).length - 1;
    if (count !== 1) { console.log(`SKIPPED  ${path}  - expected text not found exactly once (the file was changed): ${from.split("\n")[0].slice(0, 70)}`); ok = false; break; }
    text = text.replace(from, () => to);
  }
  if (!ok) { problems++; continue; }
  plan.push({ path, text });
}
const toCreate = Object.entries(newFiles).filter(([p, c]) => {
  if (!existsSync(p)) return true;
  if (readFileSync(p, "utf8") !== c) { console.log(`SKIPPED  ${p}  - a different file is already there, check by hand`); problems++; }
  return false;
});

if (problems && apply) {
  console.log(`\n${problems} thing(s) need a look (see SKIPPED above). Nothing was written.`);
  process.exit(1);
}
for (const [p] of toCreate) say(["CREATED", "would create"], p);
for (const { path } of plan) say(["CHANGED", "would change"], path);

if (apply) {
  for (const { path } of plan) { mkdirSync(dirname(join(BACKUP, path)), { recursive: true }); cpSync(path, join(BACKUP, path)); }
  for (const [p, c] of toCreate) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
  for (const { path, text } of plan) writeFileSync(path, text);
  console.log("\nNow run:  npm run test:seo-jsonld && npm run lint && npm run build");
  console.log(`If the build passes, delete the backup:  rm -rf ${BACKUP} apply-seo-3.mjs`);
  console.log("If the build complains, put everything back:  node apply-seo-3.mjs --undo   (then send me the error)");
} else {
  console.log(problems ? `\n${problems} thing(s) need a look.` : "\nNothing was changed. Run again with --apply to do it.");
}
