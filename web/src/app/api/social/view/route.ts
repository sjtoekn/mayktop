// POST /api/social/view  { "id": 12 }   (SOCIAL_TODO B5, patch-social-views)
// Called by the browser when a Social post has really been on screen. Adds 1 to that post's running total.
// The answer is always empty (204): the browser never learns whether the view counted. Nothing about the viewer is saved.
// Not counted: nobody logged in, crawlers and scripts, the author's own view, a repeat by the same person within 24 hours,
// a post that may not be shown, and anything over the rate limit. Rules: src/lib/social-views.ts.
import { NextResponse, type NextRequest } from "next/server";
import { socialLimits } from "@/config/site";
import { looksLikeBot } from "@/lib/ad-guard";
import { getSessionUser } from "@/lib/session";
import { takeAction } from "@/lib/social-limits";
import { addSocialView } from "@/lib/social-view-db";
import { firstViewInWindow, parsePostId } from "@/lib/social-views";

const rules = socialLimits.views.map((rule) => ({ max: rule.max, windowMs: rule.windowSeconds * 1000 }));
const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  try {
    if (looksLikeBot(request.headers.get("user-agent"))) return done();

    let raw: unknown;
    try {
      raw = ((await request.json()) as { id?: unknown }).id;
    } catch {
      return new NextResponse(null, { status: 400 });
    }
    const id = parsePostId(raw);
    if (id === null) return new NextResponse(null, { status: 400 });

    const viewer = await getSessionUser();
    if (!viewer) return done();

    if (!takeAction(`social-view:${viewer.id}`, rules).ok) return done(); // too many: ignore quietly
    if (!firstViewInWindow(viewer.id, id)) return done(); // already counted for this person today

    await addSocialView(id, viewer.id);
    return done();
  } catch (error) {
    console.error("social view failed:", error);
    return done();
  }
}
