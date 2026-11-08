import fs from "node:fs";
const src = fs.readFileSync("apply-social-edit-history.mjs", "utf8");
const m = /const line = ("(?:[^"\\]|\\.)*");/.exec(src);
if (!m) { console.error("STOP: line not found in apply script"); process.exit(1); }
const line = JSON.parse(m[1]);
let s = fs.readFileSync("CHANGELOG.md", "utf8");
if (s.includes("patch-social-edit-history")) { console.log("already there"); process.exit(0); }
const at = /^- patch-/m.exec(s);
if (!at) { console.error("STOP: no patch line in CHANGELOG.md"); process.exit(1); }
fs.writeFileSync("CHANGELOG.md", s.slice(0, at.index) + line + s.slice(at.index));
console.log("added to CHANGELOG.md");
