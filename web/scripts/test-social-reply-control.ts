// Test: reply control (SOCIAL_TODO B9): who may reply, and replies hidden by the author of the post. Run:  npm run test:social-reply-control
// Needs no database: the rules are run against a small in-memory stand-in.
import assert from "node:assert/strict";
import { applySocialReply } from "../src/lib/social-reply";
import { applySocialReplyHide, canReplyToPost } from "../src/lib/social-reply-control";
import {
  DEFAULT_REPLY_POLICY,
  factsNeeded,
  parseReplyPolicyInput,
  readStoredReplyPolicy,
  REPLY_POLICIES,
  replyAllowed,
} from "../src/lib/social-reply-control-rules";
import { socialReplyControl } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

// ---- the three choices and how they are read
assert.deepEqual([...REPLY_POLICIES], ["EVERYONE", "FOLLOWING", "MENTIONED"]);
assert.equal(DEFAULT_REPLY_POLICY, "EVERYONE");
assert.equal(parseReplyPolicyInput(undefined), "EVERYONE");
assert.equal(parseReplyPolicyInput(null), "EVERYONE");
assert.equal(parseReplyPolicyInput(""), "EVERYONE");
assert.equal(parseReplyPolicyInput("FOLLOWING"), "FOLLOWING");
assert.equal(parseReplyPolicyInput("MENTIONED"), "MENTIONED");
assert.equal(parseReplyPolicyInput("following"), null); // exact words only
assert.equal(parseReplyPolicyInput("NOBODY"), null);
assert.equal(parseReplyPolicyInput(5), null);
assert.equal(parseReplyPolicyInput({}), null);
assert.equal(readStoredReplyPolicy(undefined), "EVERYONE"); // only a test stand-in lacks the column (it has a default)
assert.equal(readStoredReplyPolicy("FOLLOWING"), "FOLLOWING");
assert.equal(readStoredReplyPolicy("SOMETHING_NEW"), "MENTIONED"); // an unknown value fails CLOSED, never open
ok("policy: three choices, nothing sent = everyone, unknown input refused, unknown stored value = strictest");

// ---- the rule
const none = { isPostAuthor: false, authorFollowsReplier: false, replierMentioned: false };
assert.equal(replyAllowed("EVERYONE", none), true);
assert.equal(replyAllowed("FOLLOWING", none), false);
assert.equal(replyAllowed("FOLLOWING", { ...none, authorFollowsReplier: true }), true);
assert.equal(replyAllowed("FOLLOWING", { ...none, replierMentioned: true }), false); // a mention does not help under "following"
assert.equal(replyAllowed("MENTIONED", none), false);
assert.equal(replyAllowed("MENTIONED", { ...none, replierMentioned: true }), true);
assert.equal(replyAllowed("MENTIONED", { ...none, authorFollowsReplier: true }), false); // being followed does not help under "mentioned"
for (const policy of REPLY_POLICIES) assert.equal(replyAllowed(policy, { ...none, isPostAuthor: true }), true); // the author always can
assert.deepEqual(factsNeeded("EVERYONE"), { follow: false, mention: false });
assert.deepEqual(factsNeeded("FOLLOWING"), { follow: true, mention: false });
assert.deepEqual(factsNeeded("MENTIONED"), { follow: false, mention: true });
ok("rule: everyone / author-follows-you / author-mentioned-you, the author always can, nothing else opens the door");

// ---- a small stand-in for the database
type PostRow = { id: number; authorId: string; status: "VISIBLE" | "HIDDEN_PENDING_REVIEW" | "REMOVED"; deletedAt: Date | null; replyPolicy?: string; author: { status: string; deletedAt: Date | null } };
type ReplyRow = { id: number; socialPostId: number; authorId: string; body: string; status: string; deletedAt: Date | null; hiddenByAuthorAt: Date | null };
type Notif = { recipientId: string; actorId: string; type: string; socialPostId: number | null; readAt: Date | null };

