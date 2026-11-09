import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { adsConfig } from "@/config/site";
import { formatNumber, getLocale, t } from "@/i18n";
import { getSessionUser } from "@/lib/session";
import { loadMyAdsPage, type MyAd } from "@/lib/ad-mine";
import { MY_RANGES, MY_VIEWS, myLink, parseMyQuery, type MyQuery } from "@/lib/ad-mine-list-rules";
import { AD_RULE_TEXT, isPolicyRule } from "@/lib/ad-review-rules";
import AdMedia from "@/components/AdMedia";
import MyAdActions, { type MyAdActionsText } from "@/components/MyAdActions";
import "../advertise.css";
import "./my.css";

export const metadata: Metadata = { title: t("advertise.my.title") };

// "My ads" (ADS_PLAN Sessions 4a + 4b + 4c, patch-ads-my-list): the advertiser's own ads, their status, the review result and the totals. Login required.
// patch-ads-my-list: TABS (all / running / waiting / rejected / ended), 10 ads a page, and the numbers can be shown for the last 7 / 30 / 90 days or all time.
// It reads the login cookie, so it runs per request (inside <Suspense>), like /advertise/new.
// Totals are per ad per day; nothing about visitors exists (ADS_PLAN decision 3).

const STATUS_BADGE: Record<MyAd["status"], string> = {
  DRAFT: "pc-badge-neutral",
  SUBMITTED: "pc-badge-info",
  APPROVED: "pc-badge-warning",
  REJECTED: "pc-badge-danger",
  ACTIVE: "pc-badge-success",
  PAUSED: "pc-badge-warning",
  ENDED: "pc-badge-neutral",
};

function dayText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

