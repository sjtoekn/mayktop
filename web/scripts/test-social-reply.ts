// Test: replies to a Social post (SOCIAL_TODO 18) and the notification types (SOCIAL_TODO 21). Run:  npm run test:social-reply
// Needs no database: applySocialReply() / applySocialReplyDelete() are run against a small in-memory stand-in.
import assert from "node:assert/strict";
import { applySocialReply, applySocialReplyDelete, cleanReplyBody, REPLY_NOTIFICATION } from "../src/lib/social-reply";
import { socialReplyConfig } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

// ---- text rules
assert.deepEqual(cleanReplyBody("  hello  "), { ok: true, body: "hello" });
assert.deepEqual(cleanReplyBody("   \n\u200B  "), { ok: false, reason: "empty" });
assert.deepEqual(cleanReplyBody(42), { ok: false, reason: "type" });
assert.deepEqual(cleanReplyBody("a".repeat(socialReplyConfig.maxBody)), { ok: true, body: "a".repeat(socialReplyConfig.maxBody) });
assert.deepEqual(cleanReplyBody("a".repeat(socialReplyConfig.maxBody + 1)), { ok: false, reason: "long" });
assert.equal((cleanReplyBody("a\u202Eb") as { body: string }).body, "ab"); // bidi override removed (same as posts)
ok("reply text: cleaned like a post, at most socialReplyConfig.maxBody characters");

// ---- a small stand-in for the database
type PostRow = { id: number; authorId: string; status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED"; deletedAt: Date | null; author: { status: string; deletedAt: Date | null } };
type ReplyRow = { id: number; socialPostId: number; authorId: string; body: string; status: string; deletedAt: Date | null };
type Notif = { recipientId: string; actorId: string; type: string; socialPostId: number | null; readAt: Date | null };

function fakeDb(posts: PostRow[]) {
  const replies: ReplyRow[] = [];
  const notifications: Notif[] = [];
  let nextId = 1;
  const match = (row: object, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const db = {
    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)
    socialPost: { findUnique: async ({ where }: { where: { id: number } }) => posts.find((p) => p.id === where.id) ?? null },
    socialReply: {
      create: async ({ data }: { data: { socialPostId: number; authorId: string; body: string } }) => {
        const row = { id: nextId++, ...data, status: "VISIBLE", deletedAt: null as Date | null };
        replies.push(row);
        return { id: row.id };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<ReplyRow> }) => {
        const rows = replies.filter((r) => match(r, where));
        for (const r of rows) Object.assign(r, data);
        return { count: rows.length };
      },
    },
    notification: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => notifications.find((n) => match(n, where)) ?? null,
      create: async ({ data }: { data: Omit<Notif, "readAt"> }) => { notifications.push({ ...data, readAt: null }); return data; },
    },
  };
  return { db: db as never, replies, notifications };
}
const shown = (id: number, authorId: string): PostRow => ({ id, authorId, status: "VISIBLE", deletedAt: null, author: { status: "ACTIVE", deletedAt: null } });

