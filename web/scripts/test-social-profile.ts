// Test: the Social profile page rules (SOCIAL_TODO 2). Run:  npm run test:social-profile
// Needs no database: the rules are plain functions (src/lib/social-profile.ts).
import assert from "node:assert/strict";
import { PROFILE_TABS, PROFILE_USERNAME_PATTERN, parseProfileTab, parseProfileUsername, profileHref } from "../src/lib/social-profile";
import fs from "node:fs";
import path from "node:path";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

// ---- username from the URL
assert.equal(parseProfileUsername("ann_1"), "ann_1");
assert.equal(parseProfileUsername("  Ann_1 "), "ann_1");
for (const bad of [undefined, null, 5, "", "ab", "a".repeat(21), "ann-1", "ann.1", "ann/1", "ann 1", "../x", "ann%20", ["ann"]]) {
  assert.equal(parseProfileUsername(bad), null, String(bad));
}
ok("username: lower case letters, numbers and underscore, 3-20; anything else is not a profile");

// read as text: importing auth.ts would load the sign-in code
const authSource = fs.readFileSync(path.join(process.cwd(), "src/lib/auth.ts"), "utf8");
const signUpRule = /export const USERNAME_PATTERN = \/(.+)\/;/.exec(authSource);
assert.ok(signUpRule, "USERNAME_PATTERN not found in src/lib/auth.ts");
assert.equal(PROFILE_USERNAME_PATTERN.source, signUpRule[1]);
ok("the profile username rule is the same as the sign-up rule");

// ---- tabs
for (const tab of PROFILE_TABS) assert.equal(parseProfileTab(tab, true), tab);
assert.equal(parseProfileTab("likes", false), "posts");
for (const tab of PROFILE_TABS.filter((tab) => tab !== "likes")) assert.equal(parseProfileTab(tab, false), tab);
for (const bad of [undefined, null, "", "Posts", "media", "likes ", ["likes"], 3]) {
  assert.equal(parseProfileTab(bad, true), "posts", String(bad));
}
ok("tabs: unknown means posts; likes only on your own profile");

// ---- addresses
assert.equal(profileHref("ann"), "/social/u/ann");
assert.equal(profileHref("ann", "posts"), "/social/u/ann");
assert.equal(profileHref("ann", "followers"), "/social/u/ann?tab=followers");
ok("addresses: the first tab has no ?tab");

// ---- texts
const keys = [
  "social.profile.title", "social.profile.tabs.label", "social.profile.tab.posts", "social.profile.tab.replies",
  "social.profile.tab.likes", "social.profile.tab.followers", "social.profile.tab.following", "social.profile.joined",
  "social.profile.you", "social.profile.posts.other", "social.profile.followers.other", "social.profile.followingCount.other",
  "social.profile.empty.posts", "social.profile.empty.replies", "social.profile.empty.likes", "social.profile.empty.followers",
  "social.profile.empty.following", "social.profile.replyingTo", "social.profile.likesPrivate", "social.profile.limit",
];
for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
  for (const key of keys) assert.ok((messages as Record<string, string>)[key], `${name}: ${key}`);
}
ok("the new texts exist in all six languages");

console.log(`\n${count} groups of checks passed.`);
