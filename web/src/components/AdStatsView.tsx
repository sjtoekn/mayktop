// The numbers of one ad: cards, a bar chart per day, and the day table. Server component, shared by the advertiser's
// details page and the admin's details page (patch-ads-details). Only totals per ad per day; nothing about visitors.
import { formatNumber, getLocale, t, tn } from "@/i18n";
import { barPercents } from "@/lib/ad-detail-rules";
import type { AdDetail } from "@/lib/ad-detail";
import { ctrText } from "@/lib/ad-review-rules";
import "./ad-detail.css";

function dayText(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
function shortDay(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export default function AdStatsView({ ad, csvHref }: { ad: AdDetail; csvHref?: string }) {
  const s = ad.summary;
  const days = ad.days;
  const none = s.impressions === 0 && s.clicks === 0;
  const impBars = barPercents(days.map((d) => d.impressions));
  const clkBars = barPercents(days.map((d) => d.clicks));
  const trend =
    s.trend.kind === "none" ? t("ad.detail.trend.none")
    : s.trend.kind === "new" ? t("ad.detail.trend.new")
    : t("ad.detail.trend", { change: s.trend.change });
  const newestFirst = [...days].reverse();

  return (
    <div className="adt-wrap">
      <dl className="adt-cards">
        <div className="card adt-card">
          <dt>{t("ad.detail.card.shown")}</dt>
          <dd>{formatNumber(s.impressions)}</dd>
        </div>
        <div className="card adt-card">
          <dt>{t("ad.detail.card.clicks")}</dt>
          <dd>{formatNumber(s.clicks)}</dd>
        </div>
        <div className="card adt-card">
          <dt>{t("ad.detail.card.ctr")}</dt>
          <dd>{s.ctr}</dd>
        </div>
        <div className="card adt-card">
          <dt>{t("ad.detail.card.week")}</dt>
          <dd>{formatNumber(s.last7.impressions)}</dd>
          <span className="adt-sub">{trend}</span>
        </div>
        <div className="card adt-card">
          <dt>{t("ad.detail.card.avg")}</dt>
          <dd>{formatNumber(s.avgPerDay)}</dd>
          <span className="adt-sub">{tn("ad.detail.card.avg.days", s.daysCounted)}</span>
        </div>
        <div className="card adt-card">
          <dt>{t("ad.detail.card.best")}</dt>
          <dd>{s.bestDay ? shortDay(s.bestDay.date) : "-"}</dd>
          <span className="adt-sub">{s.bestDay ? tn("ad.detail.card.best.shown", s.bestDay.impressions) : t("ad.detail.none")}</span>
        </div>
      </dl>

      {ad.period && (
        <section className="card adt-block" aria-label={t("ad.detail.period.title")}>
          <h2 className="pc-title">{t("ad.detail.period.title")}</h2>
          <p className="pc-text">{t("ad.detail.period", { passed: ad.period.passed, total: ad.period.total })} · {tn("ad.detail.period.left", ad.period.left)}</p>
          <div className="adt-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ad.period.total} aria-valuenow={ad.period.passed}>
            <div className="adt-progressFill" style={{ width: `${Math.round((ad.period.passed / ad.period.total) * 100)}%` }} />
          </div>
        </section>
      )}

      <section className="card adt-block" aria-label={t("ad.detail.chart.title")}>
        <h2 className="pc-title">{t("ad.detail.chart.title")}</h2>
        {none ? (
          <p className="pc-meta">{t("ad.detail.none")}</p>
        ) : (
          <>
            <div className="adt-chartWrap">
              <div className="adt-chart" role="img" aria-label={t("ad.detail.chart.shown")}>
                {days.map((d, i) => (
                  <div key={d.date.toISOString()} className="adt-col" title={`${shortDay(d.date)}: ${formatNumber(d.impressions)}`}>
                    <div className="adt-bar" style={{ height: `${impBars[i]}%` }} />
                  </div>
                ))}
              </div>
              <div className="adt-axis"><span>{shortDay(days[0].date)}</span><span>{shortDay(days[days.length - 1].date)}</span></div>
            </div>
            <p className="pc-meta"><span className="adt-dot" />{t("ad.detail.chart.shown")}</p>

            <div className="adt-chartWrap">
              <div className="adt-chart" role="img" aria-label={t("ad.detail.chart.clicks")}>
                {days.map((d, i) => (
                  <div key={d.date.toISOString()} className="adt-col" title={`${shortDay(d.date)}: ${formatNumber(d.clicks)}`}>
                    <div className="adt-bar adt-bar-clicks" style={{ height: `${clkBars[i]}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <p className="pc-meta"><span className="adt-dot adt-dot-clicks" />{t("ad.detail.chart.clicks")}</p>
          </>
        )}
      </section>

      <section className="card adt-block" aria-label={t("ad.detail.table.title")}>
        <h2 className="pc-title">{t("ad.detail.table.title")}</h2>
        <div className="adt-tableWrap">
          <table className="adt-table">
            <caption className="pc-meta">{tn("ad.detail.table.caption", days.length)}</caption>
            <thead>
              <tr>
                <th scope="col">{t("advertise.my.stats.day")}</th>
                <th scope="col">{t("advertise.my.stats.shown")}</th>
                <th scope="col">{t("advertise.my.stats.clicks")}</th>
                <th scope="col">{t("ad.detail.card.ctr")}</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((d) => (
                <tr key={d.date.toISOString()}>
                  <th scope="row">{dayText(d.date)}</th>
                  <td>{formatNumber(d.impressions)}</td>
                  <td>{formatNumber(d.clicks)}</td>
                  <td>{ctrText(d.impressions, d.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ad.olderDays > 0 && <p className="adt-note">{tn("ad.detail.table.older", ad.olderDays)}</p>}
        {csvHref && (
          <div className="adt-links">
            <a href={csvHref} className="btn btn-ghost btn-sm" download>
              {t("ad.detail.csv")}
            </a>
          </div>
        )}
      </section>

      <p className="adt-note">{t("ad.detail.note.how")}</p>
    </div>
  );
}
