// Test: Report a Social reply / a Social account (patch-social-report-more). Run:  npm run test:social-report-more
// Needs no database: the pure rules in social-report-more-rules.ts, and applySocialReplyReport() / applySocialAccountReport()
// against a small stand-in for the database.
import assert from "node:assert/strict";
import { checkAccountClose, checkSocialAccountReport, checkSocialReplyReport } from "../src/lib/social-report-more-rules";
import { applySocialAccountReport, applySocialReplyReport } from "../src/lib/social-report-more";
import { socialReportConfig, staffConfig } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

const reason = "z".repeat(socialReportConfig.minReason);
const note = "n".repeat(staffConfig.minReasonLength);

// ---- report a reply: the rules
const replyBase = {
  reporterId: "r1", authorId: "u1", status: "VISIBLE" as const, erased: false, authorShown: true, parentShown: true,
  siteRule: "HATE", reason,
};
assert.deepEqual(checkSocialReplyReport(replyBase), { ok: true, siteRule: "HATE", reason });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, reporterId: "u1" }), { error: "self" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, status: "HIDDEN_PENDING_REVIEW" }), { error: "notfound" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, status: "REMOVED" }), { error: "notfound" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, erased: true }), { error: "notfound" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, authorShown: false }), { error: "notfound" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, parentShown: false }), { error: "notfound" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, siteRule: "NOPE" }), { error: "invalid" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, reason: "ab" }), { error: "invalid" });
assert.deepEqual(checkSocialReplyReport({ ...replyBase, reason: "q".repeat(socialReportConfig.maxReason + 1) }), { error: "invalid" });
ok("report a reply: the reply AND its post may be shown, not your own, a site rule, a reason of the right length");

// ---- report an account: the rules
const accountBase = { reporterId: "r1", reportedId: "u1", shown: true, siteRule: "SPAM", reason };
assert.deepEqual(checkSocialAccountReport(accountBase), { ok: true, siteRule: "SPAM", reason });
assert.deepEqual(checkSocialAccountReport({ ...accountBase, reporterId: "u1" }), { error: "self" });
assert.deepEqual(checkSocialAccountReport({ ...accountBase, shown: false }), { error: "notfound" });
assert.deepEqual(checkSocialAccountReport({ ...accountBase, siteRule: "nope" }), { error: "invalid" });
assert.deepEqual(checkSocialAccountReport({ ...accountBase, siteRule: undefined }), { error: "invalid" });
assert.deepEqual(checkSocialAccountReport({ ...accountBase, reason: "" }), { error: "invalid" });
ok("report an account: not yourself, an account that may be shown, a site rule, a reason");

// ---- closing the reports about an account
const closeBase = { actorId: "a1", actorIsAdmin: true, reportedId: "u1", note };
assert.deepEqual(checkAccountClose(closeBase), { ok: true, note });
assert.deepEqual(checkAccountClose({ ...closeBase, actorIsAdmin: false }), { error: "allowed" });
assert.deepEqual(checkAccountClose({ ...closeBase, actorId: "u1" }), { error: "self" });
assert.deepEqual(checkAccountClose({ ...closeBase, note: "no" }), { error: "reason" });
assert.deepEqual(checkAccountClose({ ...closeBase, note: "m".repeat(staffConfig.maxReasonLength + 1) }), { error: "reason" });
ok("close account reports: an admin, not the reported person, a written note");

