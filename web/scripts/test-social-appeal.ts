// Test: appeal of a removed Social post / reply (SOCIAL_TODO 29). Run:  npm run test:social-appeal
// Needs no database: the pure rules (social-appeal-rules.ts + appeals-rules.ts) and the new texts in all six languages.
import assert from "node:assert/strict";
import { parseSocialKind, socialAppealPath, socialViewPath } from "../src/lib/social-appeal-rules";
import { checkDecideAppeal, checkFileContentAppeal } from "../src/lib/appeals-rules";
import { appealConfig } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

// ---- the kind and the addresses
assert.equal(parseSocialKind("post"), "post");
assert.equal(parseSocialKind("reply"), "reply");
assert.equal(parseSocialKind("comment"), null);
assert.equal(parseSocialKind(undefined), null);
assert.equal(parseSocialKind(5), null);
assert.equal(socialAppealPath("post", 12), "/appeal/social/post/12");
assert.equal(socialAppealPath("reply", 3), "/appeal/social/reply/3");
assert.equal(socialViewPath(12), "/social/12");
ok("only \"post\" and \"reply\" are accepted; the addresses are right");

// ---- who may appeal (same rule as community posts)
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const file = {
  appellantId: "u1", authorId: "u1", appellantActive: true, status: "REMOVED" as const, erased: false,
  removedAt: new Date(now - DAY), now, windowDays: appealConfig.windowDays, alreadyAppealed: false,
};
assert.equal(checkFileContentAppeal(file), null);
assert.equal(checkFileContentAppeal({ ...file, appellantId: "u2" }), "allowed");
assert.equal(checkFileContentAppeal({ ...file, appellantActive: false }), "actor");
assert.equal(checkFileContentAppeal({ ...file, status: "HIDDEN_PENDING_REVIEW" }), "state");
assert.equal(checkFileContentAppeal({ ...file, status: "VISIBLE" }), "state");
assert.equal(checkFileContentAppeal({ ...file, erased: true }), "state");
assert.equal(checkFileContentAppeal({ ...file, alreadyAppealed: true }), "exists");
assert.equal(checkFileContentAppeal({ ...file, removedAt: new Date(now - (appealConfig.windowDays + 1) * DAY) }), "window");
ok("appeal: only the author, only a REMOVED item, once, inside the window");

// ---- who may decide: a Social case has no community, so only an admin; never the author, the hider or the remover
const decide = {
  kind: "content" as const,
  appellantId: "author",
  deciderIds: ["adminA", "adminB"], // adminA hid it, adminB removed it
  status: "OPEN" as const,
};
const admin = (id: string) => ({ id, isAdmin: true, isCommunityModerator: false });
assert.equal(checkDecideAppeal({ ...decide, actor: admin("adminC") }), null);
assert.equal(checkDecideAppeal({ ...decide, actor: admin("adminA") }), "same");
assert.equal(checkDecideAppeal({ ...decide, actor: admin("adminB") }), "same");
assert.equal(checkDecideAppeal({ ...decide, actor: admin("author") }), "self");
assert.equal(checkDecideAppeal({ ...decide, actor: { id: "u9", isAdmin: false, isCommunityModerator: false } }), "allowed");
assert.equal(checkDecideAppeal({ ...decide, actor: admin("adminC"), status: "ACCEPTED" }), "state");
ok("decide: an admin who took part in neither step; not the author; not an ordinary person; only an open appeal");

// ---- the honest consequence: with only two admins nobody can decide
for (const id of ["adminA", "adminB"]) assert.notEqual(checkDecideAppeal({ ...decide, actor: admin(id) }), null);
ok("with only two admins (hider + remover) no one is left to decide: at least THREE admins are needed");

// ---- the new texts exist in all six languages and keep their {placeholders}
const keys = [
  "appeal.social.what.post", "appeal.social.what.reply", "admin.appeals.social.post", "admin.appeals.social.reply",
  "email.socialappeal.line", "email.appeal.social.accepted.body", "email.appeal.social.rejected.body",
] as const;
const needs: Record<string, string[]> = {
  "appeal.social.what.post": ["{excerpt}"],
  "appeal.social.what.reply": ["{excerpt}"],
  "email.socialappeal.line": ["{days}", "{url}"],
  "email.appeal.social.accepted.body": ["{name}", "{excerpt}", "{note}", "{url}"],
  "email.appeal.social.rejected.body": ["{name}", "{excerpt}", "{rule}", "{note}", "{url}"],
};
const languages: Record<string, Record<string, string | undefined>> = { en, es, fr, zh, hi, ar };
for (const [lang, messages] of Object.entries(languages)) {
  for (const key of keys) {
    const text = messages[key] ?? "";
    assert.ok(text.length > 0, `${lang}: missing ${key}`);
    for (const placeholder of needs[key] ?? []) assert.ok(text.includes(placeholder), `${lang}: ${key} lost ${placeholder}`);
  }
}
ok("7 new texts in six languages, placeholders kept");

console.log("\nAll social appeal checks passed.");
