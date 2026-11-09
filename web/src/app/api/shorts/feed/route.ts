// GET /api/shorts/feed?cursor=<next>: the next page of the public Shorts feed (SHORTS_TODO 21). Newest first, never by popularity.
// Answers { items, next } (next = null on the last page). Not cached (Block / Mute will make it per person, SHORTS_TODO 40).
import { NextResponse } from "next/server";
import { getShortsFeed } from "@/lib/short-queries";

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const page = await getShortsFeed(cursor);
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/shorts/feed failed:", error);
    return NextResponse.json({ items: [], next: null }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
