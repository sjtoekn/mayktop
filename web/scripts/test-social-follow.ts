// Test: follow / unfollow (SOCIAL_TODO 15). Run:  npm run test:social-follow
// Needs no database: applySocialFollow() is run against a small in-memory stand-in for the database.
import assert from "node:assert/strict";
import { applySocialFollow, cleanFollowUsername, MAX_USERNAME_LENGTH } from "../src/lib/social-follow";
import { isSocialAuthorShown, socialAuthorShown } from "../src/lib/social-visibility";
import { checkRules } from "../src/lib/social-limits";
import { socialLimits } from "../src/config/site";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

type User = { id: string; username: string; status: string; deletedAt: Date | null };
type Follow = { followerId: string; followingId: string };
type Notification = { id: number; recipientId: string; actorId: string; type: string };

// Just enough of Prisma's user / follow / notification calls for the rules in social-follow.ts.
function fakeDb(users: User[]) {
  const follows: Follow[] = [];
  const notifications: Notification[] = [];
  let nextId = 1;
  const match = (row: object, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  return {
    follows,
    notifications,
    socialBlock: { findFirst: async () => null }, // nobody is blocked in this test (patch-social-block)
    user: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => users.find((u) => match(u, where)) ?? null,
    },
    follow: {
      findUnique: async ({ where }: { where: { followerId_followingId: Follow } }) =>
        follows.find((f) => match(f, where.followerId_followingId)) ?? null,
      create: async ({ data }: { data: Follow }) => {
        // the real table has a primary key on the pair: a second row is refused
        if (follows.some((f) => match(f, data))) throw Object.assign(new Error("unique"), { code: "P2002" });
        follows.push({ ...data });
        return data;
      },
      delete: async ({ where }: { where: { followerId_followingId: Follow } }) => {
        const i = follows.findIndex((f) => match(f, where.followerId_followingId));
        if (i < 0) throw new Error("not found");
        return follows.splice(i, 1)[0];
      },
      count: async ({ where }: { where: Record<string, unknown> }) => follows.filter((f) => match(f, where)).length,
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
const user = (id: string, over: Partial<User> = {}): User => ({ id, username: id, status: "ACTIVE", deletedAt: null, ...over });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (db: ReturnType<typeof fakeDb>, input: { followerId: string; username: unknown; follow: unknown }) => applySocialFollow(db as any, input);

async function main() {
  // 1. follow: one row, count, one notification for the person followed
  let db = fakeDb([user("me"), user("maya")]);
  let r = await run(db, { followerId: "me", username: "maya", follow: true });
  assert.deepEqual(r, { ok: true, following: true, followers: 1, changed: true, notified: true });
  assert.deepEqual(db.follows, [{ followerId: "me", followingId: "maya" }]);
  assert.equal(db.notifications.length, 1);
  assert.deepEqual(
    { recipientId: db.notifications[0].recipientId, actorId: db.notifications[0].actorId, type: db.notifications[0].type },
    { recipientId: "maya", actorId: "me", type: "FOLLOW" },
  );
  ok("follow saves one row, counts followers and notifies the person followed");

  // 2. following again changes nothing
  r = await run(db, { followerId: "me", username: "maya", follow: true });
  assert.deepEqual(r, { ok: true, following: true, followers: 1, changed: false, notified: false });
  assert.equal(db.follows.length, 1);
  assert.equal(db.notifications.length, 1);
  ok("following twice makes no second row and no second notification");

  // 3. unfollow removes; follow again does NOT notify again (no notification spam)
  r = await run(db, { followerId: "me", username: "maya", follow: false });
  assert.deepEqual(r, { ok: true, following: false, followers: 0, changed: true, notified: false });
  assert.equal(db.follows.length, 0);
  assert.equal(db.notifications.length, 1, "nobody is told about an unfollow");
  r = await run(db, { followerId: "me", username: "maya", follow: true });
  assert.deepEqual(r, { ok: true, following: true, followers: 1, changed: true, notified: false });
  assert.equal(db.notifications.length, 1);
  for (let i = 0; i < 5; i++) {
    await run(db, { followerId: "me", username: "maya", follow: false });
    await run(db, { followerId: "me", username: "maya", follow: true });
  }
  assert.equal(db.notifications.length, 1);
  ok("follow / unfollow in a loop gives the person followed ONE notification in total");

  // 4. unfollow when not following: nothing happens, no error
  db = fakeDb([user("me"), user("maya")]);
  r = await run(db, { followerId: "me", username: "maya", follow: false });
  assert.deepEqual(r, { ok: true, following: false, followers: 0, changed: false, notified: false });
  ok("unfollowing someone you do not follow changes nothing");

  // 5. yourself
  db = fakeDb([user("me")]);
  r = await run(db, { followerId: "me", username: "me", follow: true });
  assert.deepEqual(r, { ok: false, reason: "self" });
  r = await run(db, { followerId: "me", username: "  ME ", follow: true });
  assert.deepEqual(r, { ok: false, reason: "self" });
  assert.equal(db.follows.length, 0);
  assert.equal(db.notifications.length, 0);
  ok("nobody can follow themselves (also with spaces or capitals)");

  // 6. unknown person
  r = await run(db, { followerId: "me", username: "nobody", follow: true });
  assert.deepEqual(r, { ok: false, reason: "notfound" });
  ok("an unknown username is \"not found\"");

  // 7. who can be followed: ACTIVE and SUSPENDED / banned yes; DELETION_PENDING and DELETED no
  const states: [string, Date | null, boolean][] = [
    ["ACTIVE", null, true],
    ["SUSPENDED", null, true],
    ["DELETION_PENDING", null, false],
    ["DELETED", new Date(), false],
    ["ACTIVE", new Date(), false],
  ];
  for (const [status, deletedAt, allowed] of states) {
    db = fakeDb([user("me"), user("them", { status, deletedAt })]);
    r = await run(db, { followerId: "me", username: "them", follow: true });
    if (allowed) {
      assert.equal(r.ok, true, `${status} should be followable`);
      assert.equal(db.follows.length, 1);
    } else {
      assert.deepEqual(r, { ok: false, reason: "notfound" }, `${status}${deletedAt ? "+deletedAt" : ""} must not be followable`);
      assert.equal(db.follows.length, 0);
      assert.equal(db.notifications.length, 0);
    }
  }
  ok("ACTIVE and suspended / banned accounts can be followed; deleting and erased accounts cannot");

  // 8. unfollow is always allowed, even when the other account is going away
  for (const status of ["SUSPENDED", "DELETION_PENDING", "DELETED"]) {
    db = fakeDb([user("me"), user("them", { status, deletedAt: status === "DELETED" ? new Date() : null })]);
    db.follows.push({ followerId: "me", followingId: "them" });
    r = await run(db, { followerId: "me", username: "them", follow: false });
    assert.deepEqual(r, { ok: true, following: false, followers: 0, changed: true, notified: false });
    assert.equal(db.follows.length, 0);
  }
  ok("you can always unfollow, whatever the state of the other account");

  // 9. an old follow of an account that is now going away is kept as it is when "follow" is sent again
  db = fakeDb([user("me"), user("them", { status: "DELETION_PENDING" })]);
  db.follows.push({ followerId: "me", followingId: "them" });
  r = await run(db, { followerId: "me", username: "them", follow: true });
  assert.deepEqual(r, { ok: true, following: true, followers: 1, changed: false, notified: false });
  ok("an existing follow is not touched when the other account starts to delete itself (it comes back with the account)");

  // 10. followers are counted per person
  db = fakeDb([user("a"), user("b"), user("c"), user("maya")]);
  await run(db, { followerId: "a", username: "maya", follow: true });
  await run(db, { followerId: "b", username: "maya", follow: true });
  r = await run(db, { followerId: "c", username: "maya", follow: true });
  assert.equal(r.ok && r.followers, 3);
  r = await run(db, { followerId: "c", username: "a", follow: true });
  assert.equal(r.ok && r.followers, 1);
  assert.equal(db.notifications.length, 4);
  ok("followers are counted per person; every different follower gets noticed once");

  // 11. bad input
  db = fakeDb([user("me"), user("maya")]);
  for (const username of [undefined, null, 42, {}, "", "   ", "x".repeat(MAX_USERNAME_LENGTH + 1)]) {
    r = await run(db, { followerId: "me", username, follow: true });
    assert.deepEqual(r, { ok: false, reason: "error" });
  }
  for (const follow of ["true", 1, null, undefined]) {
    r = await run(db, { followerId: "me", username: "maya", follow });
    assert.deepEqual(r, { ok: false, reason: "error" });
  }
  r = await run(db, { followerId: "", username: "maya", follow: true });
  assert.deepEqual(r, { ok: false, reason: "error" });
  assert.equal(db.follows.length, 0);
  assert.equal(cleanFollowUsername(" Maya "), "maya");
  assert.equal(cleanFollowUsername("x".repeat(MAX_USERNAME_LENGTH))?.length, MAX_USERNAME_LENGTH);
  ok("bad input (not text, empty, too long, follow not true / false) is refused and nothing is saved");

  // 12. one rule for \"whose posts are shown\": Follow and the feeds agree
  const wanted: Record<string, boolean> = { ACTIVE: true, SUSPENDED: true, DELETION_PENDING: false, DELETED: false };
  for (const [status, shown] of Object.entries(wanted)) {
    assert.equal(isSocialAuthorShown({ status, deletedAt: null }), shown, status);
  }
  assert.equal(isSocialAuthorShown({ status: "ACTIVE", deletedAt: new Date() }), false);
  const inList = (socialAuthorShown.status as { in: string[] }).in;
  assert.deepEqual([...inList].sort(), ["ACTIVE", "SUSPENDED"]);
  assert.equal(socialAuthorShown.deletedAt, null);
  ok("isSocialAuthorShown and socialAuthorShown (the feed rule) say the same");

  // 13. rate limit numbers
  const rules = socialLimits.follows.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
  assert.ok(rules.length >= 1);
  const now = 10_000_000;
  for (const rule of rules) {
    const times = Array.from({ length: rule.max }, (_, i) => now - i * 10);
    assert.equal(checkRules(times, rules, now).ok, false);
    assert.equal(checkRules(times.slice(1), [rule], now).ok, true);
  }
  ok("follow limits: " + socialLimits.follows.map((rule) => `${rule.max} per ${rule.windowSeconds} s`).join(", "));

  // 14. texts
  const languages: Record<string, Record<string, unknown>> = { en, es, fr, zh, hi, ar };
  const keys = ["social.follow", "social.following", "social.follow.label", "social.unfollow.label",
    "social.follow.login", "social.follow.toomany", "social.follow.error"];
  for (const [lang, m] of Object.entries(languages)) {
    for (const k of keys) {
      assert.equal(typeof m[k], "string", `${lang}: missing ${k}`);
      assert.ok((m[k] as string).trim().length > 0, `${lang}: ${k} empty`);
      if (lang !== "en") assert.notEqual(m[k], (en as Record<string, unknown>)[k], `${lang}: ${k} is English`);
    }
    for (const k of ["social.follow.label", "social.unfollow.label"]) {
      assert.ok((m[k] as string).includes("{username}"), `${lang}: {username} lost in ${k}`);
    }
  }
  ok("all 7 follow texts exist in six languages and {username} is kept");

  console.log("\nAll social follow tests passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
