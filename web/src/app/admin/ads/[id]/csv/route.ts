import { requireAdmin } from "@/lib/admin";
import { loadAdDetail } from "@/lib/ad-detail";
import { buildAdCsv, csvResponse } from "@/lib/ad-csv";

// Admin: day-by-day numbers of any ad as CSV (patch-ads-csv). Not logged in -> login page; not an admin -> 404 (requireAdmin).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await ctx.params;
  const ad = /^\d{1,9}$/.test(id) ? await loadAdDetail(Number(id), { kind: "admin" }) : null;
  if (!ad) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return csvResponse(buildAdCsv(ad.allDays), `ad-${ad.id}-numbers`);
}
