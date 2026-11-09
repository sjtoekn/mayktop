import Link from "next/link";
import { notFound } from "next/navigation";
import { adsConfig } from "@/config/site";
import { t } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { loadAdDetail } from "@/lib/ad-detail";
import AdMedia from "@/components/AdMedia";
import AdManage from "@/components/admin/AdManage";
import AdStatsView from "@/components/AdStatsView";
import "@/components/ad-social.css";
import "../ads.css";

// Admin: the details of ANY ad (patch-ads-details): who sent it, the money state, the full numbers and the history of decisions.
// Read only. Decisions (approve, reject, paid, pause) stay on /admin/ads, where the rules are checked.

const HISTORY_KEYS = {
  AD_APPROVED: "admin.ads.hist.AD_APPROVED",
  AD_REJECTED: "admin.ads.hist.AD_REJECTED",
  AD_PAID: "admin.ads.hist.AD_PAID",
  AD_PAUSED: "admin.ads.hist.AD_PAUSED",
  AD_RESTORED: "admin.ads.hist.AD_RESTORED",
  AD_ENDED: "admin.ads.hist.AD_ENDED",
  AD_RESUBMITTED: "admin.ads.hist.AD_RESUBMITTED",
  APPEAL_ACCEPTED: "admin.ads.hist.APPEAL_ACCEPTED",
  APPEAL_REJECTED: "admin.ads.hist.APPEAL_REJECTED",
} as const;

function dateTime(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC" : "-";
}
function dateText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

export default async function AdminAdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const ad = /^\d{1,9}$/.test(id) ? await loadAdDetail(Number(id), { kind: "admin" }) : null;
  if (!ad) notFound();
  const price = new Intl.NumberFormat("en", { style: "currency", currency: ad.currency }).format(ad.priceCents / 100);

  return (
    <>
      <section className="ad-head">
        <div className="adt-top">
          <h1 className="pc-title pc-title-lg">{t("ad.detail.title", { id: ad.id })}</h1>
          <div className="ad-badges">
            <span className="pc-badge pc-badge-info">{t(`advertise.my.status.${ad.status}`)}</span>
            <span className="pc-badge pc-badge-info">{t(`admin.ads.slot.${ad.slot}`)}</span>
            <span className={`pc-badge ${ad.paid ? "pc-badge-success" : "pc-badge-neutral"}`}>{t(ad.paid ? "admin.ads.paid" : "admin.ads.unpaid")}</span>
          </div>
        </div>
        <div className="adt-links">
          <Link href="/admin/ads" className="btn btn-ghost btn-sm">{t("ad.detail.back.admin")}</Link>
          <Link href="/admin/ads/stats" className="btn btn-ghost btn-sm">{t("admin.ads.stats.link")}</Link>
          <a href={ad.destinationUrl} className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer nofollow">{t("admin.ads.open")}</a>
        </div>
      </section>

      <article className="card ad-item">
        <div className="adt-summary">
        <div className="ad-block">
          <p className="ad-label">{t("admin.ads.preview")}</p>
          <aside className={`card card-ad ads-preview${ad.slot === "SOCIAL_FEED" ? " ad-social" : ""}`} aria-label={t("ad.label")}>
            <span className="badge badge-ad">{t("ad.badge")}</span>
            <AdMedia format={ad.format} imageUrl={ad.imageUrl} videoUrl={ad.videoUrl} title={ad.title} />
            <p className="ads-previewTitle">{ad.title}</p>
            <p className="pc-text">{ad.body}</p>
            {ad.host && <p className="pc-meta">{ad.host}</p>}
          </aside>
        </div>
        <div className="ad-block ads-facts">
          <p className="pc-meta">{t("admin.ads.from", { name: ad.advertiser, date: dateText(ad.submittedAt) })}</p>
          <p className="pc-meta">{t("admin.ads.contact", { email: ad.contactEmail })}</p>
          <p className="pc-meta ads-url" title={ad.destinationUrl}>{t("admin.ads.link", { url: ad.destinationUrl })}</p>
          <p className="pc-meta">{ad.community ? t("admin.ads.where.community", { community: ad.community }) : t("admin.ads.where.any")}</p>
          <p className="pc-meta">{t("admin.ads.price", { price, days: adsConfig.periodDays })}</p>
          {(ad.startDate || ad.endDate) && <p className="pc-meta">{t("admin.ads.dates", { start: dateText(ad.startDate), end: dateText(ad.endDate) })}</p>}
          {ad.paidAt && <p className="pc-meta">{t("admin.ads.detail.paidAt", { date: dateText(ad.paidAt) })}</p>}
        </div>
        </div>
      </article>

      <section className="card adt-block">
        <AdManage
          adId={ad.id}
          format={ad.format}
          initial={{ title: ad.title, body: ad.body, url: ad.destinationUrl, email: ad.contactEmail, slot: ad.slot }}
          slots={[...adsConfig.slots]}
          limits={{ titleMax: adsConfig.titleMaxLength, bodyMax: adsConfig.bodyMaxLength }}
        redirectAfterDelete="/admin/ads"
        />
      </section>

      <AdStatsView ad={ad} csvHref={`/admin/ads/${ad.id}/csv`} />

      <section className="card adt-block" aria-label={t("admin.ads.detail.history")}>
        <h2 className="pc-title">{t("admin.ads.detail.history")}</h2>
        {ad.history.length === 0 ? (
          <p className="pc-meta">{t("admin.ads.detail.history.none")}</p>
        ) : (
          <ul className="adt-history">
            {ad.history.map((h) => {
              const key = (HISTORY_KEYS as Record<string, (typeof HISTORY_KEYS)[keyof typeof HISTORY_KEYS]>)[h.action];
              return (
                <li key={h.id} className="adt-historyRow">
                  <p><b>{key ? t(key) : h.action}</b> · @{h.actor} · <span className="pc-meta">{dateTime(h.at)}</span></p>
                  {h.reason && <p className="pc-text">{h.reason}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
