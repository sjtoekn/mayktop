import Link from "next/link";
import { formatNumber, t } from "@/i18n";
import { requireAdmin } from "@/lib/admin";
import { loadAdsOverview, type OverviewGroup, type OverviewPeriod } from "@/lib/ad-detail";
import "@/components/ad-detail.css";
import "../ads.css";

// Admin: the numbers of ALL ads in one place (patch-ads-details): totals for 7 / 30 days and all time, by slot and format,
// a check that the fair rotation really is fair, and one row per ad with a link to its details. Read only; totals only.

export default async function AdminAdsStatsPage() {
  await requireAdmin();
  const o = await loadAdsOverview();
  const periods: { label: string; p: OverviewPeriod }[] = [
    { label: t("admin.ads.stats.p7"), p: o.p7 },
    { label: t("admin.ads.stats.p30"), p: o.p30 },
    { label: t("admin.ads.stats.all"), p: o.all },
  ];
  const slotName = (key: string) => t(`admin.ads.slot.${key as "SIDEBAR" | "FEED" | "SOCIAL_FEED" | "HEADER"}`);
  const formatName = (key: string) => t(`advertise.new.format.${key as "TEXT" | "IMAGE" | "VIDEO"}`);

  const groupTable = (title: string, groups: OverviewGroup[], name: (key: string) => string) => (
    <section className="card adt-block" aria-label={title}>
      <h2 className="pc-title">{title}</h2>
      <div className="adt-tableWrap">
        <table className="adt-table">
          <thead>
            <tr>
              <th scope="col" className="adt-left">{title}</th>
              <th scope="col">{t("admin.ads.stats.running")}</th>
              <th scope="col">{t("advertise.my.stats.shown")}</th>
              <th scope="col">{t("advertise.my.stats.clicks")}</th>
              <th scope="col">{t("ad.detail.card.ctr")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <th scope="row">{name(g.key)}</th>
                <td>{formatNumber(g.running)}</td>
                <td>{formatNumber(g.impressions)}</td>
                <td>{formatNumber(g.clicks)}</td>
                <td>{g.ctr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adt-note">{t("admin.ads.stats.group.note")}</p>
    </section>
  );

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.ads.stats.title")}</h1>
        <p className="pc-text">{t("admin.ads.stats.intro")}</p>
        <div className="adt-links">
          <Link href="/admin/ads" className="btn btn-ghost btn-sm">{t("ad.detail.back.admin")}</Link>
        </div>
      </section>

      <section className="card adt-block" aria-label={t("admin.ads.stats.totals")}>
        <h2 className="pc-title">{t("admin.ads.stats.totals")}</h2>
        <div className="adt-tableWrap">
          <table className="adt-table">
            <thead>
              <tr>
                <th scope="col" className="adt-left">{t("admin.ads.stats.period")}</th>
                <th scope="col">{t("advertise.my.stats.shown")}</th>
                <th scope="col">{t("advertise.my.stats.clicks")}</th>
                <th scope="col">{t("ad.detail.card.ctr")}</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(({ label, p }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatNumber(p.impressions)}</td>
                  <td>{formatNumber(p.clicks)}</td>
                  <td>{p.ctr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card adt-block" aria-label={t("admin.ads.stats.fair")}>
        <h2 className="pc-title">{t("admin.ads.stats.fair")}</h2>
        {o.fair.count === 0 ? (
          <p className="pc-meta">{t("admin.ads.stats.fair.none")}</p>
        ) : (
          <p className="pc-text">
            {t("admin.ads.stats.fair.line", { count: formatNumber(o.fair.count), min: formatNumber(o.fair.min), avg: formatNumber(o.fair.avg), max: formatNumber(o.fair.max) })}
          </p>
        )}
        <p className="adt-note">{t("admin.ads.stats.fair.note")}</p>
      </section>

      {groupTable(t("admin.ads.stats.bySlot"), o.bySlot, slotName)}
      {groupTable(t("admin.ads.stats.byFormat"), o.byFormat, formatName)}

      <section className="card adt-block" aria-label={t("admin.ads.stats.every")}>
        <h2 className="pc-title">{t("admin.ads.stats.every")}</h2>
        <div className="adt-tableWrap">
          <table className="adt-table">
            <thead>
              <tr>
                <th scope="col" className="adt-left">{t("admin.ads.stats.col.ad")}</th>
                <th scope="col">{t("advertise.my.stats.shown")}</th>
                <th scope="col">{t("advertise.my.stats.clicks")}</th>
                <th scope="col">{t("ad.detail.card.ctr")}</th>
                <th scope="col">{t("admin.ads.stats.col.week")}</th>
              </tr>
            </thead>
            <tbody>
              {o.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="adt-left">
                    <Link href={`/admin/ads/${r.id}`}>{t("admin.ads.item", { id: r.id })}</Link>{" "}
                    <span className="pc-meta">
                      {r.title} · @{r.advertiser} · {t(`advertise.my.status.${r.status}`)} · {slotName(r.slot)} · {formatName(r.format)}
                    </span>
                  </th>
                  <td>{formatNumber(r.impressions)}</td>
                  <td>{formatNumber(r.clicks)}</td>
                  <td>{r.ctr}</td>
                  <td>{formatNumber(r.week)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="adt-links">
          <a href="/admin/ads/stats/csv" className="btn btn-ghost btn-sm" download>
            {t("admin.ads.stats.csv")}
          </a>
        </div>
        {o.totalAds > o.rows.length && <p className="adt-note">{t("admin.ads.stats.limit", { shown: o.rows.length, total: o.totalAds })}</p>}
      </section>
    </>
  );
}
