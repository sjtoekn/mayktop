// Pin: the read for the cards (SOCIAL_TODO B6, patch-social-pin). Which of these posts is MY pinned post? At most one id.
// NOT cached (the answer belongs to one viewer), nobody logged in = null without asking the database, and a database error
// is logged while the page still opens (every button shows "not pinned"). Never call it from inside a cached function.
import { prisma } from "@/lib/prisma";

export async function getMyPinnedSocialPostId(userId: string | null | undefined): Promise<number | null> {
  if (!userId) return null;
  try {
    const row = await prisma.socialPinnedPost.findUnique({ where: { userId }, select: { socialPostId: true } });
    return row ? row.socialPostId : null;
  } catch (error) {
    console.error("getMyPinnedSocialPostId failed:", error);
    return null;
  }
}
