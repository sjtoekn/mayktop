// How many Social posts and reposts are newer than what the person's feed shows (SOCIAL_TODO B4, the "n new posts" banner).
// Asked by src/components/social/SocialNewPostsBanner.tsx from the browser, about once a minute while the page is open.
//   GET /api/social/new-count?feed=all|following&since=<milliseconds>   ->   { count, label }
// `label` is the button text ("3 new posts") already in the person's language, so the browser needs no language files.
// Nobody logged in, or anything wrong with the question: count 0 (the banner then shows nothing). Never cached.
// Login required like all of Social. A person may ask `socialLimits.newPosts` times per minute / day (server memory).
import { NextResponse } from "next/server";
import { socialLimits } from "@/config/site";
import { t, tn } from "@/i18n";
import { countNewSocialItems } from "@/lib/queries";
import { getSessionUser } from "@/lib/session";
import { loadHiddenAuthors } from "@/lib/social-block-view";
import { takeActionDb } from "@/lib/rate-limit-db";
import { clampNewCount, NEW_POSTS_MANY, parseNewPostsFeed, parseSince } from "@/lib/social-new-posts";

const rules = socialLimits.newPosts.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
const headers = { "Cache-Control": "no-store" };
const none = { count: 0, label: "" };

export async function GET(request: Request) {
  try {
    const viewer = await getSessionUser();
    if (!viewer) return NextResponse.json(none, { headers });

    const params = new URL(request.url).searchParams;
    const feed = parseNewPostsFeed(params.get("feed"));
    const since = parseSince(params.get("since"));
    if (feed === null || since === null) return NextResponse.json(none, { status: 400, headers });

    if (!(await takeActionDb(`social-new:${viewer.id}`, rules)).ok) return NextResponse.json(none, { status: 429, headers });

    const hidden = await loadHiddenAuthors(viewer.id); // Block and Mute: the same lists as the feeds
    const count = clampNewCount(await countNewSocialItems(viewer.id, feed, since, hidden.all));
    const label = count === 0 ? "" : count >= NEW_POSTS_MANY ? t("social.new.overflow") : tn("social.new.posts", count);
    return NextResponse.json({ count, label }, { headers });
  } catch (error) {
    console.error("social new-count failed:", error);
    return NextResponse.json(none, { headers });
  }
}
