// Test: repost / quote repost / undo (SOCIAL_TODO 16). Run:  npm run test:social-repost
// Needs no database: applySocialRepost() is run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialRepost, REPOST_ACTIONS, REPOST_NOTIFICATION } from "../src/lib/social-repost";
import { SOCIAL_MAX_BODY } from "../src/lib/social-input";
import { checkRules } from "../src/lib/social-limits";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type Author = { status: string; deletedAt: Date | null };
type Post = { id: number; authorId: string; status: string; deletedAt: Date | null; author: Author };
type Repost = { id: number; userId: string; socialPostId: number; quoteText: string | null };
type Notification = { id: number; recipientId: string; actorId: string; type: string; socialPostId: number };

// Just enough of Prisma's socialPost / socialRepost / notification calls for the rules in social-repost.ts.
function fakeDb(posts: Post[]) {
  const reposts: Repost[] = [];
  const notifications: Notification[] = [];
  let nextId = 1;
  const match = (row: object, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const pair = (w: { userId_socialPostId: { userId: string; socialPostId: number } }) => w.userId_socialPostId;
  return {
    reposts,
    notifications,
    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)
    socialPost: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => posts.find((p) => match(p, where)) ?? null,
    },
    socialRepost: {
      findUnique: async ({ where }: { where: { userId_socialPostId: { userId: string; socialPostId: number } } }) =>
        reposts.find((r) => match(r, pair(where))) ?? null,
      create: async ({ data }: { data: { userId: string; socialPostId: number; quoteText: string | null } }) => {
        // the real table has a unique key on the pair: a second row is refused
        if (reposts.some((r) => r.userId === data.userId && r.socialPostId === data.socialPostId)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: nextId++, ...data };
        reposts.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { userId_socialPostId: { userId: string; socialPostId: number } }; data: { quoteText: string | null } }) => {
        const row = reposts.find((r) => match(r, pair(where)));
        if (!row) throw new Error("not found");
        row.quoteText = data.quoteText;
        return row;
      },
      delete: async ({ where }: { where: { userId_socialPostId: { userId: string; socialPostId: number } } }) => {
        const i = reposts.findIndex((r) => match(r, pair(where)));
        if (i < 0) throw new Error("not found");
        return reposts.splice(i, 1)[0];
      },
      count: async ({ where }: { where: Record<string, unknown> }) => reposts.filter((r) => match(r, where)).length,
    },
    notification: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => notifications.find((n) => match(n, where)) ?? null,
      create: async ({ data }: { data: Omit<Notification, "id"> }) => {
        const row = { id: nextId++, ...data };
        notifications.push(row);
        return row;
      },
    },
  };
}

const ACTIVE: Author = { status: "ACTIVE", deletedAt: null };
const post = (id: number, authorId: string, over: Partial<Post> = {}): Post => ({
  id, authorId, status: "VISIBLE", deletedAt: null, author: ACTIVE, ...over,
});
// The fake is not the real Prisma client; one cast keeps the test short.
const run = (db: ReturnType<typeof fakeDb>, input: Parameters<typeof applySocialRepost>[1]) =>
  applySocialRepost(db as unknown as Parameters<typeof applySocialRepost>[0], input);

