// "Download my data" (TODO 36b). GET /settings/export gives the logged-in person ONE JSON file
// with everything the site holds about them (PROJECT.md 8c).
//
// Allowed for an active, a suspended / banned and a deletion-pending account (a banned person
// has 7 days to take their data). Refused when nobody is logged in or the account is erased.
// Includes the social part (src/lib/export-social.ts). Never included: the password hash, login sessions, other people's data. The browser is not
// trusted: the person comes from the login cookie, never from the address.
import { auth } from "@/lib/auth";
import { loadAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { getSocialExport } from "@/lib/export-social";
import { getCreatorSettings } from "@/lib/creator-profile";
import { UserStatus } from "../../../../../generated/prisma/client";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "login" }, { status: 401 });

  const account = await loadAccount(session.user.id);
  if (!account || account.status === UserStatus.DELETED) {
    return Response.json({ error: "gone" }, { status: 403 });
  }
  const id = account.id;

  try {
    const [user, memberships, posts, comments, postVotes, commentVotes, reports, appeals, ads, social] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id },
          select: {
            username: true,
            email: true,
            displayName: true,
            bio: true,
            profession: true,
            qualifications: true,
            website: true,
            profileVideo: true,
            socialLinks: true,
            verifiedAt: true,
            role: true,
            status: true,
            language: true,
            timezone: true,
            createdAt: true,
            suspendedAt: true,
            suspendedUntil: true,
            suspensionKind: true,
            suspensionNote: true,
            eraseAt: true,
          },
        }),
        prisma.membership.findMany({
          where: { userId: id },
          orderBy: { joinedAt: "asc" },
          select: { role: true, joinedAt: true, community: { select: { slug: true, name: true } } },
        }),
        prisma.post.findMany({
          where: { authorId: id },
          orderBy: { id: "asc" },
          select: {
            id: true,
            title: true,
            body: true,
            status: true,
            statusNote: true,
            createdAt: true,
            editedAt: true,
            deletedAt: true,
            community: { select: { slug: true } },
          },
        }),
        prisma.comment.findMany({
          where: { authorId: id },
          orderBy: { id: "asc" },
          select: {
            id: true,
            postId: true,
            parentId: true,
            body: true,
            status: true,
            statusNote: true,
            createdAt: true,
            editedAt: true,
            deletedAt: true,
          },
        }),
        prisma.postVote.findMany({
          where: { userId: id },
          orderBy: { createdAt: "asc" },
          select: { postId: true, value: true, createdAt: true },
        }),
        prisma.commentVote.findMany({
          where: { userId: id },
          orderBy: { createdAt: "asc" },
          select: { commentId: true, value: true, createdAt: true },
        }),
        prisma.report.findMany({
          where: { reporterId: id },
          orderBy: { id: "asc" },
          select: { id: true, postId: true, commentId: true, reason: true, status: true, createdAt: true },
        }),
        prisma.appeal.findMany({
          where: { appellantId: id },
          orderBy: { id: "asc" },
          select: {
            id: true, message: true, status: true, createdAt: true, decidedAt: true, decisionNote: true,
            // what the appeal was about (a post, a comment, an account or an ad) and which decision it answered
            auditLog: { select: { targetType: true, targetId: true, action: true } },
          },
        }),
        prisma.adCampaign.findMany({
          where: { advertiserId: id },
          orderBy: { id: "asc" },
          select: {
            id: true,
            contactEmail: true,
            title: true,
            body: true,
            destinationUrl: true,
            format: true,
            // The ad is listed, not its files: only whether a picture / video was uploaded (they stay in our own storage).
            imageUrl: true,
            videoUrl: true,
            slot: true,
            community: { select: { slug: true } },
            startDate: true,
            endDate: true,
            priceCents: true,
            currency: true,
            status: true,
            paymentStatus: true,
            paidAt: true,
            submittedAt: true,
            reviewRule: true, // the ad policy rule of a rejection
            reviewNote: true, // the written reason
            endingSoonNoticeAt: true,
            createdAt: true,
          },
        }),
        getSocialExport(prisma, id),
      ]);

    const now = new Date();
    const data = {
      about:
        "Your data from Falvenco. Times are in UTC. It holds what you wrote and did. It does not hold your password, your login sessions or other people's data.",
      exportedAt: now,
      account: user,
      communities: memberships.map((m) => ({
        slug: m.community.slug,
        name: m.community.name,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      posts: posts.map(({ community, ...p }) => ({ ...p, community: community.slug })),
      comments,
      votes: {
        posts: postVotes,
        comments: commentVotes,
      },
      reportsYouMade: reports,
      appealsYouMade: appeals.map(({ auditLog, ...a }) => ({
        ...a,
        about: { type: auditLog.targetType, id: auditLog.targetId, decision: auditLog.action },
      })),
      ads: ads.map(({ imageUrl, videoUrl, community, ...ad }) => ({
        ...ad,
        community: community?.slug ?? null,
        hasPicture: imageUrl !== null,
        hasVideo: videoUrl !== null,
      })),
      social,
      creator: await creatorExport(id),
    };

    const day = now.toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="falvenco-data-${account.username}-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("data export failed:", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

/** The creator program part (TODO 12, S6): the settings (payout details only masked, never in full) and every earning row. */
async function creatorExport(userId: string) {
  const settings = await getCreatorSettings(userId);
  if (!settings) return null;
  const entries = await prisma.earningEntry.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    select: { id: true, kind: true, status: true, amountMicroUsd: true, adId: true, contentType: true, contentId: true, periodStart: true, periodEnd: true, createdAt: true, payoutId: true },
  });
  return {
    joinedAt: settings.joinedAt,
    termsVersion: settings.termsVersion,
    payoutCountry: settings.country,
    payoutMethod: settings.method,
    payoutDetails: settings.masked ?? (settings.hasDetails ? "saved (hidden)" : null),
    earnings: entries,
  };
}
