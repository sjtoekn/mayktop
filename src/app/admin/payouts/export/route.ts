// The CSV an admin pays from (TODO 12, S8): GET /admin/payouts/export?batch=12&method=PAYPAL
// Admin only (a non-admin gets a 404 from requireAdmin, like the rest of the panel). The payment details are decrypted only inside this response,
// which is never cached.
import { requireAdmin } from "@/lib/admin";
import { exportBatchCsv } from "@/lib/creator-payouts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  await requireAdmin();
  const url = new URL(request.url);
  const batch = Number(url.searchParams.get("batch"));
  const method = url.searchParams.get("method") ?? "";
  const result = await exportBatchCsv(batch, method);
  if ("error" in result) {
    const status = result.error === "type" ? 400 : result.error === "nokey" ? 503 : 404;
    return new Response(result.error, { status, headers: { "Cache-Control": "no-store" } });
  }
  return new Response("\uFEFF" + result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payout-round-${batch}-${method.toLowerCase()}.csv"`,
      "Cache-Control": "no-store",
      "X-Missing-Payouts": result.missing.join(","), // ids left out (details changed after the round was made)
    },
  });
}
