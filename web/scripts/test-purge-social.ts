// Test for the social part of final erasure (SOCIAL_TODO 5). Run:  npm run test:purge-social
// Uses the local database but changes NOTHING: everything happens inside one transaction that is rolled back at the end.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { eraseSocial, socialPostsForRecord } from "../src/lib/purge-social";
import { ContentStatus } from "../generated/prisma/client";

function ok(name: string) { console.log("OK  " + name); }
class Rollback extends Error {}

async function main() {
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now();
      const mk = (n: string) => tx.user.create({ data: { username: `t_${n}_${stamp}`, email: `t_${n}_${stamp}@example.invalid` } });
      const gone = await mk("gone");
      const other = await mk("other");

      const mine = await tx.socialPost.create({ data: { authorId: gone.id, body: "my secret text", mediaUrl: "/uploads/x.png" } });
      const hidden = await tx.socialPost.create({ data: { authorId: gone.id, body: "rule-breaking text", status: ContentStatus.HIDDEN_PENDING_REVIEW } });
      const theirs = await tx.socialPost.create({ data: { authorId: other.id, body: "someone else" } });

      await tx.socialPostLike.create({ data: { userId: gone.id, socialPostId: theirs.id } });
      await tx.socialPostLike.create({ data: { userId: other.id, socialPostId: mine.id } });
      await tx.socialRepost.create({ data: { userId: gone.id, socialPostId: theirs.id, quoteText: "my quote" } });
      await tx.socialReply.create({ data: { socialPostId: theirs.id, authorId: gone.id, body: "my reply" } });
      await tx.follow.create({ data: { followerId: gone.id, followingId: other.id } });
      await tx.follow.create({ data: { followerId: other.id, followingId: gone.id } });
      await tx.notification.create({ data: { recipientId: other.id, actorId: gone.id, type: "SOCIAL_POST_LIKE", socialPostId: theirs.id } });
      await tx.notification.create({ data: { recipientId: gone.id, actorId: other.id, type: "SOCIAL_POST_LIKE", socialPostId: mine.id } });

      const record = await socialPostsForRecord(tx, gone.id);
      assert.deepEqual(record.map((p) => p.id), [hidden.id]);
      ok("only the hidden / removed social post goes into the safety record");

      const out = await eraseSocial(tx, gone.id, now);
      assert.deepEqual(out, { posts: 2, replies: 1, reposts: 1, follows: 2, notifications: 2 });
      ok("the erasure reports what it changed");

      const p = await tx.socialPost.findUniqueOrThrow({ where: { id: mine.id } });
      assert.equal(p.body, ""); assert.equal(p.mediaUrl, null); assert.notEqual(p.deletedAt, null);
      assert.equal((await tx.socialPost.findUniqueOrThrow({ where: { id: hidden.id } })).body, "");
      ok("social post text and picture link are erased, the row stays");

      const o = await tx.socialPost.findUniqueOrThrow({ where: { id: theirs.id } });
      assert.equal(o.body, "someone else"); assert.equal(o.deletedAt, null);
      ok("another person's post is not touched");

      assert.equal((await tx.socialReply.findFirstOrThrow({ where: { authorId: gone.id } })).body, ""); // the reply text is erased, the row stays
      assert.equal((await tx.socialRepost.findFirstOrThrow({ where: { userId: gone.id } })).quoteText, null);
      assert.equal(await tx.socialPostLike.count({ where: { userId: gone.id } }), 1);
      ok("quote text erased; the like stays as an anonymous count");

      assert.equal(await tx.follow.count({ where: { OR: [{ followerId: gone.id }, { followingId: gone.id }] } }), 0);
      assert.equal(await tx.notification.count({ where: { OR: [{ recipientId: gone.id }, { actorId: gone.id }] } }), 0);
      ok("follows (both ways) and notifications (both ways) are deleted");

      const again = await eraseSocial(tx, gone.id, now);
      assert.deepEqual(again, { posts: 0, replies: 0, reposts: 0, follows: 0, notifications: 0 });
      ok("running it twice is harmless");

      throw new Rollback(); // leave the database exactly as it was
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  console.log("\nAll social erasure tests passed (nothing was saved to the database).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
