// How many unread notifications the logged-in person has (SOCIAL_TODO 21). Asked by the bell in the menu
// (src/components/shell/NotificationBadge.tsx) from the browser, so the rest of the site can stay cached.
// Nobody logged in: 0. Never cached. Only the number is returned.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { countUnreadNotifications } from "@/lib/social-notifications";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const viewer = await getSessionUser();
    if (!viewer) return NextResponse.json({ count: 0 }, { headers });
    return NextResponse.json({ count: await countUnreadNotifications(viewer.id) }, { headers });
  } catch (error) {
    console.error("notifications count failed:", error);
    return NextResponse.json({ count: 0 }, { headers });
  }
}
