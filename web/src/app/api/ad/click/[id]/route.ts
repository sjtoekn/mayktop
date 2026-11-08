// GET /api/ad/click/<ad id>
// The link inside every ad. Adds 1 to that ad's click total for today, then sends the visitor to the
// advertiser's https page. The real address stays on the server, nothing about the visitor is stored,
// and no referrer is sent to the advertiser.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowCount, looksLikeBot } from "@/lib/ad-guard";
import { countAd } from "@/lib/ad-stats";
import { AdStatus } from "../../../../../../generated/prisma/client";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0;

  const ad = id
    ? await prisma.adCampaign.findUnique({ where: { id }, select: { status: true, destinationUrl: true } })
    : null;

  let target: URL | null = null;
  if (ad) {
    try {
      const url = new URL(ad.destinationUrl);
      if (url.protocol === "https:") target = url; // never redirect to anything but https
    } catch {
      /* unreadable address: fall through to the home page */
    }
  }

  const response = NextResponse.redirect(target ?? new URL("/", request.url), 302);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");

  if (ad && target && ad.status === AdStatus.ACTIVE) {
    if (!looksLikeBot(request.headers.get("user-agent")) && allowCount(id, "click")) {
      await countAd(id, "click");
    }
  }
  return response;
}
