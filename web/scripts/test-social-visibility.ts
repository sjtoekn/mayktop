// Test: whose social posts are shown (SOCIAL_TODO 7). Run:  npm run test:social-visibility
// Uses the local database but changes NOTHING: everything happens inside one transaction that is rolled back.
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { socialAuthorShown } from "../src/lib/social-visibility";
import { ContentStatus, UserStatus } from "../generated/prisma/client";

function ok(name: string) { console.log("OK  " + name); }
class Rollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const stamp = Date.now();
      const posts: Record<string, number> = {};
      for (const status of [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DELETION_PENDING, UserStatus.DELETED]) {
        const u = await tx.user.create({
          data: {
            username: `t_${status.toLowerCase()}_${stamp}`,
            email: `t_${status.toLowerCase()}_${stamp}@example.invalid`,
            status,
            deletedAt: status === UserStatus.DELETED ? new Date() : null,
          },
        });
        const p = await tx.socialPost.create({ data: { authorId: u.id, body: `post of ${status}` } });
        posts[status] = p.id;
      }
      const hiddenAuthor = await tx.user.create({ data: { username: `t_hid_${stamp}`, email: `t_hid_${stamp}@example.invalid` } });
      const hiddenPost = await tx.socialPost.create({ data: { authorId: hiddenAuthor.id, body: "x", status: ContentStatus.HIDDEN_PENDING_REVIEW } });

      const shown = await tx.socialPost.findMany({
        where: { id: { in: [...Object.values(posts), hiddenPost.id] }, status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
        select: { id: true },
      });
      const ids = new Set(shown.map((p) => p.id));

      assert.equal(ids.has(posts.ACTIVE), true);
      ok("an active person's post is shown");
      assert.equal(ids.has(posts.SUSPENDED), true);
      ok("a suspended / banned person's post is still shown (only moderation with a rule number hides a post)");
      assert.equal(ids.has(posts.DELETION_PENDING), false);
      ok("a post of a person who asked to delete the account is not shown (it returns if they keep the account)");
      assert.equal(ids.has(posts.DELETED), false);
      ok("a post of an erased account is not shown");
      assert.equal(ids.has(hiddenPost.id), false);
      ok("a hidden post is not shown whoever wrote it");

      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  console.log("\nAll social visibility tests passed (nothing was saved to the database).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
