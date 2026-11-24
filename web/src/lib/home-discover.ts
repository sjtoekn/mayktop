// The cards of the Home "Discover today" section: a few of the newest items from EACH part of the site.
// Home only PREVIEWS. Every card opens its own page (Community, Social, Shorts, Photos, Places), and every part keeps
// its own feed on its own address; nothing is mixed there. Server only. All the reads below already apply the site's
// visibility rules (hidden / removed / deleted items and hidden owners never appear), so no rule is repeated here.
import { cacheLife, cacheTag } from "next/cache";
import { getCommunities, getPosts, getSocialFeed, timeAgo } from "@/lib/queries";
import { getShortsFeed } from "@/lib/short-queries";
import { loadPhotoPage } from "@/lib/photo-feed";
import { photoThumbUrl } from "@/lib/photo-file";
import { loadPlacePage, placeWhere } from "@/lib/place-view";
import { placeTypeNames } from "@/lib/place-text";
import { prisma } from "@/lib/prisma";
import { parseVideoUrl } from "@/lib/post-input-rules";
import { communityArt, defaultArt } from "@/data/sample";

export type DiscoverKind = "community" | "social" | "shorts" | "photos" | "places" | "news";

export type DiscoverCard = {
  key: string;
  kind: DiscoverKind;
  href: string;
  source: string; // who / where it comes from (community name, author, publisher, place type)
  time: string; // "2 hours ago", or "" when the item has no time to show
  title: string;
  excerpt: string;
  image: string | null;
  duration?: string; // shorts only, "0:45"
  art?: { emoji: string; gradient: string }; // community posts without a real picture: the community's emoji tile
  badge?: string; // small label on the picture ("Question", "Video"...)
  stats: { icon: string; value: string }[];
};

export type DiscoverData = Record<DiscoverKind, DiscoverCard[]>;

// How many cards each row on Home shows (one row per part of the site).
const LIMIT: Record<DiscoverKind, number> = { community: 5, social: 5, shorts: 8, photos: 6, places: 5, news: 5 };

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

function durationLabel(ms: number | null): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** A failing part must never take the whole Home down: that part just shows "nothing yet". */
async function safe<T>(job: () => Promise<T[]>): Promise<T[]> {
  try {
    return await job();
  } catch (error) {
    console.error("home discover part failed:", error);
    return [];
  }
}

export async function getHomeDiscover(): Promise<DiscoverData> {
  "use cache";
  cacheLife("minutes");
  cacheTag("posts", "social-posts");

  const [community, social, shorts, photos, places, news] = await Promise.all([
    safe<DiscoverCard>(async () => {
      const [posts, communities] = await Promise.all([getPosts(), getCommunities()]);
      const names = new Map(communities.map((c) => [c.slug, c.name]));
      return posts
        .filter((p) => !p.hidden && !p.deleted && p.title !== "")
        .slice(0, LIMIT.community)
        .map((p) => ({
          key: `community-${p.id}`,
          kind: "community" as const,
          href: `/post/${p.id}`,
          source: names.get(p.community) ?? p.community,
          time: p.time,
          title: clip(p.title, 90),
          excerpt: clip(p.body, 110),
          // a video post shows the video's own picture (YouTube); every other post shows its community's emoji tile
          image: (() => {
            const v = p.kind === "video" && p.videoUrl ? parseVideoUrl(p.videoUrl) : null;
            return v?.provider === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null;
          })(),
          art: communityArt[p.community] ?? defaultArt,
          badge: p.kind === "video" ? "Video" : p.kind === "article" ? "Article" : "Question",
          stats: [
            { icon: "thumb", value: String(p.votes) },
            { icon: "comment", value: String(p.comments) },
          ],
        }));
    }),
    safe<DiscoverCard>(async () => {
      const page = await getSocialFeed(null);
      return page.items
        .flatMap((item) => (item.kind === "post" ? [item.post] : []))
        .slice(0, LIMIT.social)
        .map((p) => ({
          key: `social-${p.id}`,
          kind: "social" as const,
          href: `/social/${p.id}`,
          source: p.displayName ?? p.author,
          time: p.time,
          title: clip(p.body, 90),
          excerpt: p.body.length > 90 ? clip(p.body.slice(90), 110) : "",
          image: null, // Social pictures are served by a route that checks the viewer; the preview stays text only
          stats: [
            { icon: "heart", value: String(p.likes) },
            { icon: "comment", value: String(p.replies) },
          ],
        }));
    }),
    safe<DiscoverCard>(async () => {
      const page = await getShortsFeed(null, LIMIT.shorts);
      return page.items.slice(0, LIMIT.shorts).map((s) => ({
        key: `shorts-${s.id}`,
        kind: "shorts" as const,
        href: `/shorts/${s.id}`,
        source: s.displayName ?? s.username,
        time: timeAgo(new Date(s.createdAtMs)),
        title: clip(s.title || s.description || "Short video", 70),
        excerpt: "",
        image: s.thumbUrl,
        duration: durationLabel(s.durationMs),
        stats: [],
      }));
    }),
    safe<DiscoverCard>(async () => {
      const page = await loadPhotoPage(null);
      return page.items.slice(0, LIMIT.photos).map((p) => ({
        key: `photos-${p.id}`,
        kind: "photos" as const,
        href: `/photos/${p.id}`,
        source: "Photos",
        time: "",
        title: clip(p.title ?? "Photo", 70),
        excerpt: "",
        image: photoThumbUrl(p.file),
        stats: [],
      }));
    }),
    safe<DiscoverCard>(async () => {
      const page = await loadPlacePage(null, "", null);
      return page.items.slice(0, LIMIT.places).map((p) => ({
        key: `places-${p.id}`,
        kind: "places" as const,
        href: `/places/${p.id}`,
        source: placeTypeNames[p.type],
        time: "",
        title: clip(p.name, 70),
        excerpt: clip(placeWhere(p), 90),
        image: null,
        stats: [],
      }));
    }),
    safe<DiscoverCard>(async () => {
      const articles = await prisma.newsArticle.findMany({
        where: { url: { startsWith: "http" } },
        orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
        take: LIMIT.news,
        include: { source: { select: { name: true } } },
      });
      return articles.map((a) => ({
        key: `news-${a.id}`,
        kind: "news" as const,
        href: a.url, // opens the publisher's page in a new tab (see HomeRows)
        source: a.source.name,
        time: a.publishedAt ? timeAgo(a.publishedAt) : "",
        title: clip(a.title, 100),
        excerpt: "",
        image: a.imageUrl,
        stats: [],
      }));
    }),
  ]);

  return { community, social, shorts, photos, places, news };
}
