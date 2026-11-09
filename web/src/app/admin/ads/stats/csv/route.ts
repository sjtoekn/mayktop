import { requireAdmin } from "@/lib/admin";
import { loadAdsOverview } from "@/lib/ad-detail";
import { buildOverviewCsv, csvResponse } from "@/lib/ad-csv";

// Admin: one row per ad (the 200 most shown) as CSV (patch-ads-csv).
export async function GET() {
  await requireAdmin();
  const o = await loadAdsOverview();
  return csvResponse(buildOverviewCsv(o.rows), "ads-numbers");
}