async function main() {
  // ---- applySocialReplyReport against a stand-in for the database
  type ReplyRow = {
    id: number; authorId: string; status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED"; deletedAt: Date | null;
    author: { status: string; deletedAt: Date | null };
    socialPost: { status: string; deletedAt: Date | null; author: { status: string; deletedAt: Date | null } };
  };
  type ReportRow = { reporterId: string; socialReplyId?: number; reportedUserId?: string; siteRule: string; reason: string };
  type UserRow = { id: string; username: string; status: string; deletedAt: Date | null };
  function fakeDb(replies: ReplyRow[], users: UserRow[] = []) {
    const reports: ReportRow[] = [];
    const db = {
      socialReply: { findUnique: async ({ where }: { where: { id: number } }) => replies.find((r) => r.id === where.id) ?? null },
      user: { findUnique: async ({ where }: { where: { username: string } }) => users.find((u) => u.username === where.username) ?? null },
      report: {
        findFirst: async ({ where }: { where: { reporterId: string; socialReplyId?: number; reportedUserId?: string } }) =>
          reports.find((r) => r.reporterId === where.reporterId && r.socialReplyId === where.socialReplyId && r.reportedUserId === where.reportedUserId) ?? null,
        create: async ({ data }: { data: ReportRow }) => { reports.push({ ...data }); return data; },
      },
    };
    return { db: db as never, reports };
  }
  const live = { status: "ACTIVE", deletedAt: null };
  const shown: ReplyRow = { id: 7, authorId: "u1", status: "VISIBLE", deletedAt: null, author: live, socialPost: { status: "VISIBLE", deletedAt: null, author: live } };
  const input = { reporterId: "r1", socialReplyId: 7, siteRule: "SPAM", reason: "this is spam" };

  {
    const { db, reports } = fakeDb([shown]);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: true, created: true });
    assert.equal(reports.length, 1);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: true, created: false }); // second click: nothing new
    assert.equal(reports.length, 1);
    assert.deepEqual(await applySocialReplyReport(db, { ...input, reporterId: "r2" }), { ok: true, created: true }); // another person
    assert.equal(reports.length, 2);
    assert.deepEqual(await applySocialReplyReport(db, { ...input, reporterId: "u1" }), { ok: false, reason: "self" });
    assert.deepEqual(await applySocialReplyReport(db, { ...input, socialReplyId: 99 }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialReplyReport(db, { ...input, reporterId: "r3", reason: "x" }), { ok: false, reason: "invalid" });
    assert.equal(reports.length, 2);
  }
  {
    const { db, reports } = fakeDb([{ ...shown, status: "REMOVED" }]);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: false, reason: "notfound" });
    assert.equal(reports.length, 0);
  }
  {
    // the post under the reply is hidden: what a person cannot see, they cannot report
    const { db } = fakeDb([{ ...shown, socialPost: { ...shown.socialPost, status: "HIDDEN_PENDING_REVIEW" } }]);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: false, reason: "notfound" });
  }
  {
    const { db } = fakeDb([{ ...shown, socialPost: { ...shown.socialPost, author: { status: "DELETED", deletedAt: new Date() } } }]);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: false, reason: "notfound" });
  }
  {
    const { db } = fakeDb([{ ...shown, author: { status: "DELETION_PENDING", deletedAt: null } }]);
    assert.deepEqual(await applySocialReplyReport(db, input), { ok: false, reason: "notfound" });
  }
  ok("applySocialReplyReport: one report per person per reply, nothing for hidden / removed / erased replies or hidden posts");

  // ---- applySocialAccountReport
  const ann: UserRow = { id: "u1", username: "ann", status: "ACTIVE", deletedAt: null };
  const accountInput = { reporterId: "r1", username: "ann", siteRule: "HARASSMENT", reason: "keeps attacking people" };
  {
    const { db, reports } = fakeDb([], [ann]);
    assert.deepEqual(await applySocialAccountReport(db, accountInput), { ok: true, created: true });
    assert.deepEqual(await applySocialAccountReport(db, accountInput), { ok: true, created: false });
    assert.equal(reports.length, 1);
    assert.equal(reports[0].reportedUserId, "u1");
    assert.deepEqual(await applySocialAccountReport(db, { ...accountInput, reporterId: "u1" }), { ok: false, reason: "self" });
    assert.deepEqual(await applySocialAccountReport(db, { ...accountInput, username: "nobody" }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialAccountReport(db, { ...accountInput, reporterId: "r2", siteRule: "NOPE" }), { ok: false, reason: "invalid" });
    assert.equal(reports.length, 1);
  }
  {
    // a suspended account may still be reported (its posts are shown); a deleted or deleting one may not
    const { db } = fakeDb([], [{ ...ann, status: "SUSPENDED" }]);
    assert.deepEqual(await applySocialAccountReport(db, accountInput), { ok: true, created: true });
  }
  {
    const { db } = fakeDb([], [{ ...ann, status: "DELETED", deletedAt: new Date() }]);
    assert.deepEqual(await applySocialAccountReport(db, accountInput), { ok: false, reason: "notfound" });
    const pending = fakeDb([], [{ ...ann, status: "DELETION_PENDING" }]);
    assert.deepEqual(await applySocialAccountReport(pending.db, accountInput), { ok: false, reason: "notfound" });
  }
  ok("applySocialAccountReport: one report per person per account, not yourself, nothing for deleted accounts");
}

// ---- texts exist in all six languages
const keys = Object.keys(en).filter((k) =>
  k.startsWith("social.report.reply") || k.startsWith("social.report.account") || k.startsWith("email.socialreply.") ||
  k.startsWith("admin.social.replies.") || k.startsWith("admin.social.replyPending.") || k.startsWith("admin.social.accounts.") ||
  k.startsWith("admin.social.reply.") || k.startsWith("admin.social.account.") || k === "social.report.account" ||
  k === "admin.social.err.notfoundMore" || ["hideReply", "removeReply", "dismissMore", "handled"].some((s) => k === "admin.social.sure." + s));
assert.equal(keys.length, 30, "expected 30 new texts in en.ts, found " + keys.length);
for (const [name, messages] of Object.entries({ es, fr, zh, hi, ar })) {
  for (const key of keys) assert.ok((messages as Record<string, string>)[key], `${name} is missing ${key}`);
}
// every {placeholder} of the English text is also in the other languages
for (const [name, messages] of Object.entries({ es, fr, zh, hi, ar })) {
  for (const key of keys) {
    const want = [...(en as Record<string, string>)[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const got = [...(messages as Record<string, string>)[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    assert.equal(got, want, `${name}: placeholders of ${key} differ`);
  }
}
ok("the new texts exist in all six languages, with the same {placeholders}");

main()
  .then(() => console.log(`\n${count} groups of checks passed.`))
  .catch((error) => { console.error(error); process.exit(1); });
