// Test: Block and Mute (SOCIAL_TODO A7, patch-social-block). Run:  npm run test:social-block
// Needs no database: the rules are run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import {
  applySocialBlock,
  applySocialMute,
  cleanBlockUsername,
  eraseSocialBlocks,
  isBlockedEitherWay,
  MAX_BLOCK_USERNAME_LENGTH,
} from "../src/lib/social-block";
import { dropHiddenAuthors, dropHiddenItems, makeHiddenAuthors, noHiddenAuthors } from "../src/lib/social-block-rules";
import { applySocialFollow } from "../src/lib/social-follow";
import { applySocialReply } from "../src/lib/social-reply";
import { applySocialRepost } from "../src/lib/social-repost";
import { syncSocialTags } from "../src/lib/social-tag-sync";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Row = Record<string, unknown>;
const user = (id: string, over: Row = {}): Row => ({ id, username: id, status: "ACTIVE", deletedAt: null, ...over });

// A stand-in with just the calls these rules make. `where` supports equality, `in` and `OR`.
function fakeDb(users: Row[], posts: Row[] = []) {
  const blocks: Row[] = [];
  const mutes: Row[] = [];
  const follows: Row[] = [];
  const reposts: Row[] = [];
  const replies: Row[] = [];
  const notifications: Row[] = [];
  const mentions: Row[] = [];
  const tags: Row[] = [];
  let nextId = 1;
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Row[]).some((part) => matches(row, part));
      if (value && typeof value === "object" && "in" in (value as Row)) return ((value as { in: unknown[] }).in).includes(row[key]);
      return row[key] === value;
    });
  const unique = (rows: Row[], keys: string[]) => (data: Row) => {
    if (rows.some((row) => keys.every((key) => row[key] === data[key]))) throw Object.assign(new Error("unique"), { code: "P2002" });
  };
  const table = (rows: Row[], keys: string[], autoId = false) => {
    const checkUnique = unique(rows, keys);
    const compound = (where: Row) => (where[keys.join("_")] ?? where) as Row;
    return {
      findMany: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
      findFirst: async ({ where }: { where: Row }) => rows.find((row) => matches(row, where)) ?? null,
      findUnique: async ({ where }: { where: Row }) => rows.find((row) => matches(row, compound(where))) ?? null,
      create: async ({ data }: { data: Row }) => { checkUnique(data); const row = { ...data, ...(autoId ? { id: nextId++ } : {}), readAt: null }; rows.push(row); return row; },
      delete: async ({ where }: { where: Row }) => { const i = rows.findIndex((row) => matches(row, compound(where))); if (i < 0) throw new Error("not found"); return rows.splice(i, 1)[0]; },
      deleteMany: async ({ where }: { where: Row }) => {
        let count = 0;
        for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) { rows.splice(i, 1); count++; }
        return { count };
      },
      count: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).length,
    };
  };
  const postTable = {
    findFirst: async ({ where }: { where: Row }) => posts.find((p) => matches(p, where)) ?? null,
    findUnique: async ({ where }: { where: Row }) => posts.find((p) => matches(p, where)) ?? null,
  };
  const client = {
    user: { findFirst: async ({ where }: { where: Row }) => users.find((u) => matches(u, where)) ?? null, findMany: table(users, ["id"]).findMany },
    socialBlock: table(blocks, ["blockerId", "blockedId"]),
    socialMute: table(mutes, ["muterId", "mutedId"]),
    follow: table(follows, ["followerId", "followingId"]),
    socialRepost: table(reposts, ["userId", "socialPostId"], true),
    socialReply: table(replies, ["id"], true),
    socialPost: postTable,
    notification: table(notifications, ["id"], true),
    socialMention: table(mentions, ["socialPostId", "userId"]),
    socialPostTag: table(tags, ["socialPostId", "tag"]),
  };
  return { db: client as never, blocks, mutes, follows, reposts, replies, notifications, mentions };
}

