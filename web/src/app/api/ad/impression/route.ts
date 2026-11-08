// POST /api/ad/impression  { "id": 12 }
// Called by the browser when an ad has really been on screen. Adds 1 to that ad's total for today.
// Nothing about the visitor is read or stored. Crawlers and over-the-limit calls are ignored.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { allowCount, looksLikeBot } from "@/lib/ad-guard";
import { countAd } from "@/lib/ad-stats";
import { AdStatus } from "../../../../../generated/prisma/client";

export async function POST(request: NextRequest) {
  const done = () => new NextResponse(null, { status: 204 });
  if (looksLikeBot(request.headers.get("user-agent"))) return done();

  let id: unknown;
  try {
    id = ((await request.json()) as { id?: unknown }).id;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    return new NextResponse(null, { status: 400 });
  }

  if (!allowCount(id, "impression")) return done();
  const ad = await prisma.adCampaign.findUnique({ where: { id }, select: { status: true } });
  if (ad?.status === AdStatus.ACTIVE) await countAd(id, "impression");
  return done();
}
