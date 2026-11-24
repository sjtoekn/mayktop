// Test: the kinds of a post (SITE_PLAN A3). Run:  npm run test:post-kind
// Needs no database. Prints "OK" lines and stops with an error message at the first failure.
import assert from "node:assert/strict";
import { postKinds, postLimits } from "../src/config/site";
import { checkPostInput, parseVideoUrl, postKindOf } from "../src/lib/post-input-rules";

function ok(name: string) { console.log("OK  " + name); }

assert.equal(new Set(postKinds).size, postKinds.length, "no kind twice");
assert.deepEqual([...postKinds], ["question", "article", "video"]);
ok("the kind list: question, article, video, no duplicates");

assert.equal(postKindOf("video"), "video");
for (const old of [undefined, null, "", "poll", "Video"]) assert.equal(postKindOf(old as string | null | undefined), "question");
ok("an older post or an unknown key is a question");

// Question: title needed, text optional.
let r = checkPostInput({ kind: "question", title: "  How do I register a deed?  ", body: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ" });
assert.ok(r.ok && r.value.title === "How do I register a deed?" && r.value.body === "" && r.value.videoUrl === null);
ok("a question: text optional, a sent video address is dropped");
assert.deepEqual(checkPostInput({ kind: "question", title: "   ", body: "x" }), { ok: false, error: "title" });
assert.deepEqual(checkPostInput({ kind: "question", title: "a".repeat(postLimits.titleMax + 1), body: "" }), { ok: false, error: "title" });
assert.deepEqual(checkPostInput({ kind: "question", title: "ok", body: "a".repeat(postLimits.bodyMax + 1) }), { ok: false, error: "body" });
ok("title and length limits");

// Article: needs real text.
assert.deepEqual(checkPostInput({ kind: "article", title: "A guide", body: "too short" }), { ok: false, error: "bodyShort" });
r = checkPostInput({ kind: "article", title: "A guide", body: "x".repeat(postLimits.articleBodyMin) });
assert.ok(r.ok && r.value.kind === "article");
ok("an article needs at least " + postLimits.articleBodyMin + " characters of text");

// Video: only a YouTube or Vimeo https address; it is rebuilt from the id.
for (const good of [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
  "https://youtu.be/dQw4w9WgXcQ?si=abc",
  "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/shorts/dQw4w9WgXcQ",
]) {
  const ref = parseVideoUrl(good);
  assert.ok(ref && ref.provider === "youtube" && ref.id === "dQw4w9WgXcQ", good);
  assert.equal(ref.watchUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(ref.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
}
const vimeo = parseVideoUrl("https://vimeo.com/76979871");
assert.ok(vimeo && vimeo.provider === "vimeo" && vimeo.embedUrl === "https://player.vimeo.com/video/76979871");
ok("YouTube and Vimeo addresses are read and rebuilt from the id");

for (const bad of [
  "", "not a url", "http://youtu.be/dQw4w9WgXcQ", "https://evil.com/watch?v=dQw4w9WgXcQ",
  "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ\"onload=x", "javascript:alert(1)", "https://user:pw@youtu.be/dQw4w9WgXcQ",
  "https://vimeo.com/channels/staffpicks", "https://www.youtube.com/", "https://youtu.be/" + "a".repeat(400),
]) assert.equal(parseVideoUrl(bad), null, bad);
ok("another site, http, a fake host, a bad id or a very long address is refused");

r = checkPostInput({ kind: "video", title: "Deed walkthrough", body: "", videoUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc" });
assert.ok(r.ok && r.value.videoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
assert.deepEqual(checkPostInput({ kind: "video", title: "No link", body: "", videoUrl: null }), { ok: false, error: "video" });
assert.deepEqual(checkPostInput({ kind: "video", title: "Bad link", body: "", videoUrl: "https://example.com/v" }), { ok: false, error: "video" });
ok("a video post needs a good address and saves the cleaned one");

for (const bad of [undefined, "", "poll", "Question", 3, null]) assert.deepEqual(checkPostInput({ kind: bad, title: "t", body: "" }), { ok: false, error: "kind" });
assert.deepEqual(checkPostInput({ kind: "question", title: 5, body: "" }), { ok: false, error: "title" });
ok("an unknown kind or a wrong type is refused");
console.log("\nAll post-kind tests passed.");
