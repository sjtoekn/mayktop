import { getSessionUser } from "@/lib/session";
import { loadAdDetail } from "@/lib/ad-detail";
import { buildAdCsv, csvResponse } from "@/lib/ad-csv";

// Download the day-by-day numbers of MY ad as CSV (patch-ads-csv). Own ad only; anything else is a plain 404.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Login required", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { id } = await ctx.params;
  const ad = /^\d{1,9}$/.test(id) ? await loadAdDetail(Number(id), { kind: "advertiser", userId: user.id }) : null;
  if (!ad) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return csvResponse(buildAdCsv(ad.allDays), `ad-${ad.id}-numbers`);
}
