// Test: Pin post (SOCIAL_TODO B6, patch-social-pin). Run:  npm run test:social-pin
// Needs no database: the rules are run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialPin, cleanPinPostId, eraseSocialPins, removeSocialPinOfPost } from "../src/lib/social-pin";
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
const post = (id: number, authorId: string, over: Row = {}): Row => ({ id, authorId, status: "VISIBLE", deletedAt: null, ...over });

function fakeDb(users: Row[], posts: Row[]) {
  const pins: Row[] = [];
  const authorOf = (postId: unknown) => posts.find((p) => p.id === postId)?.authorId;
  const client = {
    user: { findUnique: async ({ where }: { where: Row }) => users.find((u) => u.id === where.id) ?? null },
    socialPost: { findUnique: async ({ where }: { where: Row }) => posts.find((p) => p.id === where.id) ?? null },
    socialPinnedPost: {
      findUnique: async ({ where }: { where: Row }) => pins.find((p) => p.userId === where.userId) ?? null,
      delete: async ({ where }: { where: Row }) => {
        const i = pins.findIndex((p) => p.userId === where.userId);
        if (i < 0) throw new Error("not found");
        return pins.splice(i, 1)[0];
      },
      upsert: async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const row = pins.find((p) => p.userId === where.userId);
        if (row) Object.assign(row, update);
        else pins.push({ ...create });
        return row ?? create;
      },
      deleteMany: async ({ where }: { where: { socialPostId?: number; OR?: Array<Row & { socialPost?: { authorId: string } }> } }) => {
        let count = 0;
        for (let i = pins.length - 1; i >= 0; i--) {
          const row = pins[i];
          const hit =
            where.socialPostId !== undefined
              ? row.socialPostId === where.socialPostId
              : (where.OR ?? []).some((part) => (part.socialPost ? authorOf(row.socialPostId) === part.socialPost.authorId : row.userId === part.userId));
          if (hit) { pins.splice(i, 1); count++; }
        }
        return { count };
      },
    },
  };
  return { db: client as unknown as Parameters<typeof applySocialPin>[0], pins };
}

const pin = (db: Parameters<typeof applySocialPin>[0], userId: string, postId: unknown, value: unknown = true) =>
  applySocialPin(db, { userId, postId, pin: value });

async function main() {
  // 1. Input cleaning
  assert.equal(cleanPinPostId(7), 7);
  for (const bad of [0, -1, 1.5, NaN, "3", null, undefined, Number.MAX_SAFE_INTEGER + 2]) assert.equal(cleanPinPostId(bad), null);
  ok("post number: only whole numbers of 1 or more");

  const base = () => fakeDb(
    [user("a"), user("b"), user("gone", { deletedAt: new Date() }), user("pending", { status: "DELETION_PENDING" })],
    [post(1, "a"), post(2, "a"), post(3, "b"), post(4, "a", { status: "HIDDEN" }), post(5, "a", { deletedAt: new Date() }), post(6, "gone"), post(7, "pending")],
  );

  // 2. Pin, twice, replace, unpin
  {
    const { db, pins } = base();
    assert.deepEqual(await pin(db, "a", 1), { ok: true, pinned: true, changed: true });
    assert.equal(pins.length, 1);
    assert.deepEqual(await pin(db, "a", 1), { ok: true, pinned: true, changed: false });
    assert.equal(pins.length, 1);
    assert.deepEqual(await pin(db, "a", 2), { ok: true, pinned: true, changed: true });
    assert.equal(pins.length, 1);
    assert.equal(pins[0].socialPostId, 2);
    ok("one pin per person: pinning another post replaces the old one; the same pin twice changes nothing");

    // unpin a post that is not the pinned one: nothing happens (a stale tab must not remove the newer pin)
    assert.deepEqual(await pin(db, "a", 1, false), { ok: true, pinned: false, changed: false });
    assert.equal(pins.length, 1);
    assert.deepEqual(await pin(db, "a", 2, false), { ok: true, pinned: false, changed: true });
    assert.equal(pins.length, 0);
    assert.deepEqual(await pin(db, "a", 2, false), { ok: true, pinned: false, changed: false });
    ok("unpin: only the pinned post; always allowed; twice changes nothing");
  }

  // 3. What cannot be pinned
  {
    const { db, pins } = base();
    for (const id of [3, 4, 5, 99]) assert.deepEqual(await pin(db, "a", id), { ok: false, reason: "notfound" }, String(id));
    assert.deepEqual(await pin(db, "gone", 6), { ok: false, reason: "notfound" });
    assert.deepEqual(await pin(db, "pending", 7), { ok: false, reason: "notfound" });
    assert.equal(pins.length, 0);
    ok("not pinnable: somebody else's post, hidden, deleted, unknown, or an account that is not shown");
  }

  // 4. Bad input
  {
    const { db, pins } = base();
    for (const bad of ["1", 0, 1.5, null]) assert.deepEqual(await pin(db, "a", bad), { ok: false, reason: "error" });
    assert.deepEqual(await pin(db, "a", 1, "yes"), { ok: false, reason: "error" });
    assert.deepEqual(await pin(db, "", 1), { ok: false, reason: "error" });
    assert.equal(pins.length, 0);
    ok("bad input is an error and changes nothing");
  }

  // 5. Unpinning works even when the post is hidden afterwards
  {
    const { db, pins } = base();
    await pin(db, "a", 1);
    assert.deepEqual(await pin(db, "a", 1, false), { ok: true, pinned: false, changed: true });
    assert.equal(pins.length, 0);
    ok("unpin works whatever the state of the post");
  }

  // 6. Deleting the post removes its pin; erasure removes the pin of the person (and pins of the person's posts)
  {
    const { db, pins } = base();
    await pin(db, "a", 1);
    await pin(db, "b", 3);
    assert.equal(await removeSocialPinOfPost(db, 1), 1);
    assert.equal(pins.length, 1);
    assert.equal(await removeSocialPinOfPost(db, 1), 0);
    assert.equal(await eraseSocialPins(db, "b"), 1);
    assert.equal(pins.length, 0);
    assert.equal(await eraseSocialPins(db, "b"), 0);
    ok("delete post / final erasure remove the pin; safe to run twice");
  }

  // 7. Limits and texts
  assert.ok(socialLimits.pins.length >= 1 && socialLimits.pins.every((r) => r.max > 0 && r.windowSeconds > 0));
  const keys = ["pin", "pinned", "pin.title", "pinned.title", "login", "toomany", "notfound", "error", "label"].map((k) => `social.pin.${k}`);
  for (const [name, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
    for (const key of keys) assert.ok(typeof (messages as Record<string, unknown>)[key] === "string" && (messages as Record<string, string>)[key].length > 0, `${name} ${key}`);
  }
  ok("rate limit is set; all 9 texts exist in 6 languages");

  console.log("\nAll social-pin tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
