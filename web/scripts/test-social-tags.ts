// Test: hashtags and mentions in Social posts (SOCIAL_TODO 6). Run:  npm run test:social-tags
// Needs no database: the parser is plain functions, and the saving (syncSocialTags) runs against a small in-memory
// stand-in for the database.
import assert from "node:assert/strict";
import {
  SOCIAL_MAX_MENTIONS,
  SOCIAL_MAX_TAGS,
  parseSocialTags,
  parseTagParam,
  tagHref,
  tokenizeSocialBody,
} from "../src/lib/social-tags";
import { MENTION_NOTIFICATION, eraseSocialTags, removeSocialTags, syncSocialTags } from "../src/lib/social-tag-sync";
import en from "../src/i18n/messages/en";
import es from "../src/i18n/messages/es";
import fr from "../src/i18n/messages/fr";
import zh from "../src/i18n/messages/zh";
import hi from "../src/i18n/messages/hi";
import ar from "../src/i18n/messages/ar";

function ok(name: string) { console.log("OK  " + name); }

async function main() {

// ---------------------------------------------------------------- hashtags
assert.deepEqual(parseSocialTags("Hello #World and #world again").tags, ["world"]);
assert.deepEqual(parseSocialTags("#Colombo, #Kandy. (#galle) #a_b").tags, ["colombo", "kandy", "galle", "a_b"]);
assert.deepEqual(parseSocialTags("#1a #2024news").tags, ["1a", "2024news"]);
ok("hashtags: found, lower case, once each, punctuation is not part of them");

for (const text of ["#123", "#", "# space", "a#b", "see https://example.com/page#section", "https://x.com/#/path", "##x", "&#38;", "path/#tag", "@#tag", "word#tag"]) {
  assert.deepEqual(parseSocialTags(text).tags, [], text);
}
ok("not hashtags: numbers only, lone #, inside a word or web address, ##x");

// Sinhala, with the vowel signs and the zero-width joiner that the script needs
assert.deepEqual(parseSocialTags("#කොළඹ ලස්සනයි").tags, ["කොළඹ"]);
assert.deepEqual(parseSocialTags("#ශ්\u200Dරී ලංකා").tags, ["ශ්\u200Dරී"]);
assert.deepEqual(parseSocialTags("#ශ්\u200Dරී\u200D ලංකා").tags, ["ශ්\u200Dරී"]);
assert.deepEqual(parseSocialTags("#हिन्दी और #العربية و #中文").tags, ["हिन्दी", "العربية", "中文"]);
ok("hashtags: Sinhala (with joiner), Hindi, Arabic and Chinese work");

assert.deepEqual(parseSocialTags("#" + "a".repeat(50)).tags, ["a".repeat(50)]);
assert.deepEqual(parseSocialTags("#" + "a".repeat(51)).tags, []);
ok("hashtags: 50 characters at most (longer is not cut, it is not a hashtag)");

{
  const many = Array.from({ length: 14 }, (_, i) => `#tag${i}`).join(" ");
  const tags = parseSocialTags(many + " #tag0 #tag13").tags;
  assert.equal(tags.length, SOCIAL_MAX_TAGS);
  assert.deepEqual(tags, Array.from({ length: SOCIAL_MAX_TAGS }, (_, i) => `tag${i}`));
  // repeating a tag does not use up the limit
  assert.equal(parseSocialTags("#a1 #a1 #a1 #a1 #a1 #a1 #a1 #a1 #a1 #a1 #a1 #a1 #b2").tags.length, 2);
}
ok(`hashtags: only the first ${SOCIAL_MAX_TAGS} different ones count`);

// ---------------------------------------------------------------- mentions
assert.deepEqual(parseSocialTags("hi @Alice and @bob_01! and @alice").mentions, ["alice", "bob_01"]);
for (const text of ["mail me@example.com", "@ab", "@" + "a".repeat(21), "@@alice", "x@alice", "@ ", "email: a.b@c.de"]) {
  assert.deepEqual(parseSocialTags(text).mentions, [], text);
}
assert.deepEqual(parseSocialTags("@" + "a".repeat(20)).mentions, ["a".repeat(20)]);
assert.deepEqual(parseSocialTags("@\u212Aevin").mentions, []); // KELVIN SIGN is not a K
ok("mentions: lower-cased, once each; e-mail addresses, too short, too long and look-alike letters are not mentions");

{
  const names = ["aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg"];
  const mentions = parseSocialTags(names.map((n) => "@" + n).join(" ")).mentions;
  assert.deepEqual(mentions, names.slice(0, SOCIAL_MAX_MENTIONS));
}
ok(`mentions: only the first ${SOCIAL_MAX_MENTIONS} different ones count`);

// ---------------------------------------------------------------- showing
{
  const body = "Hi @bob_01 and @nobody, see #News today!\n\n#ශ්\u200Dරී @alice";
  const parts = tokenizeSocialBody(body, ["bob_01", "alice"]);
  assert.equal(parts.map((p) => p.text).join(""), body, "the text comes back whole");
  assert.deepEqual(parts.filter((p) => p.kind !== "text").map((p) => `${p.kind}:${"value" in p ? p.value : ""}`), [
    "mention:bob_01", "tag:news", "tag:ශ්\u200Dරී", "mention:alice",
  ]);
  // @nobody was not saved (no such account): plain text
  assert.ok(parts.some((p) => p.kind === "text" && p.text.includes("@nobody")));
  // the visible text of a link is what the person typed (#News), the link value is the saved form
  assert.equal(parts.find((p) => p.kind === "tag")?.text, "#News");
}
{
  const body = Array.from({ length: 12 }, (_, i) => `#t${i}x`).join(" ");
  const links = tokenizeSocialBody(body).filter((p) => p.kind === "tag");
  assert.equal(links.length, SOCIAL_MAX_TAGS, "the same limit as saving");
  assert.equal(tokenizeSocialBody("").length, 0);
  assert.deepEqual(tokenizeSocialBody("plain text"), [{ kind: "text", text: "plain text" }]);
}
ok("showing: links only what is saved; the text always comes back whole");

// ---------------------------------------------------------------- the address
assert.equal(parseTagParam("Colombo"), "colombo");
assert.equal(parseTagParam("#Colombo"), "colombo");
assert.equal(parseTagParam(encodeURIComponent("කොළඹ")), "කොළඹ");
assert.equal(parseTagParam("කොළඹ"), "කොළඹ");
for (const bad of [undefined, null, 5, "", "#", "123", "a b", "a/b", "co%2Flombo", "%E0%A4%A", "a".repeat(51), ["x"]]) {
  assert.equal(parseTagParam(bad), null, String(bad));
}
assert.equal(tagHref("කොළඹ"), "/social/tag/" + encodeURIComponent("කොළඹ"));
assert.equal(parseTagParam(tagHref("කොළඹ").split("/").pop()), "කොළඹ");
ok("address: any case, with or without #, encoded or not; anything that is not a hashtag is refused");

// ---------------------------------------------------------------- saving (in-memory stand-in for the database)
type Row = Record<string, unknown>;
function fakeDb() {
  const db = {
    users: [
      { id: "u-alice", username: "alice", status: "ACTIVE", deletedAt: null },
      { id: "u-bob", username: "bob", status: "ACTIVE", deletedAt: null },
      { id: "u-carol", username: "carol", status: "SUSPENDED", deletedAt: null },
      { id: "u-dave", username: "dave", status: "DELETION_PENDING", deletedAt: null },
      { id: "u-erin", username: "erin", status: "DELETED", deletedAt: new Date() },
    ] as Row[],
    posts: [{ id: 1, authorId: "u-alice" }, { id: 2, authorId: "u-bob" }] as Row[],
    tags: [] as Row[],
    mentions: [] as Row[],
    notifications: [] as Row[],
    nextId: 1,
  };
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && "in" in (value as Row)) return ((value as { in: unknown[] }).in).includes(row[key]);
      return row[key] === value;
    });
  const table = (rows: Row[], autoId = false) => ({
    findMany: async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).map((row) => ({ ...row })),
    findFirst: async ({ where }: { where: Row }) => rows.find((row) => matches(row, where)) ?? null,
    create: async ({ data }: { data: Row }) => { const row = { ...data, ...(autoId ? { id: db.nextId++ } : {}), readAt: null }; rows.push(row); return row; },
    deleteMany: async ({ where }: { where: Row }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) { rows.splice(i, 1); count++; }
      return { count };
    },
  });
  const client = {
    socialBlock: { findMany: async () => [] }, // nobody is blocked in this test (patch-social-block)
    user: { findMany: table(db.users).findMany },
    socialPostTag: table(db.tags),
    socialMention: table(db.mentions),
    notification: table(db.notifications, true),
  };
  return { db, client: client as unknown as Parameters<typeof syncSocialTags>[0] };
}
const noteTypes = (rows: Row[]) => rows.map((row) => `${row.type}:${row.recipientId}`);

