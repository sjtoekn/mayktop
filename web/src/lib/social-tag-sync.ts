// Saving the hashtags and mentions of a Social post (SOCIAL_TODO 6, patch-social-tags). Called INSIDE the transaction of
// the action that saves or edits the post, so the post and its tags are saved together or not at all.
//
// syncSocialTags(): makes the saved hashtags and mentions equal to what the text says now (new ones are added, ones that are
// gone are removed). Mentions:
//  - only an account that exists and may be shown (social-visibility.ts) is a mention; anything else stays plain text;
//  - the person mentioned gets ONE `SOCIAL_MENTION` notification per post (the same person is never notified twice for the
//    same post, also not after an edit that keeps the mention). Nobody is notified about their OWN mention;
//  - if an edit removes a mention, the notification that was still unread is removed too (a read one stays: it was seen).
// removeSocialTags(): when a post is deleted by its author. eraseSocialTags(): final erasure of an account.
// Not here: login check, rate limit (the actions do them first: a post is limited to 5 per 10 minutes).
import type { Prisma } from "../../generated/prisma/client";
import { parseSocialTags } from "./social-tags";
import { isSocialAuthorShown } from "./social-visibility";

type Db = Prisma.TransactionClient;

export const MENTION_NOTIFICATION = "SOCIAL_MENTION";

export type SocialTagSyncResult = { tagsAdded: number; tagsRemoved: number; mentionsAdded: number; mentionsRemoved: number; notified: number };

export async function syncSocialTags(
  db: Db,
  input: { socialPostId: number; authorId: string; body: string },
): Promise<SocialTagSyncResult> {
  const { socialPostId, authorId } = input;
  const wanted = parseSocialTags(input.body);

  // ---- hashtags
  const savedTags = (await db.socialPostTag.findMany({ where: { socialPostId }, select: { tag: true } })).map((row) => row.tag);
  const tagsToAdd = wanted.tags.filter((tag) => !savedTags.includes(tag));
  const tagsToRemove = savedTags.filter((tag) => !wanted.tags.includes(tag));
  if (tagsToRemove.length > 0) await db.socialPostTag.deleteMany({ where: { socialPostId, tag: { in: tagsToRemove } } });
  for (const tag of tagsToAdd) await db.socialPostTag.create({ data: { socialPostId, tag } });

  // ---- mentions
  const people =
    wanted.mentions.length > 0
      ? await db.user.findMany({
          where: { username: { in: wanted.mentions } },
          select: { id: true, username: true, status: true, deletedAt: true },
        })
      : [];
  // Block (SOCIAL_TODO A7): a person who blocked the author, or was blocked by the author, stays plain text.
  const blockRows =
    people.length > 0
      ? await db.socialBlock.findMany({
          where: {
            OR: [
              { blockerId: authorId, blockedId: { in: people.map((person) => person.id) } },
              { blockedId: authorId, blockerId: { in: people.map((person) => person.id) } },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
      : [];
  const blockedIds = new Set(blockRows.flatMap((row) => [row.blockerId, row.blockedId]));
  const wantedIds = people.filter((person) => isSocialAuthorShown(person) && !blockedIds.has(person.id)).map((person) => person.id);
  const savedIds = (await db.socialMention.findMany({ where: { socialPostId }, select: { userId: true } })).map((row) => row.userId);
  const toAdd = wantedIds.filter((id) => !savedIds.includes(id));
  const toRemove = savedIds.filter((id) => !wantedIds.includes(id));

  if (toRemove.length > 0) {
    await db.socialMention.deleteMany({ where: { socialPostId, userId: { in: toRemove } } });
    await db.notification.deleteMany({
      where: { recipientId: { in: toRemove }, actorId: authorId, type: MENTION_NOTIFICATION, socialPostId, readAt: null },
    });
  }

  let notified = 0;
  for (const userId of toAdd) {
    await db.socialMention.create({ data: { socialPostId, userId } });
    if (userId === authorId) continue;
    const already = await db.notification.findFirst({
      where: { recipientId: userId, actorId: authorId, type: MENTION_NOTIFICATION, socialPostId },
      select: { id: true },
    });
    if (already) continue;
    await db.notification.create({ data: { recipientId: userId, actorId: authorId, type: MENTION_NOTIFICATION, socialPostId } });
    notified++;
  }

  return {
    tagsAdded: tagsToAdd.length,
    tagsRemoved: tagsToRemove.length,
    mentionsAdded: toAdd.length,
    mentionsRemoved: toRemove.length,
    notified,
  };
}

/** The author deleted the post: its hashtags and mentions go with the text (the notification rows stay, like the other notifications about a deleted post). */
export async function removeSocialTags(db: Db, socialPostId: number): Promise<void> {
  await db.socialPostTag.deleteMany({ where: { socialPostId } });
  await db.socialMention.deleteMany({ where: { socialPostId } });
}

/** Final erasure of an account (purge-social.ts): hashtags and mentions of the person's posts, and the mentions OF the person. Safe to run twice. */
export async function eraseSocialTags(db: Db, userId: string): Promise<void> {
  await db.socialPostTag.deleteMany({ where: { socialPost: { authorId: userId } } });
  await db.socialMention.deleteMany({ where: { OR: [{ socialPost: { authorId: userId } }, { userId }] } });
}