function fakeDb(opts: { posts: PostRow[]; follows?: [string, string][]; mentions?: [number, string][]; blocks?: [string, string][]; replies?: ReplyRow[] }) {
  const replies: ReplyRow[] = opts.replies ?? [];
  const notifications: Notif[] = [];
  const queries = { follow: 0, mention: 0 };
  let nextId = replies.length + 1;
  const follows = opts.follows ?? [];
  const mentions = opts.mentions ?? [];
  const blocks = opts.blocks ?? [];
  const match = (row: object, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const db = {
    socialBlock: {
      findFirst: async ({ where }: { where: { OR?: { blockerId: string; blockedId: string }[] } }) => {
        const found = (where.OR ?? []).some((pair) => blocks.some(([a, b]) => a === pair.blockerId && b === pair.blockedId));
        return found ? { blockerId: "x" } : null;
      },
    },
    follow: {
      findUnique: async ({ where }: { where: { followerId_followingId: { followerId: string; followingId: string } } }) => {
        queries.follow++;
        const k = where.followerId_followingId;
        return follows.some(([a, b]) => a === k.followerId && b === k.followingId) ? { followerId: k.followerId } : null;
      },
    },
    socialMention: {
      findUnique: async ({ where }: { where: { socialPostId_userId: { socialPostId: number; userId: string } } }) => {
        queries.mention++;
        const k = where.socialPostId_userId;
        return mentions.some(([p, u]) => p === k.socialPostId && u === k.userId) ? { userId: k.userId } : null;
      },
    },
    socialPost: { findUnique: async ({ where }: { where: { id: number } }) => opts.posts.find((p) => p.id === where.id) ?? null },
    socialReply: {
      create: async ({ data }: { data: { socialPostId: number; authorId: string; body: string } }) => {
        const row: ReplyRow = { id: nextId++, ...data, status: "VISIBLE", deletedAt: null, hiddenByAuthorAt: null };
        replies.push(row);
        return { id: row.id };
      },
      findUnique: async ({ where }: { where: { id: number } }) => {
        const reply = replies.find((r) => r.id === where.id);
        if (!reply) return null;
        const post = opts.posts.find((p) => p.id === reply.socialPostId)!;
        return { ...reply, socialPost: { authorId: post.authorId, status: post.status, deletedAt: post.deletedAt } };
      },
      updateMany: async ({ where, data }: { where: { id: number; hiddenByAuthorAt: null | { not: null } }; data: Partial<ReplyRow> }) => {
        const rows = replies.filter((r) => {
          if (r.id !== where.id) return false;
          return where.hiddenByAuthorAt === null ? r.hiddenByAuthorAt === null : r.hiddenByAuthorAt !== null;
        });
        for (const r of rows) Object.assign(r, data);
        return { count: rows.length };
      },
    },
    notification: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => notifications.find((n) => match(n, where)) ?? null,
      create: async ({ data }: { data: Omit<Notif, "readAt"> }) => { notifications.push({ ...data, readAt: null }); return data; },
    },
  };
  return { db: db as never, replies, notifications, queries };
}
const post = (id: number, authorId: string, replyPolicy?: string): PostRow => ({
  id, authorId, status: "VISIBLE", deletedAt: null, replyPolicy, author: { status: "ACTIVE", deletedAt: null },
});