function shortDay(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function actionsText(): MyAdActionsText {
  return {
    buttons: { pause: t("advertise.my.btn.pause"), resume: t("advertise.my.btn.resume"), end: t("advertise.my.btn.end") },
    notes: { pause: t("advertise.my.note.pause"), resume: t("advertise.my.note.resume"), end: t("advertise.my.note.end") },
    sure: { pause: t("advertise.my.sure.pause"), resume: t("advertise.my.sure.resume"), end: t("advertise.my.sure.end") },
    yes: t("advertise.my.yes"),
    cancel: t("advertise.new.cancel"),
    working: t("advertise.my.working"),
    errors: {
      other: t("advertise.my.err.other"),
      notfound: t("advertise.my.err.notfound"),
      state: t("advertise.my.err.state"),
      staff: t("advertise.my.err.staff"),
      expired: t("advertise.my.err.expired"),
      login: t("auth.required"),
    },
  };
}

/** One line that says what happens next, by status. */
function hint(ad: MyAd): string | null {
  if (ad.status === "SUBMITTED") return t("advertise.my.hint.SUBMITTED");
  if (ad.status === "APPROVED") return t("advertise.my.hint.APPROVED");
  if (ad.status === "PAUSED") return t(ad.pausedBy === "you" ? "advertise.my.hint.pausedYou" : "advertise.my.hint.pausedStaff");
  if (ad.status === "ENDED") return t("advertise.my.hint.ENDED");
  return null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Content({ searchParams }: { searchParams: SearchParams }) {
  const query: MyQuery = parseMyQuery(await searchParams);
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.title")}</h1>
        <div className="notice notice-info" role="status">
          {t("auth.required")}{" "}
          <Link href="/login" className="underline">
            {t("topbar.login")}
          </Link>
        </div>
      </section>
    );
  }

  const data = await loadMyAdsPage(user.id, query);
  const ads = data.items;
  const rangeDays = query.range === "all" ? null : Number.parseInt(query.range, 10);
  const text = actionsText();
  const price = (ad: MyAd) => new Intl.NumberFormat(getLocale(), { style: "currency", currency: ad.currency }).format(ad.priceCents / 100);

  return (
    <div className="adv-wrap">
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.my.title")}</h1>
        <p className="adv-text">{t("advertise.my.intro")}</p>
        <div className="adv-actions">
          <Link href="/advertise/new" className="btn btn-primary btn-lg">
            {t("advertise.cta")}
          </Link>
        </div>
      </section>

      {data.counts.all === 0 && (
        <p className="card adv-card" role="status">
          {t("advertise.my.empty")}
        </p>
      )}

      {data.counts.all > 0 && (
        <>
          <nav className="my-tabs" aria-label={t("advertise.my.tabs")}>
            {MY_VIEWS.map((view) => (
              <Link
                key={view}
                href={myLink(query, { view, page: 1 })}
                className={`my-tab${view === query.view ? " my-tab-on" : ""}`}
                aria-current={view === query.view ? "page" : undefined}
              >
                {t(`advertise.my.tab.${view}`, { count: formatNumber(data.counts[view]) })}
              </Link>
            ))}
          </nav>
          <nav className="my-tabs my-ranges" aria-label={t("advertise.my.range.label")}>
            <span className="pc-meta">{t("advertise.my.range.label")}</span>
            {MY_RANGES.map((range) => (
              <Link
                key={range}
                href={myLink(query, { range, page: 1 })}
                className={`my-tab${range === query.range ? " my-tab-on" : ""}`}
                aria-current={range === query.range ? "true" : undefined}
              >
                {t(`advertise.my.range.${range}`)}
              </Link>
            ))}
          </nav>
          {data.total > 0 && (
            <p className="pc-meta" role="status">
              {t("advertise.my.showing", { from: formatNumber(data.from), to: formatNumber(data.to), total: formatNumber(data.total) })}
            </p>
          )}
        </>
      )}

      {data.counts.all > 0 && ads.length === 0 && (
        <p className="card adv-card" role="status">
          {t("advertise.my.empty.tab")}
        </p>
      )}

      <div className="my-list">
        {ads.map((ad) => {
          const note = hint(ad);
          const rule = ad.reviewRule && isPolicyRule(ad.reviewRule) ? t(AD_RULE_TEXT[ad.reviewRule]) : ad.reviewRule;
          const counted = ad.status === "ACTIVE" || ad.status === "PAUSED" || ad.status === "ENDED" || ad.impressions > 0;
          return (
            <article key={ad.id} className="card my-item">
              <div className="my-top">
                <div>
                  <h2 className="pc-title">{ad.title}</h2>
                  {ad.submittedAt && <p className="pc-meta">{t("advertise.my.sent", { date: dayText(ad.submittedAt) })}</p>}
                </div>
                <div className="my-badges">
                  <span className={`pc-badge ${STATUS_BADGE[ad.status]}`}>{t(`advertise.my.status.${ad.status}`)}</span>
                  <span className="pc-badge pc-badge-info">{t(`advertise.new.slot.${ad.slot}`)}</span>
                  {ad.status !== "SUBMITTED" && ad.status !== "REJECTED" && ad.status !== "DRAFT" && (
                    <span className={`pc-badge ${ad.paid ? "pc-badge-success" : "pc-badge-neutral"}`}>
                      {t(ad.paid ? "advertise.my.paid" : "advertise.my.unpaid")}
                    </span>
                  )}
                </div>
              </div>

              <aside className="card card-ad my-preview" aria-label={t("ad.label")}>
                <span className="badge badge-ad">{t("ad.badge")}</span>
                <AdMedia format={ad.format} imageUrl={ad.imageUrl} videoUrl={ad.videoUrl} title={ad.title} />
                <p className="my-previewTitle">{ad.title}</p>
                <p className="pc-text">{ad.body}</p>
                {ad.host && <p className="pc-meta">{ad.host}</p>}
              </aside>

              <div className="my-facts">
                <p className="pc-meta">
                  {ad.community ? t("advertise.my.where.community", { community: ad.community }) : t("advertise.new.where.any")}
                </p>
                <p className="pc-meta">{t("advertise.my.price", { price: price(ad), days: adsConfig.periodDays })}</p>
                {(ad.startDate || ad.endDate) && (
                  <p className="pc-meta">{t("advertise.my.dates", { start: dayText(ad.startDate), end: dayText(ad.endDate) })}</p>
                )}
              </div>

              {ad.status === "REJECTED" && (
                <div className="notice notice-warning my-why" role="status">
                  {rule && <p className="pc-text">{t("advertise.my.rejected", { rule })}</p>}
                  {ad.reviewNote && <p className="pc-text">{t("advertise.my.reason", { reason: ad.reviewNote })}</p>}
                  <p className="pc-meta">{t("advertise.my.rejected.next")}</p>
                  {ad.appeal?.state === "open" && ad.appeal.appeal && (
                    <p className="pc-text">{t("advertise.my.appeal.open", { date: dayText(ad.appeal.appeal.createdAt) })}</p>
                  )}
                  {ad.appeal?.state === "rejected" && ad.appeal.appeal && (
                    <p className="pc-text">{t("advertise.my.appeal.rejected", { note: ad.appeal.appeal.note })}</p>
                  )}
                  <div className="adv-actions">
                    {ad.canEdit && (
                      <Link href={`/advertise/my/${ad.id}/edit`} className="btn btn-primary btn-sm">
                        {t("advertise.my.btn.edit")}
                      </Link>
                    )}
                    {ad.appeal && (ad.appeal.state === "can" || ad.appeal.state === "open" || ad.appeal.state === "rejected") && (
                      <Link href={`/advertise/my/${ad.id}/appeal`} className="btn btn-ghost btn-sm">
                        {t(ad.appeal.state === "can" ? "advertise.my.btn.appeal" : "advertise.my.btn.appeal.view")}
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {ad.status === "APPROVED" && ad.appeal?.state === "accepted" && ad.appeal.appeal && (
                <div className="notice notice-success" role="status">
                  {t("advertise.my.appeal.accepted", { note: ad.appeal.appeal.note })}
                </div>
              )}
              {note && <div className="notice notice-info" role="status">{note}</div>}

              {counted && (
                <div className="my-stats">
                  {ad.impressions === 0 && ad.clicks === 0 ? (
                    <p className="pc-meta">{t("advertise.my.stats.none")}</p>
                  ) : (
                    <p className="my-total">
                      {t("advertise.my.stats.total", {
                        impressions: formatNumber(ad.impressions),
                        clicks: formatNumber(ad.clicks),
                        ctr: ad.ctr,
                      })}
                    </p>
                  )}
                  {ad.range && rangeDays !== null && (ad.impressions > 0 || ad.clicks > 0) && (
                    <p className="my-total">
                      {t("advertise.my.stats.range", {
                        days: rangeDays,
                        impressions: formatNumber(ad.range.impressions),
                        clicks: formatNumber(ad.range.clicks),
                        ctr: ad.range.ctr,
                      })}
                    </p>
                  )}
                  {query.range !== "7" && <p className="pc-meta">{t("advertise.my.stats.dayByDay")}</p>}
                  {query.range === "7" && (
                  <div className="my-tableWrap">
                    <table className="my-table">
                      <caption className="pc-meta">{t("advertise.my.stats.days")}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t("advertise.my.stats.day")}</th>
                          <th scope="col">{t("advertise.my.stats.shown")}</th>
                          <th scope="col">{t("advertise.my.stats.clicks")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ad.days.map((d) => (
                          <tr key={d.date.toISOString()}>
                            <th scope="row">{shortDay(d.date)}</th>
                            <td>{formatNumber(d.impressions)}</td>
                            <td>{formatNumber(d.clicks)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              <div className="adv-actions">
                <Link href={`/advertise/my/${ad.id}`} className="btn btn-ghost btn-sm">
                  {t("ad.detail.link")}
                </Link>
              </div>
              <MyAdActions adId={ad.id} actions={ad.actions} text={text} />
            </article>
          );
        })}
      </div>

      {data.pages > 1 && (
        <nav className="my-pager" aria-label={t("advertise.my.page", { page: formatNumber(data.page), pages: formatNumber(data.pages) })}>
          {data.page > 1 ? (
            <Link href={myLink(query, { page: data.page - 1 })} className="btn btn-secondary btn-sm">{t("advertise.my.prev")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("advertise.my.prev")}</span>
          )}
          <span className="pc-meta">{t("advertise.my.page", { page: formatNumber(data.page), pages: formatNumber(data.pages) })}</span>
          {data.page < data.pages ? (
            <Link href={myLink(query, { page: data.page + 1 })} className="btn btn-secondary btn-sm">{t("advertise.my.next")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("advertise.my.next")}</span>
          )}
        </nav>
      )}
    </div>
  );
}

export default function MyAdsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<section className="card adv-card" aria-busy="true" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
