// POST /api/ad/impression  { "id": 12 }  or  { "id": 12, "post": 345 }
// Called by the browser when an ad has really been on screen. Adds 1 to that ad's total for today.
// When the ad was shown on a question page (`post`), also adds 1 to that page's total for the ad (ContentAdStat): this is
// what creators are paid from (CREATOR_EARNINGS_PLAN.md). Nothing about the visitor is read or stored: only the ad and the
// page. Crawlers and over-the-limit calls are ignored. A logged-in author's own views of their page are not counted for
// them (the login cookie is only compared with the page's authors; nothing is saved).
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowCount, looksLikeBot } from "@/lib/ad-guard";
import { countAd } from "@/lib/ad-stats";
import { countAdOnContent } from "@/lib/creator-stats";
import { allowContentCount, parseImpressionBody, viewerIsOwner } from "@/lib/creator-collect-rules";
import { getSessionUser } from "@/lib/session";
import { AdStatus, ContentStatus } from "../../../../../generated/prisma/client";

/** Counts the impression for the question page, if the page is real, visible and the viewer is not one of its earners. */
async function countOnPage(adId: number, postId: number): Promise<void> {
  if (!allowContentCount(postId)) return;
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, status: true, deletedAt: true } });
  if (!post || post.status !== ContentStatus.VISIBLE || post.deletedAt) return;

  const viewer = await getSessionUser(); // null for most visitors; only compared, never saved
  if (viewer) {
    const accepted = await prisma.comment.findFirst({
      where: { postId, acceptedAt: { not: null }, status: ContentStatus.VISIBLE, deletedAt: null },
      select: { authorId: true },
    });
    if (viewerIsOwner(viewer.id, [post.authorId, accepted?.authorId])) return;
  }
  await countAdOnContent(adId, "POST", postId);
}

export async function POST(request: NextRequest) {
  const done = () => new NextResponse(null, { status: 204 });
  if (looksLikeBot(request.headers.get("user-agent"))) return done();

  let body: ReturnType<typeof parseImpressionBody>;
  try {
    body = parseImpressionBody(await request.json());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!body) return new NextResponse(null, { status: 400 });
  const { id, post } = body;

  if (!allowCount(id, "impression")) return done();
  const ad = await prisma.adCampaign.findUnique({ where: { id }, select: { status: true } });
  if (ad?.status !== AdStatus.ACTIVE) return done();
  await countAd(id, "impression");
  if (post !== null) {
    try {
      await countOnPage(id, post);
    } catch {
      /* the page count is a bonus; never fail the request because of it */
    }
  }
  return done();
}
