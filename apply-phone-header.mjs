// Adds the phone header layout. Run in the project folder (where PROJECT.md is):   node apply-phone-header.mjs
// Only puts `import "./header-phone.css";` into web/src/app/layout.tsx (right after shell.css). Safe to run twice.
import fs from "node:fs";
const p = "web/src/app/layout.tsx";
if (!fs.existsSync("web/src/app/header-phone.css")) throw new Error("web/src/app/header-phone.css is missing: unzip the patch first");
let s = fs.readFileSync(p, "utf8");
if (s.includes('"./header-phone.css"')) { console.log("already  " + p); process.exit(0); }
const anchor = 'import "./shell.css";';
if (!s.includes(anchor)) throw new Error(p + ": cannot find " + anchor);
fs.writeFileSync(p, s.replace(anchor, anchor + '\nimport "./header-phone.css";'), "utf8");
console.log("changed  " + p);