async function main() {
  // ---- EVERYONE (and a post that has no policy yet): nothing changes, and no extra question is asked
  {
    const { db, replies, queries } = fakeDb({ posts: [post(1, "u1", "EVERYONE"), post(2, "u1")] });
    assert.equal((await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "hi" })).ok, true);
    assert.equal((await applySocialReply(db, { authorId: "u2", socialPostId: 2, body: "hi" })).ok, true);
    assert.equal(replies.length, 2);
    assert.deepEqual(queries, { follow: 0, mention: 0 });
    ok("everyone: replies work as before and cost no extra database question");
  }

  // ---- FOLLOWING: only the people the AUTHOR follows
  {
    const { db, replies, notifications } = fakeDb({ posts: [post(1, "u1", "FOLLOWING")], follows: [["u1", "u2"], ["u3", "u1"]] });
    assert.equal((await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "I am followed by the author" })).ok, true);
    // u3 follows the author, but the author does not follow u3: refused
    assert.deepEqual(await applySocialReply(db, { authorId: "u3", socialPostId: 1, body: "I follow the author" }), { ok: false, reason: "restricted" });
    assert.deepEqual(await applySocialReply(db, { authorId: "u4", socialPostId: 1, body: "stranger" }), { ok: false, reason: "restricted" });
    assert.equal((await applySocialReply(db, { authorId: "u1", socialPostId: 1, body: "my own post" })).ok, true); // the author can
    assert.equal(replies.length, 2);
    assert.equal(notifications.length, 1); // a refused reply makes no notification
    assert.equal(await canReplyToPost(db, { viewerId: "u2", post: { id: 1, authorId: "u1", replyPolicy: "FOLLOWING" } }), true);
    assert.equal(await canReplyToPost(db, { viewerId: "u4", post: { id: 1, authorId: "u1", replyPolicy: "FOLLOWING" } }), false);
    ok("following: only people the author follows (not the other way round), the author always, a refusal saves and notifies nothing");
  }

  // ---- MENTIONED: only the people @mentioned in the post
  {
    const { db, replies } = fakeDb({ posts: [post(1, "u1", "MENTIONED")], mentions: [[1, "u2"]], follows: [["u1", "u3"]] });
    assert.equal((await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "you mentioned me" })).ok, true);
    assert.deepEqual(await applySocialReply(db, { authorId: "u3", socialPostId: 1, body: "followed but not mentioned" }), { ok: false, reason: "restricted" });
    assert.deepEqual(await applySocialReply(db, { authorId: "u4", socialPostId: 1, body: "stranger" }), { ok: false, reason: "restricted" });
    assert.equal((await applySocialReply(db, { authorId: "u1", socialPostId: 1, body: "me" })).ok, true);
    assert.equal(replies.length, 2);
    ok("mentioned: only people mentioned in THIS post (a mention in another post does not count), the author always");
  }

  // ---- an unknown stored value fails closed
  {
    const { db } = fakeDb({ posts: [post(1, "u1", "SOMETHING_NEW")] });
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "hi" }), { ok: false, reason: "restricted" });
    ok("an unknown stored policy refuses (fails closed)");
  }

  // ---- Block still wins, and says nothing about the policy
  {
    const { db } = fakeDb({ posts: [post(1, "u1", "FOLLOWING")], follows: [["u1", "u2"]], blocks: [["u1", "u2"]] });
    assert.deepEqual(await applySocialReply(db, { authorId: "u2", socialPostId: 1, body: "hi" }), { ok: false, reason: "notfound" });
    ok("block is checked first: the same \"not found\", never a hint about the policy");
  }

  // ---- hide / show again a reply under your post
  {
    const replies: ReplyRow[] = [
      { id: 1, socialPostId: 1, authorId: "u2", body: "a", status: "VISIBLE", deletedAt: null, hiddenByAuthorAt: null },
      { id: 2, socialPostId: 1, authorId: "u1", body: "mine", status: "VISIBLE", deletedAt: null, hiddenByAuthorAt: null },
      { id: 3, socialPostId: 1, authorId: "u3", body: "", status: "VISIBLE", deletedAt: new Date(), hiddenByAuthorAt: null },
      { id: 4, socialPostId: 1, authorId: "u3", body: "moderated", status: "HIDDEN_PENDING_REVIEW", deletedAt: null, hiddenByAuthorAt: null },
      { id: 5, socialPostId: 9, authorId: "u2", body: "other post", status: "VISIBLE", deletedAt: null, hiddenByAuthorAt: null },
    ];
    const hiddenPost = { ...post(8, "u1"), status: "HIDDEN_PENDING_REVIEW" as const };
    replies.push({ id: 6, socialPostId: 8, authorId: "u2", body: "under a hidden post", status: "VISIBLE", deletedAt: null, hiddenByAuthorAt: null });
    const { db } = fakeDb({ posts: [post(1, "u1"), post(9, "u5"), hiddenPost], replies });
    const when = new Date("2026-11-16T10:00:00Z");

    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "u1", hide: true, now: when }), { ok: true, hidden: true });
    assert.equal(replies[0].hiddenByAuthorAt?.getTime(), when.getTime());
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "u1", hide: true, now: new Date() }), { ok: true, hidden: true });
    assert.equal(replies[0].hiddenByAuthorAt?.getTime(), when.getTime(), "hiding twice changes nothing (the time stays)");
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "u1", hide: false }), { ok: true, hidden: false });
    assert.equal(replies[0].hiddenByAuthorAt, null);
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "u1", hide: false }), { ok: true, hidden: false });

    // refused, always as "not found": somebody else's post, your own reply, a deleted reply, a reply in moderation,
    // a reply under a post that is not visible, a reply that does not exist
    for (const [replyId, actorId] of [[1, "u2"], [1, "u9"], [2, "u1"], [3, "u1"], [4, "u1"], [5, "u1"], [6, "u1"], [99, "u1"]] as const) {
      assert.deepEqual(await applySocialReplyHide(db, { replyId, actorId, hide: true }), { ok: false, reason: "notfound" }, `reply ${replyId} by ${actorId}`);
    }
    assert.equal(replies.filter((r) => r.hiddenByAuthorAt !== null).length, 0);
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 0, actorId: "u1", hide: true }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "", hide: true }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialReplyHide(db, { replyId: 1, actorId: "u1", hide: "yes" as unknown as boolean }), { ok: false, reason: "error" });
    ok("hide: only the author of the post, only a visible reply of somebody else, reversible, twice changes nothing, the rest is \"not found\"");
  }

  // ---- limits and texts
  assert.ok(socialReplyControl.hideLimits.length >= 2);
  for (const rule of socialReplyControl.hideLimits) assert.ok(rule.max > 0 && rule.windowSeconds > 0);
  ok("config: hide / show limits exist");

  const keys = [
    "social.replyControl.label", "social.replyControl.help", "social.replyControl.everyone", "social.replyControl.following",
    "social.replyControl.mentioned", "social.replyControl.current", "social.replyControl.notice.following",
    "social.replyControl.notice.mentioned", "social.reply.restricted", "social.replyControl.hide", "social.replyControl.unhide",
    "social.replyControl.hide.error", "social.replyControl.hiddenTitle", "social.replyControl.hiddenNote",
  ] as const;
  const langs: Record<string, Record<string, string>> = { en, es, fr, zh, hi, ar } as never;
  const holes = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const key of keys) {
    const english = langs.en[key];
    assert.ok(english && english.length > 0, `en: ${key}`);
    for (const [lang, dict] of Object.entries(langs)) {
      const text = dict[key];
      assert.ok(typeof text === "string" && text.length > 0, `${lang}: ${key} is missing`);
      assert.equal(holes(text), holes(english), `${lang}: ${key} has different {placeholders}`);
    }
  }
  ok("the new texts exist in all six languages with the same {placeholders}");

  console.log(`\n${count} groups of checks passed.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
