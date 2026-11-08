// Re-applies the patch-social-cache-tags change to src/lib/queries.ts WITHOUT touching anything else in the file.
// Usage (inside web/):  node apply-cache-tags-queries.mjs src/lib/queries.ts
import fs from "node:fs";
const file = process.argv[2] ?? "src/lib/queries.ts";
let s = fs.readFileSync(file, "utf8");
if (s.includes("social-cache-tags")) { console.log("already applied: " + file); process.exit(0); }

function once(label, oldText, newText) {
  const n = s.split(oldText).length - 1;
  if (n !== 1) { console.error(`STOP: "${label}" found ${n} times (need exactly 1). Nothing was written.`); process.exit(1); }
  s = s.replace(oldText, () => newText);
}

once("import", 'import { cacheLife, cacheTag } from "next/cache";\n',
  'import { cacheLife, cacheTag } from "next/cache";\nimport { socialPostTag } from "@/lib/social-cache-tags";\n');

once("getSocialPost tag",
  'export async function getSocialPost(id: number): Promise<SocialPostSummary | null> {\n  "use cache";\n  cacheLife("minutes");\n  cacheTag("social-posts");',
  'export async function getSocialPost(id: number): Promise<SocialPostSummary | null> {\n  "use cache";\n  cacheLife("minutes");\n  cacheTag("social-posts", socialPostTag(id)); // a like or a reply on THIS post refreshes only this page (social-cache-tags.ts)');

fs.writeFileSync(file, s);
console.log("applied: " + file);
