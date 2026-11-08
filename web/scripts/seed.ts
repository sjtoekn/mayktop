// Fills the LOCAL development database with the sample data from src/data/sample.ts,
// so we can move the pages from sample data to the database.
//
// Run from the web/ folder:   npm run db:seed
//
// WARNING: this first EMPTIES the local database (development only), then fills it again.
// It refuses to run in production or on anything that is not a local "file:" database.
import { prisma } from "../src/lib/prisma";
import { communities, samplePosts, getComments, modLog, type Comment } from "../src/data/sample";
import { profiles } from "../src/data/profiles";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Role = "USER" | "MODERATOR" | "ADMIN";

const ADMIN_USERNAME = "admin";
// The moderators named on the sample Mod log page, and the communities they moderate.
const MODERATORS: Record<string, string[]> = {
  mod_ravi: ["technology", "local-news"],
  mod_nadia: ["health-basics", "learning"],
  mod_kasun: ["everyday-life", "technology"],
};

// "12 min ago", "1 hour ago", "2 days ago", "Yesterday"  ->  a real date (UTC).
function agoToDate(text: string, now: Date): Date {
  const t = text.trim().toLowerCase();
  const m = t.match(/^(\d+)\s*(min|hour|day)/);
  if (m) {
    const unit = m[2] === "min" ? MINUTE : m[2] === "hour" ? HOUR : DAY;
    return new Date(now.getTime() - Number(m[1]) * unit);
  }
  if (t === "yesterday") return new Date(now.getTime() - DAY);
  return now;
}

