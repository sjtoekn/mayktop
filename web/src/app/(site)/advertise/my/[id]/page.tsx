import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adsConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import { getSessionUser } from "@/lib/session";
import { loadAdDetail } from "@/lib/ad-detail";
import AdMedia from "@/components/AdMedia";
import AdStatsView from "@/components/AdStatsView";
import "../../advertise.css";
import "../my.css";

export const metadata: Metadata = { title: t("ad.detail.title.plain"), robots: { index: false, follow: false } };

// The details of ONE of my ads: totals, click rate, a chart and a table per day (patch-ads-details).
// Only the advertiser of the ad can open it; for any other ad or person it is a plain "not found" (we do not admit the ad exists).

function dayText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="card adv-card">
        <h1 className="adv-h1">{t("ad.detail.title.plain")}</h1>
        <div className="notice notice-info" role="status">
          {t("auth.required")}{" "}
          <Link href="/login" className="underline">
            {t("topbar.login")}
          </Link>
        </div>
      </section>
    );
  }
  const { id } = await params;
  const ad = /^\d{1,9}$/.test(id) ? await loadAdDetail(Number(id), { kind: "advertiser", userId: user.id }) : null;
  if (!ad) notFound();
  const price = new Intl.NumberFormat(getLocale(), { style: "currency", currency: ad.currency }).format(ad.priceCents / 100);

  return (
    <div className="adv-wrap">
      <section className="card adv-card">
        <div className="adt-top">
          <h1 className="adv-h1">{t("ad.detail.title", { id: ad.id })}</h1>
          <div className="my-badges">
            <span className="pc-badge pc-badge-info">{t(`advertise.my.status.${ad.status}`)}</span>
            <span className="pc-badge pc-badge-info">{t(`advertise.new.slot.${ad.slot}`)}</span>
          </div>
        </div>
        <div className="adt-links">
          <Link href="/advertise/my" className="btn btn-ghost btn-sm">
            {t("ad.detail.back.my")}
          </Link>
        </div>

        <div className="adt-summary">
        <aside className="card card-ad my-preview" aria-label={t("ad.label")}>
          <span className="badge badge-ad">{t("ad.badge")}</span>
          <AdMedia format={ad.format} imageUrl={ad.imageUrl} videoUrl={ad.videoUrl} title={ad.title} />
          <p className="my-previewTitle">{ad.title}</p>
          <p className="pc-text">{ad.body}</p>
          {ad.host && <p className="pc-meta">{ad.host}</p>}
        </aside>

        <div className="my-facts">
          <p className="pc-meta">{ad.community ? t("advertise.my.where.community", { community: ad.community }) : t("advertise.new.where.any")}</p>
          <p className="pc-meta">{t("advertise.my.price", { price, days: adsConfig.periodDays })}</p>
          {(ad.startDate || ad.endDate) && <p className="pc-meta">{t("advertise.my.dates", { start: dayText(ad.startDate), end: dayText(ad.endDate) })}</p>}
          {ad.submittedAt && <p className="pc-meta">{t("advertise.my.sent", { date: dayText(ad.submittedAt) })}</p>}
        </div>
        </div>
      </section>

      <AdStatsView ad={ad} csvHref={`/advertise/my/${ad.id}/csv`} />
      <p className="adt-note">{t("ad.detail.note.rotation")}</p>
    </div>
  );
}

// Only the empty page shell is prepared at build time; no ad is read for this placeholder id (same as the edit and appeal pages).
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function MyAdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<section className="card adv-card" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}
