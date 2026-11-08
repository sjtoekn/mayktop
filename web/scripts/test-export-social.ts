// Test for the social part of "Download my data" (SOCIAL_TODO 6). Run:  npm run test:export-social
// Uses the local database but changes NOTHING: everything happens inside one transaction that is rolled back.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getSocialExport } from "../src/lib/export-social";
import { ContentStatus } from "../generated/prisma/client";

function ok(name: string) { console.log("OK  " + name); }
class Rollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now();
      const mk = (n: string) => tx.user.create({ data: { username: `t_${n}_${stamp}`, email: `t_${n}_${stamp}@example.invalid` } });
      const me = await mk("me");
      const other = await mk("other");

      const mine = await tx.socialPost.create({ data: { authorId: me.id, body: "my text", mediaUrl: "/uploads/a.png" } });
      const hidden = await tx.socialPost.create({ data: { authorId: me.id, body: "hidden text", status: ContentStatus.HIDDEN_PENDING_REVIEW } });
      const deleted = await tx.socialPost.create({ data: { authorId: me.id, body: "", deletedAt: new Date() } });
      const theirs = await tx.socialPost.create({ data: { authorId: other.id, body: "SECRET OF OTHER" } });

      await tx.socialPostLike.create({ data: { userId: me.id, socialPostId: theirs.id } });
      await tx.socialPostLike.create({ data: { userId: other.id, socialPostId: mine.id } });
      await tx.socialRepost.create({ data: { userId: me.id, socialPostId: theirs.id, quoteText: "my quote" } });
      await tx.follow.create({ data: { followerId: me.id, followingId: other.id } });
      await tx.follow.create({ data: { followerId: other.id, followingId: me.id } });
      await tx.notification.create({ data: { recipientId: me.id, actorId: other.id, type: "SOCIAL_POST_LIKE", socialPostId: mine.id } });
      await tx.notification.create({ data: { recipientId: other.id, actorId: me.id, type: "SOCIAL_POST_LIKE", socialPostId: theirs.id } });

      const out = await getSocialExport(tx, me.id);

      assert.deepEqual(out.posts.map((p) => p.id), [mine.id, hidden.id, deleted.id]);
      assert.equal(out.posts[1].status, ContentStatus.HIDDEN_PENDING_REVIEW);
      ok("all my social posts, also hidden and deleted ones, with their status");

      assert.deepEqual(out.likes.map((l) => l.socialPostId), [theirs.id]);
      assert.deepEqual(out.reposts.map((r) => [r.socialPostId, r.quoteText]), [[theirs.id, "my quote"]]);
      ok("likes and reposts are only mine (post numbers, my own quote text)");

      assert.deepEqual(out.following.map((f) => f.username), [other.username]);
      assert.equal(out.followersCount, 1);
      ok("who I follow (usernames) and how many follow me");

      assert.equal(out.notifications.length, 1);
      assert.equal(out.notifications[0].from, other.username);
      ok("only notifications I received");

      const json = JSON.stringify(out);
      assert.equal(json.includes("SECRET OF OTHER"), false);
      assert.equal(json.includes("example.invalid"), false);
      ok("no text of other people's posts and no other person's email");

      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  console.log("\nAll social export tests passed (nothing was saved to the database).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
