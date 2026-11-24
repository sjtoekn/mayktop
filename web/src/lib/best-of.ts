// Reads for the "Best of the community" box (right column of every page). Replaces the fake "Trending Now".
// Six slides: helpful people, busy topics, Community, Social, Shorts, Photos. Every slide is chosen by the fair rules in
// best-of-rules.ts (best scores, one place per person, every 4th place reserved for a new voice). Nothing here is
// personal: the result is shared by everybody, so it is cached for a few minutes like the other lists.
// A section that fails or has nothing to show comes back empty and its slide is simply not shown.
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { bestOfConfig as cfg } from "@/config/best-of";
import { nowMs } from "@/lib/now";
import { communityArt, defaultArt } from "@/data/sample";
import { getCommunities, getPopularPosts } from "@/lib/queries";
import { isNewVoice, pickFair, type Candidate } from "@/lib/best-of-rules";
import { socialAuthorShown } from "@/lib/social-visibility";
import { photoThumbUrl } from "@/lib/photo-file";
import { SHORT_URL_PREFIX, shortThumbName } from "@/lib/short-file";
import { ContentStatus, ShortPrivacy, ShortProcessing, UserStatus, type Prisma } from "../../generated/prisma/client";

export type BestOfPerson = { username: string; name: string; helpful: number; isNew: boolean };
export type BestOfTopic = { slug: string; name: string; emoji: string; gradient: string; people: number };
export type BestOfPost = { id: number; title: string; communitySlug: string; communityName: string; comments: number; isNew: boolean };
export type BestOfSocial = { id: number; text: string; name: string; likes: number; isNew: boolean };
export type BestOfMedia = { id: number; title: string | null; thumb: string; name: string; likes: number; isNew: boolean };
export type BestOf = {
  helpers: BestOfPerson[];
  topics: BestOfTopic[];
  posts: BestOfPost[];
  social: BestOfSocial[];
  shorts: BestOfMedia[];
  photos: BestOfMedia[];
};

const DAY = 86_400_000;
const activeAuthor: Prisma.UserWhereInput = { status: UserStatus.ACTIVE, deletedAt: null };
const fair = { risingEvery: cfg.risingEvery, risingLuck: cfg.risingLuck, seedHours: cfg.seedHours };
const shownName = (u: { username: string; displayName: string | null }) => u.displayName?.trim() || u.username;

async function safe<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (error) {
    console.error(`getBestOf ${label} failed:`, error);
    return [];
  }
}

