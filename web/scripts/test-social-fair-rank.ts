// Test: fair ranking of replies and reposts (SOCIAL_TODO B10). Run:  npm run test:social-fair-rank   (no database needed)
import assert from "node:assert/strict";
import { collapsePlainReposts, orderReplies, parseReplySort, type RankableReply } from "../src/lib/social-fair-rank-rules";
import { applySocialReplyLike } from "../src/lib/social-reply-like";
import { socialReplyRank } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

let count = 0;
function ok(name: string) { count++; console.log("OK  " + name); }

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 8, 12, 0, 0);
const reply = (id: number, author: string, ageH: number, likes: number, over: Partial<RankableReply> = {}): RankableReply => ({
  id, author, createdAtMs: NOW - ageH * HOUR, likes, authorCreatedAtMs: NOW - 400 * DAY, authorPosts: 50, ...over,
});

async function main() {
  // ---- the sort word
  assert.equal(parseReplySort(undefined), "oldest");
  assert.equal(parseReplySort("top"), "top");
  assert.equal(parseReplySort(["top", "oldest"]), "top");
  assert.equal(parseReplySort("TOP"), "oldest");
  assert.equal(parseReplySort("anything"), "oldest");
  assert.equal(parseReplySort(5), "oldest");
  ok("sort: only exactly 'top' means top, everything else is oldest");

  // ---- oldest
  const list = [reply(3, "c", 1, 9), reply(1, "a", 5, 0), reply(2, "b", 3, 4)];
  assert.deepEqual(orderReplies(list, "oldest", NOW, socialReplyRank).items.map((r) => r.id), [1, 2, 3]);
  assert.equal(orderReplies(list, "oldest", NOW, socialReplyRank).rising.size, 0);
  ok("oldest: plain time order, nothing reserved");

  // ---- top: every reply is there exactly once, nothing hidden, nothing invented
  const many: RankableReply[] = [];
  for (let i = 1; i <= 40; i++) many.push(reply(i, `u${i % 7}`, i, i % 5));
  const top = orderReplies(many, "top", NOW, socialReplyRank).items.map((r) => r.id);
  assert.equal(top.length, many.length);
  assert.deepEqual([...top].sort((a, b) => a - b), many.map((r) => r.id));
  ok("top: every reply appears exactly once");

  // ---- top: quality with limits (a liked reply beats an unliked one of the same age and author age)
  const q = orderReplies([reply(1, "a", 5, 0, { authorPosts: 50 }), reply(2, "b", 5, 8, { authorPosts: 50 })], "top", NOW, socialReplyRank).items.map((r) => r.id);
  assert.deepEqual(q, [2, 1]);
  ok("top: likes count");

  // ---- top: same input, same output; and it never reads a clock
  const again = orderReplies(many, "top", NOW, socialReplyRank).items.map((r) => r.id);
  assert.deepEqual(again, top);
  ok("top: the same replies and the same time always give the same order");

  // ---- top: one account cannot fill the list
  const flood: RankableReply[] = [];
  for (let i = 1; i <= 6; i++) flood.push(reply(i, "loud", 2, 10)); // one account, six equal replies
  flood.push(reply(7, "quiet", 2, 4));
  const fl = orderReplies(flood, "top", NOW, socialReplyRank).items.map((r) => r.id);
  assert.ok(fl.indexOf(7) <= 2, "the quiet account's reply comes early, not last: " + fl.join(","));
  ok("top: one account cannot fill the list");

  // ---- top: new voices get a fixed share, and a flood of new accounts cannot take more than one place in four
  const firstTwenty: RankableReply[] = [];
  for (let i = 1; i <= 30; i++) firstTwenty.push(reply(i, `old${i}`, 20 + i, 10, { authorPosts: 80 }));
  for (let i = 100; i < 140; i++) firstTwenty.push(reply(i, `new${i}`, 1, 0, { authorCreatedAtMs: NOW - DAY, authorPosts: 1 }));
  const res = orderReplies(firstTwenty, "top", NOW, socialReplyRank);
  const firstTwentyIds = res.items.slice(0, 20).map((r) => r.id);
  const newInFirst = firstTwentyIds.filter((id) => id >= 100).length;
  assert.ok(newInFirst >= 1, "a new voice gets a reserved place");
  assert.ok(newInFirst <= 5, "at most one place in four (" + newInFirst + ")");
  assert.ok(res.rising.size >= 1);
  for (const id of res.rising) assert.ok(id >= 100, "only new voices are labelled");
  ok("top: new voices get a fixed share (at most 1 place in 4), and only those places are labelled");

  // ---- feed: plain reposts of the same post are merged, quotes never
  const mk = (repostId: number, postId: number, quote: string | null) => ({ kind: "repost" as const, repostId, quote, post: { id: postId } });
  const feed = [
    { kind: "post" as const, post: { id: 9 } },
    mk(10, 1, null), mk(9, 2, null), mk(8, 1, null), mk(7, 1, "my take"), mk(6, 1, null), mk(5, 2, null),
  ];
  const merged = collapsePlainReposts(feed);
  assert.deepEqual(merged.map((i) => ("repostId" in i ? i.repostId : "post")), ["post", 10, 9, 7]);
  assert.equal((merged[1] as { alsoCount?: number }).alsoCount, 2); // 8 and 6
  assert.equal((merged[2] as { alsoCount?: number }).alsoCount, 1); // 5
  assert.equal((merged[3] as { alsoCount?: number }).alsoCount, undefined); // a quote is never merged
  assert.equal(collapsePlainReposts([]).length, 0);
  assert.equal(feed.length, 7); // the input is not changed
  ok("feed: plain reposts of one post become one line (newest stays), quotes and posts are untouched");

  // ---- like on a reply: a small stand-in for the database
  type R = { id: number; authorId: string; postAuthorId: string; visible: boolean };
  const likes: { userId: string; socialReplyId: number }[] = [];
  const blocks: [string, string][] = [["x", "badguy"]];
  const replies: R[] = [
    { id: 1, authorId: "r1", postAuthorId: "p1", visible: true },
    { id: 2, authorId: "r2", postAuthorId: "p1", visible: false },
    { id: 3, authorId: "badguy", postAuthorId: "p1", visible: true },
  ];
  const db = {
    socialReply: {
      findFirst: async ({ where }: { where: { id: number } }) => {
        const r = replies.find((x) => x.id === where.id && x.visible);
        return r ? { id: r.id, authorId: r.authorId, socialPost: { authorId: r.postAuthorId } } : null;
      },
    },
    socialBlock: {
      findFirst: async ({ where }: { where: { OR: { blockerId: string; blockedId: string }[] } }) =>
        where.OR.some((p) => blocks.some(([a, b]) => a === p.blockerId && b === p.blockedId)) ? { blockerId: "x" } : null,
    },
    socialReplyLike: {
      findUnique: async ({ where }: { where: { userId_socialReplyId: { userId: string; socialReplyId: number } } }) =>
        likes.find((l) => l.userId === where.userId_socialReplyId.userId && l.socialReplyId === where.userId_socialReplyId.socialReplyId) ?? null,
      create: async ({ data }: { data: { userId: string; socialReplyId: number } }) => { likes.push(data); return data; },
      delete: async ({ where }: { where: { userId_socialReplyId: { userId: string; socialReplyId: number } } }) => {
        const i = likes.findIndex((l) => l.userId === where.userId_socialReplyId.userId && l.socialReplyId === where.userId_socialReplyId.socialReplyId);
        if (i >= 0) likes.splice(i, 1);
        return {};
      },
      count: async ({ where }: { where: { socialReplyId: number } }) => likes.filter((l) => l.socialReplyId === where.socialReplyId).length,
    },
  } as never;

  assert.deepEqual(await applySocialReplyLike(db, { replyId: 1, userId: "x", like: true }), { ok: true, liked: true, likes: 1 });
  assert.deepEqual(await applySocialReplyLike(db, { replyId: 1, userId: "x", like: true }), { ok: true, liked: true, likes: 1 }); // twice = once
  assert.deepEqual(await applySocialReplyLike(db, { replyId: 1, userId: "y", like: true }), { ok: true, liked: true, likes: 2 });
  assert.deepEqual(await applySocialReplyLike(db, { replyId: 1, userId: "x", like: false }), { ok: true, liked: false, likes: 1 });
  assert.deepEqual(await applySocialReplyLike(db, { replyId: 1, userId: "x", like: false }), { ok: true, liked: false, likes: 1 }); // twice = once
  assert.equal((await applySocialReplyLike(db, { replyId: 2, userId: "x", like: true })).ok, false); // not visible
  assert.equal((await applySocialReplyLike(db, { replyId: 99, userId: "x", like: true })).ok, false); // unknown
  assert.equal((await applySocialReplyLike(db, { replyId: 3, userId: "x", like: true })).ok, false); // blocked
  assert.equal((await applySocialReplyLike(db, { replyId: 1, userId: "", like: true })).ok, false);
  assert.equal((await applySocialReplyLike(db, { replyId: -1, userId: "x", like: true })).ok, false);
  assert.equal((await applySocialReplyLike(db, { replyId: 1, userId: "x", like: "yes" as never })).ok, false);
  ok("reply like: once per person, undo works, visible replies only, block refuses, bad input refused");

  // ---- the new texts exist in all six languages with the same {placeholders}
  const keys = ["social.replyRank.label", "social.replyRank.oldest", "social.replyRank.top", "social.replyRank.how", "social.replyLike.like", "social.replyLike.unlike", "social.repost.byMany"];
  const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const [name, dict] of Object.entries({ en, es, fr, zh, hi, ar })) {
    for (const key of keys) {
      const value = (dict as Record<string, string>)[key];
      assert.ok(typeof value === "string" && value.length > 0, `${name} lacks ${key}`);
      assert.equal(holes(value), holes((en as Record<string, string>)[key]), `${name} ${key}: placeholders differ`);
    }
  }
  ok("the new texts exist in all six languages with the same {placeholders}");

  // ---- config
  assert.ok(socialReplyRank.risingEvery >= 2 && socialReplyRank.halfLifeHours > 0 && socialReplyRank.sameAuthorFactor > 0 && socialReplyRank.sameAuthorFactor < 1);
  ok("config: reply ranking numbers exist and are sensible");

  console.log(`\n${count} groups of checks passed.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