{
  const { db, client } = fakeDb();
  const r = await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "Hi @bob and @carol, #News #news @alice @dave @erin @nobody" });
  assert.deepEqual(db.tags.map((t) => t.tag), ["news"]);
  assert.deepEqual(db.mentions.map((m) => m.userId).sort(), ["u-alice", "u-bob", "u-carol"], "accounts that may not be shown (deletion pending, erased, unknown) are not mentions");
  assert.deepEqual(noteTypes(db.notifications).sort(), [`${MENTION_NOTIFICATION}:u-bob`, `${MENTION_NOTIFICATION}:u-carol`], "nobody is notified about their own mention");
  assert.ok(db.notifications.every((n) => n.actorId === "u-alice" && n.socialPostId === 1));
  assert.equal(r.notified, 2);
  ok("saving: tags and mentions saved; a notification for each OTHER person who may be shown");
}
{
  const { db, client } = fakeDb();
  await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob @carol #news" });
  // bob has read his notification, carol has not
  (db.notifications.find((n) => n.recipientId === "u-bob") as Row).readAt = new Date();
  // edit: carol removed, bob kept, a new tag, a new person
  const r = await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob #news #sport @alice" });
  assert.deepEqual(db.tags.map((t) => t.tag).sort(), ["news", "sport"]);
  assert.deepEqual(db.mentions.map((m) => m.userId).sort(), ["u-alice", "u-bob"]);
  assert.deepEqual(noteTypes(db.notifications), [`${MENTION_NOTIFICATION}:u-bob`], "carol's unread notification went with her mention; bob was not told again");
  assert.equal(r.notified, 0);
  assert.equal(r.tagsAdded, 1);
  assert.equal(r.mentionsRemoved, 1);
  // saving the same text again changes nothing
  const again = await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob #news #sport @alice" });
  assert.deepEqual(again, { tagsAdded: 0, tagsRemoved: 0, mentionsAdded: 0, mentionsRemoved: 0, notified: 0 });
  ok("editing: tags and mentions follow the text; no second notification; an unread one is removed with its mention");
}
{
  const { db, client } = fakeDb();
  await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob" });
  (db.notifications[0] as Row).readAt = new Date();
  await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "no mention now" });
  assert.equal(db.mentions.length, 0);
  assert.equal(db.notifications.length, 1, "a notification that was already read stays");
  const r = await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob is back" });
  assert.equal(r.notified, 0, "one notification per person per post, ever");
  assert.equal(db.mentions.length, 1);
  ok("editing: the same person is never notified twice for the same post");
}
{
  const { db, client } = fakeDb();
  await syncSocialTags(client, { socialPostId: 1, authorId: "u-alice", body: "@bob #one" });
  await syncSocialTags(client, { socialPostId: 2, authorId: "u-bob", body: "@alice #one #two" });
  await removeSocialTags(client, 1);
  assert.deepEqual(db.tags.map((t) => `${t.socialPostId}:${t.tag}`).sort(), ["2:one", "2:two"]);
  assert.deepEqual(db.mentions.map((m) => m.socialPostId), [2]);
  ok("delete: only that post's tags and mentions are removed");
}
{
  // eraseSocialTags uses relation filters that the stand-in cannot run; check that the calls have the right shape
  const calls: unknown[] = [];
  const client = {
    socialPostTag: { deleteMany: async (arg: unknown) => { calls.push(["tag", arg]); return { count: 0 }; } },
    socialMention: { deleteMany: async (arg: unknown) => { calls.push(["mention", arg]); return { count: 0 }; } },
  } as unknown as Parameters<typeof eraseSocialTags>[0];
  await eraseSocialTags(client, "u-x");
  assert.deepEqual(calls, [
    ["tag", { where: { socialPost: { authorId: "u-x" } } }],
    ["mention", { where: { OR: [{ socialPost: { authorId: "u-x" } }, { userId: "u-x" }] } }],
  ]);
  ok("erasure: removes the tags of the person's posts and every mention of or by the person");
}

// ---------------------------------------------------------------- texts
for (const [lang, messages] of Object.entries({ en, es, fr, zh, hi, ar })) {
  for (const key of ["social.tag.title", "social.tag.empty", "notifications.type.mention"]) {
    assert.ok((messages as Record<string, string>)[key], `${lang}: missing ${key}`);
  }
  assert.ok((messages as Record<string, string>)["notifications.type.mention"].includes("{name}"), `${lang}: {name} missing in notifications.type.mention`);
}
ok("texts: 3 new texts exist in all six languages");

console.log("\nAll social-tags checks passed.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
