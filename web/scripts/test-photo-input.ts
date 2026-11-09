// Tests for what a person types when uploading a photo (PHOTO_TODO 4): `npm run test:photo-input`. No database, no disk.
import { photoCategories, photoText } from "../src/config/site";
import { cleanPhotoCaption, cleanPhotoTitle, parsePhotoCategory, parsePhotoTags } from "../src/lib/photo-input";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
const title = (v: unknown) => cleanPhotoTitle(v);
const caption = (v: unknown) => cleanPhotoCaption(v);
const tags = (v: unknown) => parsePhotoTags(v);

// ---------------------------------------------------------------- title
check("a normal title is kept", (() => { const r = title("Sunset at the beach"); return r.ok && r.title === "Sunset at the beach"; })());
check("title: spaces at the ends are removed", (() => { const r = title("   Hello  "); return r.ok && r.title === "Hello"; })());
check("title: new lines and tabs become one space", (() => { const r = title("A\nB\t\tC\r\nD"); return r.ok && r.title === "A B C D"; })());
check("title: control and bidi override characters are removed", (() => { const r = title("a\u0000b\u202Ec\u2066d"); return r.ok && r.title === "abcd"; })());
check("title: Sinhala zero-width joiner stays", (() => { const r = title("ශ්\u200Dරී ලංකා"); return r.ok && r.title.includes("\u200D"); })());
check("title: empty is refused (empty)", (() => { const r = title(""); return !r.ok && r.reason === "empty"; })());
check("title: only spaces / zero-width characters is refused (empty)", (() => { const r = title(" \u200B\u200D \n"); return !r.ok && r.reason === "empty"; })());
check("title: not a string is refused (type)", (() => { const r = title(null); return !r.ok && r.reason === "type"; })());
check("title: exactly titleMax is fine, one more is refused (long)", (() => {
  const ok = title("a".repeat(photoText.titleMax));
  const bad = title("a".repeat(photoText.titleMax + 1));
  return ok.ok && !bad.ok && bad.reason === "long";
})());
check("title: an absurdly long value is refused before anything else (long)", (() => { const r = title("a".repeat(30_000)); return !r.ok && r.reason === "long"; })());

// ---------------------------------------------------------------- caption
check("caption: normal text keeps its new lines", (() => { const r = caption("Line one\nLine two"); return r.ok && r.caption === "Line one\nLine two"; })());
check("caption: more than two empty lines in a row become two", (() => { const r = caption("a\n\n\n\n\n\nb"); return r.ok && r.caption === "a\n\n\nb"; })());
check("caption: empty, spaces only, zero-width only and null all mean no caption", [caption(""), caption("  \n "), caption("\u200B"), caption(null), caption(undefined)].every((r) => r.ok && r.caption === null));
check("caption: not a string is refused (type)", (() => { const r = caption(5); return !r.ok && r.reason === "type"; })());
check("caption: control characters are removed", (() => { const r = caption("x\u0000y\u202Az"); return r.ok && r.caption === "xyz"; })());
check("caption: exactly captionMax is fine, one more is refused", (() => {
  const ok = caption("a".repeat(photoText.captionMax));
  const bad = caption("a".repeat(photoText.captionMax + 1));
  return ok.ok && !bad.ok && bad.reason === "long";
})());

// ---------------------------------------------------------------- tags
check("tags: empty, null and only separators give no tags", [tags(""), tags(null), tags(undefined), tags(" , ;\n")].every((r) => r.ok && r.tags.length === 0));
check("tags: comma separated", (() => { const r = tags("sunset, beach"); return r.ok && r.tags.join("|") === "sunset|beach"; })());
check("tags: spaces, semicolons and new lines also separate", (() => { const r = tags("a1 b2;c3\nd4"); return r.ok && r.tags.join("|") === "a1|b2|c3|d4"; })());
check("tags: a leading # is allowed and removed", (() => { const r = tags("#sunset, ##beach"); return r.ok && r.tags.join("|") === "sunset|beach"; })());
check("tags: saved in lower case", (() => { const r = tags("Colombo, SRI_LANKA"); return r.ok && r.tags.join("|") === "colombo|sri_lanka"; })());
check("tags: the same tag twice counts once (also in a different case)", (() => { const r = tags("Beach, beach, #BEACH"); return r.ok && r.tags.length === 1 && r.tags[0] === "beach"; })());
check("tags: Sinhala and other scripts work (with combining marks)", (() => { const r = tags("කොළඹ, समुद्र"); return r.ok && r.tags.length === 2; })());
check("tags: numbers only is refused (invalid)", (() => { const r = tags("123"); return !r.ok && r.reason === "invalid"; })());
check("tags: a tag with a dot or a slash is refused, not cut short (invalid)", [tags("a.b"), tags("beach/sun"), tags("a&b")].every((r) => !r.ok && r.reason === "invalid"));
check("tags: one bad tag refuses the whole list (nothing is silently dropped)", (() => { const r = tags("good, bad!"); return !r.ok && r.reason === "invalid"; })());
check("tags: a tag of 50 characters is fine, 51 is refused", (() => {
  const ok = tags("a".repeat(50));
  const bad = tags("a".repeat(51));
  return ok.ok && !bad.ok && bad.reason === "invalid";
})());
check("tags: exactly maxTags different tags is fine, one more is refused (many)", (() => {
  const make = (n: number) => Array.from({ length: n }, (_, i) => `tag${String.fromCharCode(97 + i)}`).join(", ");
  const ok = tags(make(photoText.maxTags));
  const bad = tags(make(photoText.maxTags + 1));
  return ok.ok && ok.tags.length === photoText.maxTags && !bad.ok && bad.reason === "many";
})());
check("tags: not a string is refused (type)", (() => { const r = tags(42); return !r.ok && r.reason === "type"; })());

// ---------------------------------------------------------------- category
check("category: the list has 10 different keys and ends with 'other'", photoCategories.length === 10 && new Set(photoCategories).size === 10 && photoCategories[photoCategories.length - 1] === "other");
check("category: every key in the list is accepted", photoCategories.every((key) => { const r = parsePhotoCategory(key); return r.ok && r.category === key; }));
check("category: an unknown key is refused (invalid), never changed into 'other'", [parsePhotoCategory("cars"), parsePhotoCategory("Nature"), parsePhotoCategory(" nature"), parsePhotoCategory("nature "), parsePhotoCategory("")].every((r) => !r.ok && r.reason === "invalid"));
check("category: not a string is refused (type)", [parsePhotoCategory(null), parsePhotoCategory(undefined), parsePhotoCategory(3)].every((r) => !r.ok && r.reason === "type"));
check("category: object property names are not categories (invalid)", [parsePhotoCategory("constructor"), parsePhotoCategory("__proto__"), parsePhotoCategory("toString")].every((r) => !r.ok && r.reason === "invalid"));

console.log(failed === 0 ? "\nAll photo-input tests passed." : `\n${failed} test(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
