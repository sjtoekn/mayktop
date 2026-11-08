// Which of these replies has THIS person liked? (SOCIAL_TODO B10) Read per request, never cached (it is personal).
import { prisma } from "@/lib/prisma";

export async function getMyReplyLikes(userId: string, replyIds: number[]): Promise<number[]> {
  if (replyIds.length === 0) return [];
  const rows = await prisma.socialReplyLike.findMany({
    where: { userId, socialReplyId: { in: replyIds } },
    select: { socialReplyId: true },
  });
  return rows.map((row) => row.socialReplyId);
}