// 1. People whose answers (comments) helped others: net up-votes from OTHER people over the last 30 days.
async function helpersSlide(now: number): Promise<BestOfPerson[]> {
  const rows = await prisma.comment.findMany({
    where: {
      createdAt: { gte: new Date(now - cfg.helpersWindowDays * DAY) },
      status: ContentStatus.VISIBLE,
      deletedAt: null,
      author: activeAuthor,
      post: { status: ContentStatus.VISIBLE, deletedAt: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: cfg.scanLimit,
    select: {
      authorId: true,
      author: { select: { username: true, displayName: true, createdAt: true, _count: { select: { comments: true } } } },
      votes: { select: { userId: true, value: true } },
    },
  });
  const people = new Map<string, Candidate<BestOfPerson>>();
  for (const row of rows) {
    const others = row.votes.filter((v) => v.userId !== row.authorId); // a vote on your own answer never counts
    const helpful = Math.max(0, others.filter((v) => v.value > 0).length - others.filter((v) => v.value < 0).length);
    let entry = people.get(row.authorId);
    if (!entry) {
      const isNew = isNewVoice(row.author.createdAt.getTime(), row.author._count.comments, now, cfg.newAccountDays, cfg.newVoiceMaxItems);
      entry = {
        key: row.authorId,
        authorKey: row.authorId,
        score: 0,
        isNew,
        data: { username: row.author.username, name: shownName(row.author), helpful: 0, isNew },
      };
      people.set(row.authorId, entry);
    }
    entry.score += Math.log2(1 + helpful);
    if (helpful > 0) entry.data.helpful += 1; // number of answers that helped
  }
  return pickFair([...people.values()], cfg.size, now, fair).map((c) => c.data);
}

// 2. Topics (communities) where the most DIFFERENT people posted or answered lately. Not votes, not views.
async function topicsSlide(now: number): Promise<BestOfTopic[]> {
  const since = new Date(now - cfg.topicsWindowDays * DAY);
  const [communities, posts, comments] = await Promise.all([
    prisma.community.findMany({ where: { archivedAt: null }, select: { id: true, slug: true, name: true } }),
    prisma.post.findMany({
      where: { createdAt: { gte: since }, status: ContentStatus.VISIBLE, deletedAt: null, author: activeAuthor },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: cfg.scanLimit,
      select: { communityId: true, authorId: true },
    }),
    prisma.comment.findMany({
      where: { createdAt: { gte: since }, status: ContentStatus.VISIBLE, deletedAt: null, author: activeAuthor, post: { status: ContentStatus.VISIBLE, deletedAt: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: cfg.scanLimit,
      select: { authorId: true, post: { select: { communityId: true } } },
    }),
  ]);
  const people = new Map<number, Set<string>>();
  const add = (communityId: number, authorId: string) => {
    const set = people.get(communityId) ?? new Set<string>();
    set.add(authorId);
    people.set(communityId, set);
  };
  for (const p of posts) add(p.communityId, p.authorId);
  for (const c of comments) add(c.post.communityId, c.authorId);
  return communities
    .map((c) => ({ c, n: people.get(c.id)?.size ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.c.slug.localeCompare(b.c.slug))
    .slice(0, cfg.size)
    .map(({ c, n }) => {
      const art = communityArt[c.slug] ?? defaultArt;
      return { slug: c.slug, name: c.name, emoji: art.emoji, gradient: art.gradient, people: n };
    });
}

// 3. Community posts: the Popular page's own fair order (it already reserves places for new voices).
async function postsSlide(): Promise<BestOfPost[]> {
  const [popular, communities] = await Promise.all([getPopularPosts(), getCommunities()]);
  const names = new Map(communities.map((c) => [c.slug, c.name]));
  return popular
    .filter((p) => !p.hidden && !p.deleted && p.title.trim() !== "")
    .slice(0, cfg.size)
    .map((p) => ({ id: p.id, title: p.title, communitySlug: p.community, communityName: names.get(p.community) ?? p.community, comments: p.comments, isNew: p.newVoice === true }));
}

// 4. Social posts: liked by the most people lately (softened with log2, so one huge post cannot take everything).
async function socialSlide(now: number): Promise<BestOfSocial[]> {
  const rows = await prisma.socialPost.findMany({
    where: { createdAt: { gte: new Date(now - cfg.socialWindowDays * DAY) }, status: ContentStatus.VISIBLE, deletedAt: null, author: socialAuthorShown },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: cfg.scanLimit,
    select: {
      id: true,
      body: true,
      authorId: true,
      author: { select: { username: true, displayName: true, createdAt: true, _count: { select: { socialPosts: true } } } },
      _count: { select: { likes: true } },
    },
  });
  const items: Candidate<BestOfSocial>[] = rows
    .filter((r) => r.body.trim() !== "")
    .map((r) => {
      const isNew = isNewVoice(r.author.createdAt.getTime(), r.author._count.socialPosts, now, cfg.newAccountDays, cfg.newVoiceMaxItems);
      return {
        key: `s${r.id}`,
        authorKey: r.authorId,
        score: Math.log2(1 + r._count.likes),
        isNew,
        data: { id: r.id, text: r.body, name: shownName(r.author), likes: r._count.likes, isNew },
      };
    });
  return pickFair(items, cfg.size, now, fair).map((c) => c.data);
}

// 5. Shorts (only public, finished, visible ones) and 6. Photos: liked by the most different people lately.
async function shortsSlide(now: number): Promise<BestOfMedia[]> {
  const rows = await prisma.short.findMany({
    where: {
      createdAt: { gte: new Date(now - cfg.mediaWindowDays * DAY) },
      processing: ShortProcessing.READY,
      privacy: ShortPrivacy.PUBLIC,
      status: ContentStatus.VISIBLE,
      deletedAt: null,
      owner: activeAuthor,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: cfg.scanLimit,
    select: {
      id: true,
      title: true,
      file: true,
      ownerId: true,
      owner: { select: { username: true, displayName: true, createdAt: true, _count: { select: { shorts: true } } } },
      _count: { select: { likes: true } },
    },
  });
  const items: Candidate<BestOfMedia>[] = rows.map((r) => {
    const isNew = isNewVoice(r.owner.createdAt.getTime(), r.owner._count.shorts, now, cfg.newAccountDays, cfg.newVoiceMaxItems);
    return {
      key: `v${r.id}`,
      authorKey: r.ownerId,
      score: Math.log2(1 + r._count.likes),
      isNew,
      data: { id: r.id, title: r.title?.trim() || null, thumb: `${SHORT_URL_PREFIX}${shortThumbName(r.file)}`, name: shownName(r.owner), likes: r._count.likes, isNew },
    };
  });
  return pickFair(items, cfg.size, now, fair).map((c) => c.data);
}

async function photosSlide(now: number): Promise<BestOfMedia[]> {
  const rows = await prisma.photo.findMany({
    where: { createdAt: { gte: new Date(now - cfg.mediaWindowDays * DAY) }, status: ContentStatus.VISIBLE, deletedAt: null, owner: activeAuthor },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: cfg.scanLimit,
    select: {
      id: true,
      title: true,
      file: true,
      ownerId: true,
      owner: { select: { username: true, displayName: true, createdAt: true, _count: { select: { photos: true } } } },
      _count: { select: { likes: true } },
    },
  });
  const items: Candidate<BestOfMedia>[] = rows.map((r) => {
    const isNew = isNewVoice(r.owner.createdAt.getTime(), r.owner._count.photos, now, cfg.newAccountDays, cfg.newVoiceMaxItems);
    return {
      key: `f${r.id}`,
      authorKey: r.ownerId,
      score: Math.log2(1 + r._count.likes),
      isNew,
      data: { id: r.id, title: r.title?.trim() || null, thumb: photoThumbUrl(r.file), name: shownName(r.owner), likes: r._count.likes, isNew },
    };
  });
  return pickFair(items, cfg.size, now, fair).map((c) => c.data);
}

export async function getBestOf(): Promise<BestOf> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts", "comments", "communities", "social-posts");
  const now = nowMs();
  const [helpers, topics, posts, social, shorts, photos] = await Promise.all([
    safe("helpers", () => helpersSlide(now)),
    safe("topics", () => topicsSlide(now)),
    safe("posts", () => postsSlide()),
    safe("social", () => socialSlide(now)),
    safe("shorts", () => shortsSlide(now)),
    safe("photos", () => photosSlide(now)),
  ]);
  return { helpers, topics, posts, social, shorts, photos };
}
