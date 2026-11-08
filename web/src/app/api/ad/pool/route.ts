// GET /api/ad/pool?slot=SIDEBAR|FEED&c=<community slug>
// The candidate ads for one slot. The browser (AdBox) picks one of them. Public data only, cached briefly.
import { NextResponse, type NextRequest } from "next/server";
import { adsConfig } from "@/config/site";
import { getAdPool } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const slot = request.nextUrl.searchParams.get("slot");
  if (slot !== "SIDEBAR" && slot !== "FEED" && slot !== "SOCIAL_FEED" && slot !== "HEADER") {
    return NextResponse.json({ ads: [] }, { status: 400 });
  }
  if (!(adsConfig.slots as readonly string[]).includes(slot)) {
    return NextResponse.json({ ads: [] }, { status: 400 });
  }
  const c = request.nextUrl.searchParams.get("c");
  const community = c && /^[a-z0-9-]{1,60}$/.test(c) ? c : null;
  const ads = await getAdPool(slot, community);
  return NextResponse.json({ ads }, { headers: { "Cache-Control": "public, max-age=30" } });
}
