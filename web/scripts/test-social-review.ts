// Test: Social moderation and Report rules (SOCIAL_TODO 27 + 30). Run:  npm run test:social-review
// Needs no database: the pure rules in social-review-rules.ts, and applySocialReport() against a small stand-in.
import assert from "node:assert/strict";
import {
  checkSocialDecide,
  checkSocialDismiss,
  checkSocialHide,
  checkSocialReport,
  isSiteRuleKey,
} from "../src/lib/social-review-rules";
import { applySocialReport } from "../src/lib/social-report";
import { socialReportConfig, staffConfig } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

const reason = "x".repeat(staffConfig.minReasonLength);
const hideBase = { actorId: "a1", actorIsAdmin: true, authorId: "u1", status: "VISIBLE" as const, erased: false, siteRule: "SPAM", reason };

// ---- site rule keys
assert.equal(isSiteRuleKey("SPAM"), true);
assert.equal(isSiteRuleKey("PRIVACY"), true);
assert.equal(isSiteRuleKey("spam"), false);
assert.equal(isSiteRuleKey(""), false);
assert.equal(isSiteRuleKey(5), false);
ok("only the site-wide rule keys are accepted");

// ---- hide
assert.deepEqual(checkSocialHide(hideBase), { ok: true, siteRule: "SPAM", reason });
assert.deepEqual(checkSocialHide({ ...hideBase, reason: "short" }), { error: "reason" });
assert.deepEqual(checkSocialHide({ ...hideBase, reason: "y".repeat(staffConfig.maxReasonLength + 1) }), { error: "reason" });
assert.deepEqual(checkSocialHide({ ...hideBase, actorIsAdmin: false }), { error: "allowed" });
assert.deepEqual(checkSocialHide({ ...hideBase, authorId: "a1" }), { error: "self" });
assert.deepEqual(checkSocialHide({ ...hideBase, status: "HIDDEN_PENDING_REVIEW" }), { error: "state" });
assert.deepEqual(checkSocialHide({ ...hideBase, status: "REMOVED" }), { error: "state" });
assert.deepEqual(checkSocialHide({ ...hideBase, erased: true }), { error: "state" });
assert.deepEqual(checkSocialHide({ ...hideBase, siteRule: "NOPE" }), { error: "rule" });
assert.deepEqual(checkSocialHide({ ...hideBase, siteRule: undefined }), { error: "rule" });
ok("hide: admin only, not your own post, only a visible post, a site rule and a written reason");

// ---- decide
const decideBase = { actorId: "a2", actorIsAdmin: true, authorId: "u1", hiderId: "a1", status: "HIDDEN_PENDING_REVIEW" as const, note: reason };
assert.deepEqual(checkSocialDecide(decideBase), { ok: true, note: reason });
assert.deepEqual(checkSocialDecide({ ...decideBase, actorId: "a1" }), { error: "same" });
assert.deepEqual(checkSocialDecide({ ...decideBase, actorId: "u1" }), { error: "self" });
assert.deepEqual(checkSocialDecide({ ...decideBase, actorIsAdmin: false }), { error: "allowed" });
assert.deepEqual(checkSocialDecide({ ...decideBase, status: "VISIBLE" }), { error: "state" });
assert.deepEqual(checkSocialDecide({ ...decideBase, status: "REMOVED" }), { error: "state" });
assert.deepEqual(checkSocialDecide({ ...decideBase, note: "no" }), { error: "reason" });
assert.deepEqual(checkSocialDecide({ ...decideBase, hiderId: null }), { ok: true, note: reason });
ok("decide: a DIFFERENT admin than the one who hid it, not the author, a written note");

// ---- dismiss
const dismissBase = { actorId: "a2", actorIsAdmin: true, authorId: "u1", status: "VISIBLE" as const, note: reason };
assert.deepEqual(checkSocialDismiss(dismissBase), { ok: true, note: reason });
assert.deepEqual(checkSocialDismiss({ ...dismissBase, actorIsAdmin: false }), { error: "allowed" });
assert.deepEqual(checkSocialDismiss({ ...dismissBase, actorId: "u1" }), { error: "self" });
assert.deepEqual(checkSocialDismiss({ ...dismissBase, status: "HIDDEN_PENDING_REVIEW" }), { error: "state" });
assert.deepEqual(checkSocialDismiss({ ...dismissBase, note: "" }), { error: "reason" });
ok("dismiss reports: admin, not the author, post still visible, a written note");

