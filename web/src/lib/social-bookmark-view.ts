// Bookmarks: the read for the cards (SOCIAL_TODO B2, patch-social-bookmark). Same rules as getMySocialLikes (queries.ts):
// NOT cached (the answer belongs to one viewer, the shared feed caches hold no personal data), nobody logged in or no posts =
// an empty answer without asking the database, and a database error is logged while the page still opens (every button shows
// "not saved"). Never call it from inside a cached function.
import { prisma } from "@/lib/prisma";

const MAX_BOOKMARK_IDS = 200; // a page never shows more Social posts than this

export async function getMySocialBookmarks(
  userId: string | null | undefined,
  socialPostIds: number[],
): Promise<number[]> {
  if (!userId) return [];
  const ids = [...new Set(socialPostIds.filter((id) => Number.isInteger(id) && id >= 1))].slice(0, MAX_BOOKMARK_IDS);
  if (ids.length === 0) return [];

  try {
    const rows = await prisma.socialPostBookmark.findMany({
      where: { userId, socialPostId: { in: ids } },
      select: { socialPostId: true },
    });
    return rows.map((row) => row.socialPostId);
  } catch (error) {
    console.error("getMySocialBookmarks failed:", error);
    return [];
  }
}
