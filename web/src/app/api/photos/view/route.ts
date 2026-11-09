// POST /api/photos/view  { "id": 12 }   (PHOTO_TODO 6c)
// Called by the browser when a photo page has really been on screen. Adds 1 to that photo's running total.
// The answer is always empty (204): the browser never learns whether the view counted. Nothing about the viewer is saved.
// Not counted: nobody logged in, crawlers and scripts, the owner's own view, a repeat by the same person within 24 hours,
// a photo that may not be shown, and anything over the rate limit. Rules: src/lib/photo-views.ts.
import { NextResponse, type NextRequest } from "next/server";
import { socialLimits } from "@/config/site";
import { looksLikeBot } from "@/lib/ad-guard";
import { isPhotoId } from "@/lib/photo-detail-rules";
import { addPhotoView } from "@/lib/photo-view-db";
import { firstPhotoViewInWindow } from "@/lib/photo-views";
import { takeActionDb } from "@/lib/rate-limit-db";
import { getSessionUser } from "@/lib/session";

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
    if (!isPhotoId(raw)) return new NextResponse(null, { status: 400 });

    const viewer = await getSessionUser();
    if (!viewer) return done();

    if (!(await takeActionDb(`photo-view:${viewer.id}`, rules)).ok) return done(); // too many: ignore quietly
    if (!firstPhotoViewInWindow(viewer.id, raw)) return done(); // already counted for this person today

    await addPhotoView(raw, viewer.id);
    return done();
  } catch (error) {
    console.error("photo view failed:", error);
    return done();
  }
}