// ---- report rules
const reportBase = {
  reporterId: "r1", authorId: "u1", status: "VISIBLE" as const, erased: false, authorShown: true,
  siteRule: "HATE", reason: "z".repeat(socialReportConfig.minReason),
};
assert.deepEqual(checkSocialReport(reportBase), { ok: true, siteRule: "HATE", reason: reportBase.reason });
assert.deepEqual(checkSocialReport({ ...reportBase, reporterId: "u1" }), { error: "self" });
assert.deepEqual(checkSocialReport({ ...reportBase, status: "HIDDEN_PENDING_REVIEW" }), { error: "notfound" });
assert.deepEqual(checkSocialReport({ ...reportBase, status: "REMOVED" }), { error: "notfound" });
assert.deepEqual(checkSocialReport({ ...reportBase, erased: true }), { error: "notfound" });
assert.deepEqual(checkSocialReport({ ...reportBase, authorShown: false }), { error: "notfound" });
assert.deepEqual(checkSocialReport({ ...reportBase, siteRule: "NOPE" }), { error: "invalid" });
assert.deepEqual(checkSocialReport({ ...reportBase, reason: "ab" }), { error: "invalid" });
assert.deepEqual(checkSocialReport({ ...reportBase, reason: "q".repeat(socialReportConfig.maxReason + 1) }), { error: "invalid" });
ok("report: a post that may be shown, not your own, a site rule, a reason of the right length");

async function main() {
  // ---- applySocialReport against a stand-in for the database
  type PostRow = { id: number; authorId: string; status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED"; deletedAt: Date | null; author: { status: string; deletedAt: Date | null } };
  type ReportRow = { reporterId: string; socialPostId: number; siteRule: string; reason: string };
  function fakeDb(posts: PostRow[]) {
    const reports: ReportRow[] = [];
    const db = {
      socialPost: { findUnique: async ({ where }: { where: { id: number } }) => posts.find((p) => p.id === where.id) ?? null },
      report: {
        findFirst: async ({ where }: { where: { reporterId: string; socialPostId: number } }) =>
          reports.find((r) => r.reporterId === where.reporterId && r.socialPostId === where.socialPostId) ?? null,
        create: async ({ data }: { data: ReportRow }) => { reports.push({ ...data }); return data; },
      },
    };
    return { db: db as never, reports };
  }
  const shown: PostRow = { id: 1, authorId: "u1", status: "VISIBLE", deletedAt: null, author: { status: "ACTIVE", deletedAt: null } };
  const input = { reporterId: "r1", socialPostId: 1, siteRule: "SPAM", reason: "this is spam" };

  {
    const { db, reports } = fakeDb([shown]);
    assert.deepEqual(await applySocialReport(db, input), { ok: true, created: true });
    assert.equal(reports.length, 1);
    assert.deepEqual(await applySocialReport(db, input), { ok: true, created: false }); // second click: nothing new
    assert.equal(reports.length, 1);
    assert.deepEqual(await applySocialReport(db, { ...input, reporterId: "r2" }), { ok: true, created: true }); // another person
    assert.equal(reports.length, 2);
    assert.deepEqual(await applySocialReport(db, { ...input, reporterId: "u1", socialPostId: 1 }), { ok: false, reason: "self" });
    assert.deepEqual(await applySocialReport(db, { ...input, socialPostId: 99 }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialReport(db, { ...input, reporterId: "r3", reason: "x" }), { ok: false, reason: "invalid" });
    assert.equal(reports.length, 2);
  }
  {
    const { db, reports } = fakeDb([{ ...shown, status: "REMOVED" }]);
    assert.deepEqual(await applySocialReport(db, input), { ok: false, reason: "notfound" });
    assert.equal(reports.length, 0);
  }
  {
    const { db } = fakeDb([{ ...shown, author: { status: "DELETED", deletedAt: new Date() } }]);
    assert.deepEqual(await applySocialReport(db, input), { ok: false, reason: "notfound" });
  }
  ok("applySocialReport: one report per person per post, nothing for hidden / removed / erased posts");


}

// ---- texts exist in all six languages
const keys = Object.keys(en).filter((k) =>
  k.startsWith("social.report") || k.startsWith("admin.social.") || k.startsWith("email.socialreview.") || k === "admin.nav.social");
assert.ok(keys.length >= 30, "expected the new texts in en.ts");
for (const [name, messages] of Object.entries({ es, fr, zh, hi, ar })) {
  for (const key of keys) assert.ok((messages as Record<string, string>)[key], `${name} is missing ${key}`);
}
ok("the new texts exist in all six languages");

main()
  .then(() => console.log(`\n${count} groups of checks passed.`))
  .catch((error) => { console.error(error); process.exit(1); });