// "Rule 2: Be respectful to others"  ->  2
function ruleNumber(text: string): number | null {
  const m = text.match(/Rule\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function walk(list: Comment[], visit: (c: Comment) => void) {
  for (const c of list) {
    visit(c);
    walk(c.replies ?? [], visit);
  }
}

// Children first, so no row is deleted while another row still points to it.
async function emptyDatabase() {
  await prisma.adDailyStat.deleteMany();
  await prisma.adCampaign.deleteMany();
  await prisma.appeal.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.commentVote.deleteMany();
  await prisma.postVote.deleteMany();
  // A reply points to its parent comment and the database refuses to delete a parent while a reply
  // still exists, so remove comments from the bottom of each thread up: first the ones nobody
  // replied to, then the next layer, and so on.
  for (;;) {
    const { count } = await prisma.comment.deleteMany({ where: { replies: { none: {} } } });
    if (count === 0) break;
  }
  await prisma.post.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.community.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seeding is for development only.");
  if (!(process.env.DATABASE_URL ?? "").startsWith("file:")) {
    throw new Error("DATABASE_URL must be a local file: database to seed.");
  }

  const now = new Date();
  await emptyDatabase();

  // ---- Who exists, and where each person is active ----
  const names = new Set<string>([ADMIN_USERNAME, ...Object.keys(MODERATORS)]);
  for (const p of profiles) names.add(p.username);
  const activeIn = new Map<string, Set<string>>(); // username -> community slugs
  const markActive = (username: string, slug: string) => {
    names.add(username);
    if (!activeIn.has(username)) activeIn.set(username, new Set());
    activeIn.get(username)!.add(slug);
  };
  let votersNeeded = 0;
  for (const p of samplePosts) {
    markActive(p.author, p.community);
    votersNeeded = Math.max(votersNeeded, Math.abs(p.votes));
    walk(getComments(p.id), (c) => {
      markActive(c.author, p.community);
      votersNeeded = Math.max(votersNeeded, Math.abs(c.votes));
    });
  }

  // ---- Users ----
  const userIds = new Map<string, string>();
  for (const username of names) {
    const profile = profiles.find((p) => p.username === username);
    const role: Role = username === ADMIN_USERNAME ? "ADMIN" : username in MODERATORS ? "MODERATOR" : "USER";
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@example.invalid`, // ".invalid" can never be a real address
        displayName: profile?.name ?? null,
        bio: profile?.bio ?? null,
        role,
        createdAt: profile ? new Date(profile.joined) : new Date(now.getTime() - 30 * DAY),
      },
    });
    userIds.set(username, user.id);
  }

  // Demo voters: fake accounts that only exist so the vote totals match the sample data.
  const voterIds: string[] = [];
  for (let i = 1; i <= votersNeeded; i++) {
    const nn = String(i).padStart(2, "0");
    const voter = await prisma.user.create({
      data: { username: `demo_voter_${nn}`, email: `demo_voter_${nn}@example.invalid` },
    });
    voterIds.push(voter.id);
  }

  // ---- Communities and their rules ----
  const adminId = userIds.get(ADMIN_USERNAME)!;
  const communityIds = new Map<string, number>();
  const ruleIds = new Map<string, number[]>(); // slug -> rule ids in order (rule 1 = index 0)
  for (const c of communities) {
    const created = await prisma.community.create({
      data: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        createdById: adminId,
        rules: { create: c.rules.map((r, i) => ({ position: i + 1, title: r.title, text: r.text })) },
      },
      include: { rules: { orderBy: { position: "asc" } } },
    });
    communityIds.set(c.slug, created.id);
    ruleIds.set(c.slug, created.rules.map((r) => r.id));
  }

  // ---- Memberships (people who posted or commented join that community) ----
  const memberships = new Map<string, { userId: string; communityId: number; role: "MEMBER" | "MODERATOR" }>();
  for (const [username, slugs] of activeIn) {
    for (const slug of slugs) {
      const userId = userIds.get(username)!;
      const communityId = communityIds.get(slug)!;
      memberships.set(`${userId}:${communityId}`, { userId, communityId, role: "MEMBER" });
    }
  }
  for (const [username, slugs] of Object.entries(MODERATORS)) {
    for (const slug of slugs) {
      const userId = userIds.get(username)!;
      const communityId = communityIds.get(slug)!;
      memberships.set(`${userId}:${communityId}`, { userId, communityId, role: "MODERATOR" });
    }
  }
  await prisma.membership.createMany({ data: [...memberships.values()] });

  // ---- Posts, comments, votes, and the audit-log rows for hidden content ----
  const postVotes: { userId: string; postId: number; value: number }[] = [];
  const commentVotes: { userId: string; commentId: number; value: number }[] = [];
  const hiddenLog: {
    moderator: string;
    targetType: "POST" | "COMMENT";
    targetId: string;
    communityId: number;
    ruleId: number | null;
    reason: string;
    createdAt: Date;
  }[] = [];

  const voteRows = <T>(votes: number, make: (userId: string, value: number) => T): T[] =>
    voterIds.slice(0, Math.abs(votes)).map((id) => make(id, Math.sign(votes)));

  for (const p of samplePosts) {
    const createdAt = agoToDate(p.time, now);
    const communityId = communityIds.get(p.community)!;
    const rules = ruleIds.get(p.community) ?? [];
    const postRule = p.hidden ? ruleNumber(p.hidden.rule) : null;
    const postRuleId = postRule ? (rules[postRule - 1] ?? null) : null;

    await prisma.post.create({
      data: {
        id: p.id, // keep the sample ids so /post/1 still works
        communityId,
        authorId: userIds.get(p.author)!,
        title: p.title,
        body: p.body,
        createdAt,
        status: p.hidden ? "HIDDEN_PENDING_REVIEW" : "VISIBLE",
        statusRuleId: postRuleId,
        statusNote: p.hidden?.note ?? null,
        statusChangedAt: p.hidden ? createdAt : null,
      },
    });
    postVotes.push(...voteRows(p.votes, (userId, value) => ({ userId, postId: p.id, value })));

    if (p.hidden) {
      const entry = modLog.find((e) => e.target === "post" && e.postId === p.id);
      hiddenLog.push({
        moderator: entry?.moderator ?? "mod_ravi",
        targetType: "POST",
        targetId: String(p.id),
        communityId,
        ruleId: postRuleId,
        reason: entry?.reason ?? p.hidden.note,
        createdAt: entry ? agoToDate(entry.time, now) : createdAt,
      });
    }

    const addComments = async (list: Comment[], parentId: number | null) => {
      for (const c of list) {
        const cCreatedAt = agoToDate(c.time, now);
        const cRule = c.hidden ? ruleNumber(c.hidden.rule) : null;
        const cRuleId = cRule ? (rules[cRule - 1] ?? null) : null;
        await prisma.comment.create({
          data: {
            id: c.id,
            postId: p.id,
            authorId: userIds.get(c.author)!,
            parentId,
            body: c.text,
            createdAt: cCreatedAt,
            status: c.hidden ? "HIDDEN_PENDING_REVIEW" : "VISIBLE",
            statusRuleId: cRuleId,
            statusNote: c.hidden?.note ?? null,
            statusChangedAt: c.hidden ? cCreatedAt : null,
          },
        });
        commentVotes.push(...voteRows(c.votes, (userId, value) => ({ userId, commentId: c.id, value })));
        if (c.hidden) {
          const entry = modLog.find((e) => e.target === "comment" && e.postId === p.id);
          hiddenLog.push({
            moderator: entry?.moderator ?? "mod_ravi",
            targetType: "COMMENT",
            targetId: String(c.id),
            communityId,
            ruleId: cRuleId,
            reason: entry?.reason ?? c.hidden.note,
            createdAt: entry ? agoToDate(entry.time, now) : cCreatedAt,
          });
        }
        await addComments(c.replies ?? [], c.id);
      }
    };
    await addComments(getComments(p.id), null);
  }

  await prisma.postVote.createMany({ data: postVotes });
  await prisma.commentVote.createMany({ data: commentVotes });

  // The rest of the sample Mod log (restored, removed, appeals). Those sample items have no post or
  // comment in the database, so the target id is a placeholder, not a real id. The newer an entry,
  // the smaller its id: we take a few milliseconds off the older ones so two "Yesterday" rows keep their order.
  const otherActions = {
    restored: "CONTENT_RESTORED",
    removed: "CONTENT_REMOVED",
    appealUpheld: "APPEAL_ACCEPTED",
    appealDenied: "APPEAL_REJECTED",
  } as const;
  for (const e of modLog) {
    if (e.action === "hidden") continue; // already created above from the hidden posts and comments
    const rules = ruleIds.get(e.community) ?? [];
    const n = ruleNumber(e.rule);
    await prisma.auditLog.create({
      data: {
        actorId: userIds.get(e.moderator)!,
        actorRole: "MODERATOR",
        action: otherActions[e.action],
        targetType: e.target === "post" ? "POST" : "COMMENT",
        targetId: `sample-${e.id}`,
        communityId: communityIds.get(e.community)!,
        ruleId: n ? (rules[n - 1] ?? null) : null,
        reason: e.reason,
        createdAt: new Date(agoToDate(e.time, now).getTime() - e.id),
      },
    });
  }

  for (const h of hiddenLog) {
    await prisma.auditLog.create({
      data: {
        actorId: userIds.get(h.moderator)!,
        actorRole: "MODERATOR",
        action: "CONTENT_HIDDEN",
        targetType: h.targetType,
        targetId: h.targetId,
        communityId: h.communityId,
        ruleId: h.ruleId,
        reason: h.reason,
        createdAt: h.createdAt,
      },
    });
  }

  // ---- Sample ads (TODO 44): 3 active ads, paid, with a few days of totals ----
  const firstSlug = communities[0]?.slug;
  const sampleAds = [
    { title: "Sample sidebar ad", body: "A short sample text for the sidebar box.", slot: "SIDEBAR" as const, slug: null },
    { title: "Sample community ad", body: "Shown only on one community's pages.", slot: "SIDEBAR" as const, slug: firstSlug ?? null },
    { title: "Sample feed ad", body: "A short sample text between posts.", slot: "FEED" as const, slug: null },
  ];
  for (const a of sampleAds) {
    const ad = await prisma.adCampaign.create({
      data: {
        advertiserId: adminId,
        contactEmail: "advertiser@example.invalid",
        title: a.title,
        body: a.body,
        destinationUrl: "https://example.com/",
        slot: a.slot,
        communityId: a.slug ? (communityIds.get(a.slug) ?? null) : null,
        startDate: new Date(now.getTime() - 5 * DAY),
        endDate: new Date(now.getTime() + 25 * DAY),
        priceCents: 1000,
        status: "ACTIVE",
        paymentStatus: "PAID",
        paidAt: new Date(now.getTime() - 6 * DAY),
        submittedAt: new Date(now.getTime() - 7 * DAY),
        reviewedById: adminId,
        reviewedAt: new Date(now.getTime() - 6 * DAY),
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actorRole: "ADMIN",
        action: "AD_APPROVED",
        targetType: "AD",
        targetId: String(ad.id),
        createdAt: new Date(now.getTime() - 6 * DAY),
      },
    });
    for (let d = 1; d <= 4; d++) {
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));
      await prisma.adDailyStat.create({
        data: { adId: ad.id, date: day, impressions: 120 * d + ad.id, clicks: 3 * d },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    communities: await prisma.community.count(),
    rules: await prisma.rule.count(),
    memberships: await prisma.membership.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    postVotes: await prisma.postVote.count(),
    commentVotes: await prisma.commentVote.count(),
    auditLog: await prisma.auditLog.count(),
    ads: await prisma.adCampaign.count(),
    adStats: await prisma.adDailyStat.count(),
  };
  console.log("Seed done:", counts);
}

main()
  .catch((error) => {
    console.error("Seed FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