async function main() {
  // ---- reply + notification
  {
    const { db, replies, notifications } = fakeDb([shown(1, "u1")]);
    const first = await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "nice" });
    assert.deepEqual(first, { ok: true, replyId: 1, notified: true });
    assert.equal(replies.length, 1);
    assert.equal(notifications.length, 1);
    assert.deepEqual(notifications[0], { recipientId: "u1", actorId: "u2", type: REPLY_NOTIFICATION, socialPostId: 1, readAt: null });
    // ten quick replies from the same person make ONE unread notification
    const second = await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "and more" });
    assert.deepEqual(second, { ok: true, replyId: 2, notified: false });
    assert.equal(replies.length, 2);
    assert.equal(notifications.length, 1);
    // after the author read it, the next reply notifies again
    (notifications[0] as Notif).readAt = new Date();
    assert.equal((await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "again" }) as { notified: boolean }).notified, true);
    assert.equal(notifications.length, 2);
    // a different person has their own notification
    assert.equal((await applySocialReply(db, { authorId: "u3", socialPostId: 1, body: "me too" }) as { notified: boolean }).notified, true);
    assert.equal(notifications.length, 3);
  }
  ok("reply: saved, the post's author gets one unread notification per person");

  // ---- own post: allowed, nobody notified
  {
    const { db, replies, notifications } = fakeDb([shown(1, "u1")]);
    assert.deepEqual(await applySocialReply(db, { authorId: "u1", socialPostId: 1, body: "thread" }), { ok: true, replyId: 1, notified: false });
    assert.equal(replies.length, 1);
    assert.equal(notifications.length, 0);
  }
  ok("reply to your own post: allowed, no notification");

  // ---- refusals
  {
    const posts: PostRow[] = [
      shown(1, "u1"),
      { ...shown(2, "u1"), status: "HIDDEN_PENDING_REVIEW" },
      { ...shown(3, "u1"), status: "REMOVED" },
      { ...shown(4, "u1"), deletedAt: new Date() },
      { ...shown(5, "u1"), author: { status: "DELETED", deletedAt: new Date() } },
      { ...shown(6, "u1"), author: { status: "DELETION_PENDING", deletedAt: null } },
    ];
    const { db, replies, notifications } = fakeDb(posts);
    for (const id of [2, 3, 4, 5, 6, 99]) {
      assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: id, body: "hi" }), { ok: false, reason: "notfound" }, `post ${id}`);
    }
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "   " }), { ok: false, reason: "invalid" });
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "x".repeat(socialReplyConfig.maxBody + 1) }), { ok: false, reason: "invalid" });
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: 5 }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialReply(db, { authorId: "", socialPostId: 1, body: "hi" }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: -1, body: "hi" }), { ok: false, reason: "error" });
    assert.equal(replies.length, 0);
    assert.equal(notifications.length, 0);
  }
  ok("reply: refused for hidden, removed, deleted, erased or unknown posts, and for bad text");

  // ---- delete your own reply
  {
    const { db, replies } = fakeDb([shown(1, "u1")]);
    await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "oops" });
    assert.deepEqual(await applySocialReplyDelete(db, { id: 1, authorId: "u3" }), { ok: false, reason: "notfound" }); // not yours
    assert.equal(replies[0].body, "oops");
    const now = new Date();
    assert.deepEqual(await applySocialReplyDelete(db, { id: 1, authorId: "u2", now }), { ok: true });
    assert.equal(replies[0].body, ""); // the text is gone for good
    assert.equal(replies[0].deletedAt, now); // the row stays
    assert.deepEqual(await applySocialReplyDelete(db, { id: 1, authorId: "u2" }), { ok: false, reason: "notfound" }); // twice: nothing
    replies.push({ id: 7, socialPostId: 1, authorId: "u2", body: "waiting", status: "HIDDEN_PENDING_REVIEW", deletedAt: null });
    assert.deepEqual(await applySocialReplyDelete(db, { id: 7, authorId: "u2" }), { ok: false, reason: "notfound" }); // hidden: waits for a reviewer
    assert.deepEqual(await applySocialReplyDelete(db, { id: 0, authorId: "u2" }), { ok: false, reason: "error" });
  }
  ok("delete reply: only your own, only while visible, the text is erased and the row stays");

  // ---- texts exist in all six languages
  const keys = Object.keys(en).filter((k) => k.startsWith("social.reply") || k.startsWith("social.replies.") || k.startsWith("notifications."));
  assert.ok(keys.length >= 20, "expected the new texts in en.ts");
  for (const [name, messages] of Object.entries({ es, fr, zh, hi, ar })) {
    for (const key of keys) assert.ok((messages as Record<string, string>)[key], `${name} is missing ${key}`);
  }
  ok("the new texts exist in all six languages");
}

main()
  .then(() => console.log(`\n${count} groups of checks passed.`))
  .catch((error) => { console.error(error); process.exit(1); });
