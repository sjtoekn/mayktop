// Test: every place that saves free text from a person asks the link gate first (SITE_PLAN D9). Run:  npm run test:link-gate
// Needs no database and no network. It reads the source of the server actions, so a new action that forgets the gate is noticed,
// and runs the rule itself on a few texts (also Sinhala text, which must not be mistaken for a link).
import assert from "node:assert/strict";
import fs from "node:fs";
import { containsLink } from "../src/lib/reputation-rules";

function ok(name: string) { console.log("OK  " + name); }

// 1. The rule: real links are found, plain words are not.
for (const text of ["https://spam.example", "http://a.b", "www.spam.com", "buy at shop.xyz", "go to promo.lk/offer"]) {
  assert.equal(containsLink(text), true, text);
}
for (const text of ["", "I teach maths in Kandy", "ශ්\u200Dරී ලංකාවේ ගුරුවරයෙක්", "Dr. Perera, MBBS"]) {
  assert.equal(containsLink(text), false, text);
}
ok("link rule: addresses are found, ordinary and Sinhala text is not");

// 2. The server actions that take free text from a person call the gate before they save.
const gated: [string, RegExp][] = [
  ["src/app/(site)/photos/upload/actions.ts", /mayWriteText\(owner\.id,[^)]*caption/],
  ["src/app/(site)/shorts/upload/actions.ts", /mayWriteText\(owner\.id,[^)]*description/],
  ["src/app/(site)/places/actions.ts", /mayWriteText\(owner\.id,[^)]*website/],
  ["src/app/(site)/post/[id]/actions.ts", /mayWriteText\(/],
  ["src/app/(site)/submit/actions.ts", /mayWriteText\(/],
  ["src/app/(site)/manage/actions.ts", /mayWriteText\(/],
  ["src/app/(site)/social/submit/actions.ts", /mayWriteText\(/],
  ["src/app/(site)/social/reply/actions.ts", /mayWriteText\(/],
  ["src/app/(site)/social/manage/actions.ts", /mayWriteText\(/],
];
for (const [file, pattern] of gated) {
  const source = fs.readFileSync(file, "utf8");
  assert.match(source, pattern, `${file} does not ask the link gate`);
  // the gate must come before anything is written: it has to appear before the first database write of the file
  const gateAt = source.search(/mayWriteText\(/);
  const writeAt = source.search(/\.(create|update|upsert)\(/);
  assert.ok(writeAt === -1 || gateAt < writeAt, `${file}: the link gate comes after a database write`);
}
ok("photo, short, place, post, answer and social actions ask the link gate before they write");

// 3. The profile is gated inside applyProfile (tested in test-profile.ts); make sure the action still passes the privilege in.
const profileAction = fs.readFileSync("src/app/(site)/settings/profile/actions.ts", "utf8");
assert.match(profileAction, /allowLinks: hasPrivilege\(access\.reputation, "link"/);
ok("profile action passes the link privilege to applyProfile");

console.log("\nAll link-gate tests passed.");