async function main() {
  // 1. plain repost, then the same again: one row
  {
    const db = fakeDb([post(1, "bob")]);
    const first = await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    assert.deepEqual(first, { ok: true, reposted: true, quoted: false, reposts: 1, changed: true, notified: true });
    const second = await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    assert.deepEqual(second, { ok: true, reposted: true, quoted: false, reposts: 1, changed: false, notified: false });
    assert.equal(db.reposts.length, 1);
    ok("repost once; a second repost changes nothing");
  }

  // 2. undo, and undo again
  {
    const db = fakeDb([post(1, "bob")]);
    await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    const undone = await run(db, { userId: "amy", socialPostId: 1, action: "undo" });
    assert.deepEqual(undone, { ok: true, reposted: false, quoted: false, reposts: 0, changed: true, notified: false });
    const again = await run(db, { userId: "amy", socialPostId: 1, action: "undo" });
    assert.deepEqual(again, { ok: true, reposted: false, quoted: false, reposts: 0, changed: false, notified: false });
    ok("undo removes the row; undoing again is harmless");
  }

  // 3. exactly ONE notification per person per post, ever
  {
    const db = fakeDb([post(1, "bob")]);
    for (let i = 0; i < 4; i++) {
      await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
      await run(db, { userId: "amy", socialPostId: 1, action: "undo" });
    }
    assert.equal(db.notifications.length, 1);
    assert.equal(db.notifications[0].type, REPOST_NOTIFICATION);
    assert.equal(db.notifications[0].recipientId, "bob");
    assert.equal(db.notifications[0].actorId, "amy");
    assert.equal(db.notifications[0].socialPostId, 1);
    await run(db, { userId: "cat", socialPostId: 1, action: "repost" });
    assert.equal(db.notifications.length, 2);
    ok("repost -> undo -> repost (x4) gives ONE notification; another person gives another");
  }

  // 4. your own post: allowed, no notification
  {
    const db = fakeDb([post(1, "amy")]);
    const result = await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    assert.equal(result.ok, true);
    assert.equal(db.reposts.length, 1);
    assert.equal(db.notifications.length, 0);
    ok("reposting your own post is allowed and notifies nobody");
  }

  // 5. quote: cleaned text is saved; the same person's plain repost becomes a quote; no second row, no second notification
  {
    const db = fakeDb([post(1, "bob")]);
    await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    const quoted = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote: "  great‮ point  \r\n" });
    assert.deepEqual(quoted, { ok: true, reposted: true, quoted: true, reposts: 1, changed: true, notified: false });
    assert.equal(db.reposts.length, 1);
    assert.equal(db.reposts[0].quoteText, "great point");
    assert.equal(db.notifications.length, 1);
    const same = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote: "great point" });
    assert.equal(same.ok && same.changed, false);
    const edited = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote: "even better" });
    assert.equal(edited.ok && edited.changed, true);
    assert.equal(db.reposts[0].quoteText, "even better");
    // a plain repost press on something already quoted keeps the quote
    const plain = await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    assert.deepEqual(plain, { ok: true, reposted: true, quoted: true, reposts: 1, changed: false, notified: false });
    assert.equal(db.reposts[0].quoteText, "even better");
    ok("quote turns a repost into a quote (one row, one notification); same text = no change; plain repost keeps the quote");
  }

  // 6. a new quote straight away
  {
    const db = fakeDb([post(1, "bob")]);
    const r = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote: "hello" });
    assert.deepEqual(r, { ok: true, reposted: true, quoted: true, reposts: 1, changed: true, notified: true });
    ok("a first-time quote creates the row and one notification");
  }

  // 7. quote text refused: empty, only invisible characters, too long, wrong type
  {
    const db = fakeDb([post(1, "bob")]);
    for (const quote of ["", "   \n  ", "​​", "x".repeat(SOCIAL_MAX_BODY + 1), undefined, null, 42, {}]) {
      const r = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote });
      assert.deepEqual(r, { ok: false, reason: "invalid" });
    }
    assert.equal(db.reposts.length, 0);
    const longest = await run(db, { userId: "amy", socialPostId: 1, action: "quote", quote: "x".repeat(SOCIAL_MAX_BODY) });
    assert.equal(longest.ok, true);
    ok(`bad quote text is refused (empty, invisible, over ${SOCIAL_MAX_BODY}, not a string); exactly ${SOCIAL_MAX_BODY} is fine`);
  }

  // 8. posts that may not be shown: hidden, removed, deleted, author deleting / erased, unknown
  {
    const cases: Array<[string, Post | null]> = [
      ["hidden", post(1, "bob", { status: "HIDDEN" })],
      ["removed", post(1, "bob", { status: "REMOVED" })],
      ["deleted", post(1, "bob", { deletedAt: new Date() })],
      ["author deletion pending", post(1, "bob", { author: { status: "DELETION_PENDING", deletedAt: null } })],
      ["author deleted", post(1, "bob", { author: { status: "DELETED", deletedAt: new Date() } })],
      ["unknown", null],
    ];
    for (const [label, p] of cases) {
      const db = fakeDb(p ? [p] : []);
      for (const action of ["repost", "quote"] as const) {
        const r = await run(db, { userId: "amy", socialPostId: 1, action, quote: "hi" });
        assert.deepEqual(r, { ok: false, reason: "notfound" }, `${label} / ${action}`);
      }
      assert.equal(db.reposts.length, 0, label);
      assert.equal(db.notifications.length, 0, label);
    }
    // a suspended / banned author's visible post can be reposted (same as the feeds)
    const db = fakeDb([post(1, "bob", { author: { status: "SUSPENDED", deletedAt: null } })]);
    assert.equal((await run(db, { userId: "amy", socialPostId: 1, action: "repost" })).ok, true);
    ok("hidden / removed / deleted posts and gone authors: not found, nothing saved; suspended author: allowed");
  }

  // 9. undo is always allowed, even when the post is no longer shown
  {
    const db = fakeDb([post(1, "bob")]);
    await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    const p = (db as unknown as { socialPost: { findFirst: unknown } });
    p.socialPost.findFirst = async () => post(1, "bob", { status: "REMOVED" });
    const undone = await run(db, { userId: "amy", socialPostId: 1, action: "undo" });
    assert.equal(undone.ok && undone.reposted, false);
    assert.equal(db.reposts.length, 0);
    ok("undo works even after the post was removed");
  }

  // 10. the count is per post and counts plain and quote reposts together
  {
    const db = fakeDb([post(1, "bob"), post(2, "bob")]);
    await run(db, { userId: "amy", socialPostId: 1, action: "repost" });
    await run(db, { userId: "cat", socialPostId: 1, action: "quote", quote: "yes" });
    const r = await run(db, { userId: "dan", socialPostId: 2, action: "repost" });
    assert.equal(r.ok && r.reposts, 1);
    const r2 = await run(db, { userId: "eve", socialPostId: 1, action: "repost" });
    assert.equal(r2.ok && r2.reposts, 3);
    ok("the count is per post and includes quotes");
  }

  // 11. bad input
  {
    const db = fakeDb([post(1, "bob")]);
    for (const socialPostId of [0, -1, 1.5, NaN, "1", null, undefined, Number.MAX_SAFE_INTEGER + 2]) {
      assert.deepEqual(await run(db, { userId: "amy", socialPostId, action: "repost" }), { ok: false, reason: "error" });
    }
    for (const action of ["", "REPOST", "like", null, undefined, 1]) {
      assert.deepEqual(await run(db, { userId: "amy", socialPostId: 1, action }), { ok: false, reason: "error" });
    }
    assert.deepEqual(await run(db, { userId: "", socialPostId: 1, action: "repost" }), { ok: false, reason: "error" });
    assert.deepEqual([...REPOST_ACTIONS], ["repost", "quote", "undo"]);
    assert.equal(db.reposts.length, 0);
    ok("bad post number, action or person is refused without touching anything");
  }

  // 12. the database key refuses a second row (what a double click would hit)
  {
    const db = fakeDb([post(1, "bob")]);
    await db.socialRepost.create({ data: { userId: "amy", socialPostId: 1, quoteText: null } });
    await assert.rejects(() => db.socialRepost.create({ data: { userId: "amy", socialPostId: 1, quoteText: null } }), { code: "P2002" });
    ok("(stand-in) the unique key refuses a second row; the action retries once on that error");
  }

  // 13. limits
  const rules = socialLimits.reposts.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
  assert.ok(rules.length >= 1);
  const now = 10_000_000;
  for (const rule of rules) {
    const times = Array.from({ length: rule.max }, (_, i) => now - i * 10);
    assert.equal(checkRules(times, rules, now).ok, false);
    assert.equal(checkRules(times.slice(1), [rule], now).ok, true);
  }
  ok("repost limits: " + socialLimits.reposts.map((rule) => `${rule.max} per ${rule.windowSeconds} s`).join(", "));

  // 14. texts
  const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
  const keys = ["social.repost.label", "social.unrepost.label", "social.quote", "social.quote.field", "social.quote.submit",
    "social.quote.cancel", "social.quote.saving", "social.repost.login", "social.repost.toomany", "social.repost.error",
    "social.quote.invalid", "social.repost.by", "social.quote.by", "social.quotes.title"];
  for (const [lang, m] of Object.entries(languages)) {
    for (const k of keys) {
      assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
      assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
      if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
    }
    assert.ok((m["social.repost.by"] as string).includes("{name}"), `${lang}: {name} lost in social.repost.by`);
    assert.ok((m["social.quotes.title"] as string).includes("{count}"), `${lang}: {count} lost in social.quotes.title`);
  }
  ok("all 14 repost texts exist in six languages; {name} and {count} are kept");

  console.log("\nAll social repost tests passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