async function main() {
  // ------------------------------------------------------------ pure rules
  {
    const hidden = makeHiddenAuthors({ blockedByMe: ["a"], blockedMe: ["b"], mutedByMe: ["c"] });
    assert.deepEqual([...hidden.blocked].sort(), ["a", "b"]);
    assert.deepEqual([...hidden.muted], ["c"]);
    assert.deepEqual([...hidden.all].sort(), ["a", "b", "c"]);
    ok("hidden people: blocked both ways + muted");

    const post = (id: number, author: string) => ({ kind: "post" as const, post: { id, author } });
    const repost = (reposter: string, author: string) => ({ kind: "repost" as const, reposter, post: { id: 9, author } });
    const community = { kind: "community" as const, post: { id: 1, author: "a" } };
    const items = [post(1, "a"), post(2, "z"), repost("z", "a"), repost("a", "z"), repost("z", "y"), community];
    const kept = dropHiddenItems(items, new Set(["a"]));
    assert.deepEqual(kept, [post(2, "z"), repost("z", "y"), community]);
    ok("feed: posts and reposts BY a hidden person and reposts OF their posts are dropped; community items stay");
    assert.equal(dropHiddenItems(items, noHiddenAuthors.all), items);
    ok("feed: nothing hidden returns the same list");

    const list = [{ author: "a" }, { author: "z" }];
    assert.deepEqual(dropHiddenAuthors(list, new Set(["a"])), [{ author: "z" }]);
    ok("replies: a hidden person's replies are dropped");
  }

  // ------------------------------------------------------------ names and limits
  assert.equal(cleanBlockUsername("  MaYa "), "maya");
  assert.equal(cleanBlockUsername(""), null);
  assert.equal(cleanBlockUsername(42), null);
  assert.equal(cleanBlockUsername("x".repeat(MAX_BLOCK_USERNAME_LENGTH + 1)), null);
  ok("username cleaning");
  assert.ok(socialLimits.blocks.length >= 1 && socialLimits.blocks.every((rule) => rule.max > 0 && rule.windowSeconds > 0));
  ok("rate limit is configured");

  // ------------------------------------------------------------ block
  {
    const { db, blocks, follows, notifications } = fakeDb([user("me"), user("maya"), user("gone", { status: "DELETION_PENDING" })]);
    follows.push({ followerId: "me", followingId: "maya" }, { followerId: "maya", followingId: "me" }, { followerId: "me", followingId: "other" });
    const first = await applySocialBlock(db, { actorId: "me", username: "Maya", block: true });
    assert.deepEqual(first, { ok: true, blocked: true, changed: true, followsRemoved: 2 });
    assert.equal(blocks.length, 1);
    assert.deepEqual(follows, [{ followerId: "me", followingId: "other" }]);
    assert.equal(notifications.length, 0);
    ok("block: row saved, follows between the two removed both ways, others kept, nobody notified");

    const again = await applySocialBlock(db, { actorId: "me", username: "maya", block: true });
    assert.deepEqual(again, { ok: true, blocked: true, changed: false, followsRemoved: 0 });
    assert.equal(blocks.length, 1);
    ok("block twice: no second row, no error");

    assert.equal(await isBlockedEitherWay(db, "me", "maya"), true);
    assert.equal(await isBlockedEitherWay(db, "maya", "me"), true);
    assert.equal(await isBlockedEitherWay(db, "me", "other"), false);
    assert.equal(await isBlockedEitherWay(db, "me", "me"), false);
    assert.equal(await isBlockedEitherWay(db, "", "maya"), false);
    ok("blocked either way: both directions, and not for the same person");

    const undo = await applySocialBlock(db, { actorId: "me", username: "maya", block: false });
    assert.deepEqual(undo, { ok: true, blocked: false, changed: true, followsRemoved: 0 });
    assert.equal(blocks.length, 0);
    assert.deepEqual(follows, [{ followerId: "me", followingId: "other" }]);
    ok("unblock: row removed, follows are NOT brought back");
    const undoAgain = await applySocialBlock(db, { actorId: "me", username: "maya", block: false });
    assert.deepEqual(undoAgain, { ok: true, blocked: false, changed: false, followsRemoved: 0 });
    ok("unblock when not blocked: nothing changes");

    assert.deepEqual(await applySocialBlock(db, { actorId: "me", username: "me", block: true }), { ok: false, reason: "self" });
    assert.deepEqual(await applySocialBlock(db, { actorId: "me", username: "nobody", block: true }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialBlock(db, { actorId: "me", username: "gone", block: true }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialBlock(db, { actorId: "me", username: 5, block: true }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialBlock(db, { actorId: "me", username: "maya", block: "yes" }), { ok: false, reason: "error" });
    assert.deepEqual(await applySocialBlock(db, { actorId: "", username: "maya", block: true }), { ok: false, reason: "error" });
    assert.equal(blocks.length, 0);
    ok("block: not yourself, unknown or not-shown accounts are \"not found\", bad input is refused");

    blocks.push({ blockerId: "me", blockedId: "gone" });
    const undoGone = await applySocialBlock(db, { actorId: "me", username: "gone", block: false });
    assert.equal(undoGone.ok, true);
    assert.equal(blocks.length, 0);
    ok("unblock is allowed even when the other account is not shown");
  }

  // ------------------------------------------------------------ mute
  {
    const { db, mutes, follows, blocks } = fakeDb([user("me"), user("maya"), user("gone", { deletedAt: new Date(), status: "DELETED" })]);
    follows.push({ followerId: "me", followingId: "maya" });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "maya", mute: true }), { ok: true, muted: true, changed: true });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "maya", mute: true }), { ok: true, muted: true, changed: false });
    assert.equal(mutes.length, 1);
    assert.equal(follows.length, 1);
    assert.equal(blocks.length, 0);
    ok("mute: one row, twice changes nothing, the follow stays, no block");
    assert.equal(await isBlockedEitherWay(db, "me", "maya"), false);
    ok("a mute is not a block (nothing is refused)");
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "maya", mute: false }), { ok: true, muted: false, changed: true });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "maya", mute: false }), { ok: true, muted: false, changed: false });
    assert.equal(mutes.length, 0);
    ok("unmute");
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "me", mute: true }), { ok: false, reason: "self" });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "gone", mute: true }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "nobody", mute: true }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialMute(db, { actorId: "me", username: "maya", mute: 1 }), { ok: false, reason: "error" });
    ok("mute: not yourself, unknown or erased accounts, bad input");
  }

  // ------------------------------------------------------------ erasure
  {
    const { db, blocks, mutes } = fakeDb([user("a"), user("b"), user("c")]);
    blocks.push({ blockerId: "a", blockedId: "b" }, { blockerId: "b", blockedId: "a" }, { blockerId: "b", blockedId: "c" });
    mutes.push({ muterId: "a", mutedId: "c" }, { muterId: "c", mutedId: "a" }, { muterId: "b", mutedId: "c" });
    assert.equal(await eraseSocialBlocks(db, "a"), 4);
    assert.deepEqual(blocks, [{ blockerId: "b", blockedId: "c" }]);
    assert.deepEqual(mutes, [{ muterId: "b", mutedId: "c" }]);
    assert.equal(await eraseSocialBlocks(db, "a"), 0);
    ok("final erasure: every block and mute made or received is removed (and only those); twice is safe");
  }

  // ------------------------------------------------------------ the write paths refuse a blocked pair
  {
    // follow
    const { db, blocks, follows } = fakeDb([user("me"), user("maya")]);
    blocks.push({ blockerId: "maya", blockedId: "me" });
    assert.deepEqual(await applySocialFollow(db, { followerId: "me", username: "maya", follow: true }), { ok: false, reason: "notfound" });
    blocks.length = 0;
    blocks.push({ blockerId: "me", blockedId: "maya" });
    assert.deepEqual(await applySocialFollow(db, { followerId: "me", username: "maya", follow: true }), { ok: false, reason: "notfound" });
    assert.equal(follows.length, 0);
    blocks.length = 0;
    assert.equal((await applySocialFollow(db, { followerId: "me", username: "maya", follow: true })).ok, true);
    ok("follow: refused (\"not found\") when either person blocked the other; allowed again after unblock");
  }
  {
    // reply
    const posts = [{ id: 1, authorId: "maya", status: "VISIBLE", deletedAt: null, author: { status: "ACTIVE", deletedAt: null } }];
    const { db, blocks, replies, notifications } = fakeDb([user("me"), user("maya")], posts);
    blocks.push({ blockerId: "maya", blockedId: "me" });
    assert.deepEqual(await applySocialReply(db, { authorId: "me", socialPostId: 1, body: "hello" }), { ok: false, reason: "notfound" });
    assert.equal(replies.length, 0);
    assert.equal(notifications.length, 0);
    blocks.length = 0;
    blocks.push({ blockerId: "me", blockedId: "maya" });
    assert.deepEqual(await applySocialReply(db, { authorId: "me", socialPostId: 1, body: "hello" }), { ok: false, reason: "notfound" });
    blocks.length = 0;
    assert.equal((await applySocialReply(db, { authorId: "me", socialPostId: 1, body: "hello" })).ok, true);
    ok("reply: refused when either person blocked the other; no reply and no notification is saved");
  }
  {
    // repost and quote
    const posts = [{ id: 1, authorId: "maya", status: "VISIBLE", deletedAt: null, author: { status: "ACTIVE", deletedAt: null } }];
    const { db, blocks, reposts, notifications } = fakeDb([user("me"), user("maya")], posts);
    blocks.push({ blockerId: "maya", blockedId: "me" });
    assert.deepEqual(await applySocialRepost(db, { userId: "me", socialPostId: 1, action: "repost" }), { ok: false, reason: "notfound" });
    assert.deepEqual(await applySocialRepost(db, { userId: "me", socialPostId: 1, action: "quote", quote: "look" }), { ok: false, reason: "notfound" });
    assert.equal(reposts.length, 0);
    assert.equal(notifications.length, 0);
    blocks.length = 0;
    assert.equal((await applySocialRepost(db, { userId: "me", socialPostId: 1, action: "repost" })).ok, true);
    blocks.push({ blockerId: "me", blockedId: "maya" });
    const undo = await applySocialRepost(db, { userId: "me", socialPostId: 1, action: "undo" });
    assert.equal(undo.ok, true);
    assert.equal(reposts.length, 0);
    ok("repost / quote: refused when either person blocked the other; UNDO is always allowed");
  }
  {
    // mentions
    const users = [user("alice"), user("bob"), user("carol"), user("dave")];
    const { db, blocks, mentions, notifications } = fakeDb(users);
    blocks.push({ blockerId: "bob", blockedId: "alice" }, { blockerId: "alice", blockedId: "carol" });
    const result = await syncSocialTags(db, { socialPostId: 7, authorId: "alice", body: "hi @bob @carol @dave" });
    assert.deepEqual(mentions.map((row) => row.userId), ["dave"]);
    assert.equal(result.notified, 1);
    assert.deepEqual(notifications.map((row) => row.recipientId), ["dave"]);
    ok("mention: a person who blocked the author, or was blocked by them, stays plain text and is not notified");
  }

  // ------------------------------------------------------------ texts
  const keys = [
    "social.mute", "social.unmute", "social.mute.label", "social.unmute.label", "social.block", "social.unblock",
    "social.block.label", "social.unblock.label", "social.block.confirm", "social.block.confirm.yes", "social.block.confirm.no",
    "social.block.login", "social.block.toomany", "social.block.error", "social.block.profile", "social.mute.note",
  ];
  const languages = { en, es, fr, zh, hi, ar } as unknown as Record<string, Record<string, string>>;
  const withName = keys.filter((key) => /\.label$|^social\.block\.confirm$|^social\.block\.profile$|^social\.mute\.note$/.test(key));
  for (const [lang, messages] of Object.entries(languages)) {
    for (const key of keys) assert.ok(typeof messages[key] === "string" && messages[key].length > 0, `${lang}: missing ${key}`);
    for (const key of withName) assert.ok(messages[key].includes("{username}"), `${lang}: ${key} must contain {username}`);
  }
  ok("texts: the 16 new texts exist in six languages and keep {username}");

  console.log("\nAll social-block checks passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
