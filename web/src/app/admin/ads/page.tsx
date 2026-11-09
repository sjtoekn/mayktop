import Link from "next/link";
import { formatNumber, t } from "@/i18n";
import { adsConfig, staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadAdsPage, type AdItem } from "@/lib/admin-ads";
import {
  ADS_FORMATS, ADS_SLOTS, ADS_VIEWS, adsLink, parseAdsQuery, type AdsView,
} from "@/lib/admin-ads-list-rules";
import { AD_RULE_TEXT, isPolicyRule } from "@/lib/ad-review-rules";
import AdMedia from "@/components/AdMedia";
import AdDecision, { type AdDecisionText } from "@/components/admin/AdDecision";
import AdManage from "@/components/admin/AdManage";
import "@/components/ad-social.css";
import "./ads.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function dateText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

// patch-ads-list: ONE tab at a time, 20 ads a page, with a search and two filters. A tab shows how many ads match. The History tab
// (rejected + ended ads) is a compact list with no preview and no buttons: it is for looking things up, the details page has the rest.
const TAB_TITLE: Record<AdsView, "admin.ads.section.queue" | "admin.ads.section.waiting" | "admin.ads.section.active" | "admin.ads.section.paused" | "admin.ads.section.history"> = {
  queue: "admin.ads.section.queue",
  waiting: "admin.ads.section.waiting",
  active: "admin.ads.section.active",
  paused: "admin.ads.section.paused",
  history: "admin.ads.section.history",
};

const EMPTY_TEXT: Record<AdsView, "admin.ads.empty.queue" | "admin.ads.empty.waiting" | "admin.ads.empty.active" | "admin.ads.empty.paused" | "admin.ads.empty.history"> = {
  queue: "admin.ads.empty.queue",
  waiting: "admin.ads.empty.waiting",
  active: "admin.ads.empty.active",
  paused: "admin.ads.empty.paused",
  history: "admin.ads.empty.history",
};

export default async function AdminAdsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireAdmin();
  const query = parseAdsQuery(await searchParams);
  const data = await loadAdsPage(me.id, query);
  const filtered = Boolean(query.q || query.slot || query.format);

  const errors: Record<string, string> = {
    other: t("admin.err.other"),
    actor: t("admin.err.actor"),
    reason: t("admin.err.reason", { min: "{min}", max: "{max}" }),
    notfound: t("admin.ads.err.notfound"),
    self: t("admin.ads.block.self"),
    state: t("admin.ads.err.state"),
    rule: t("admin.ads.err.rule"),
    expired: t("admin.ads.err.expired"),
  };
  const text: AdDecisionText = {
    buttons: {
      approve: t("admin.ads.btn.approve"), reject: t("admin.ads.btn.reject"), paid: t("admin.ads.btn.paid"),
      pause: t("admin.ads.btn.pause"), restore: t("admin.ads.btn.restore"),
    },
    notes: {
      approve: t("admin.ads.note.approve"), reject: t("admin.ads.note.reject"),
      paid: t("admin.ads.note.paid", { days: adsConfig.periodDays }),
      pause: t("admin.ads.note.pause"), restore: t("admin.ads.note.restore"),
    },
    sure: {
      approve: t("admin.ads.sure.approve", { id: "{id}" }), reject: t("admin.ads.sure.reject", { id: "{id}" }),
      paid: t("admin.ads.sure.paid", { id: "{id}" }), pause: t("admin.ads.sure.pause", { id: "{id}" }),
      restore: t("admin.ads.sure.restore", { id: "{id}" }),
    },
    rule: t("admin.ads.rule"),
    reason: t("admin.act.reason", { min: "{min}" }),
    continue: t("admin.act.continue"),
    back: t("admin.act.back"),
    cancel: t("admin.act.cancel"),
    working: t("admin.act.working"),
    done: t("admin.act.done"),
    errors,
  };
  const rules = adsConfig.policyRules.map((key) => ({ key, label: t(AD_RULE_TEXT[key]) }));
  const limits = { minReason: staffConfig.minReasonLength, maxReason: staffConfig.maxReasonLength };
  const price = (ad: AdItem) => new Intl.NumberFormat("en", { style: "currency", currency: ad.currency }).format(ad.priceCents / 100);
  const isHistory = query.view === "history";

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.ads.title")}</h1>
        <p className="pc-text">{t("admin.ads.intro")}</p>
        <div className="ad-actionRow">
          <Link href="/admin/ads/stats" className="btn btn-ghost btn-sm">
            {t("admin.ads.stats.link")}
          </Link>
        </div>
      </section>

      <form className="card ad-filters" method="get" action="/admin/ads" role="search">
        <input type="hidden" name="view" value={query.view} />
        <div className="ad-filterField ad-filterGrow">
          <label className="sf-label" htmlFor="ads-q">{t("admin.ads.search.label")}</label>
          <input id="ads-q" name="q" className="pc-field" type="search" maxLength={100} defaultValue={query.q} placeholder={t("admin.ads.search.placeholder")} />
        </div>
        <div className="ad-filterField">
          <label className="sf-label" htmlFor="ads-slot">{t("admin.ads.filter.slot")}</label>
          <select id="ads-slot" name="slot" className="pc-field" defaultValue={query.slot}>
            <option value="">{t("admin.people.filter.all")}</option>
            {ADS_SLOTS.map((s) => (
              <option key={s} value={s}>{t(`admin.ads.slot.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="ad-filterField">
          <label className="sf-label" htmlFor="ads-format">{t("admin.ads.filter.format")}</label>
          <select id="ads-format" name="format" className="pc-field" defaultValue={query.format}>
            <option value="">{t("admin.people.filter.all")}</option>
            {ADS_FORMATS.map((f) => (
              <option key={f} value={f}>{t(`advertise.new.format.${f}`)}</option>
            ))}
          </select>
        </div>
        <div className="ad-filterButtons">
          <button type="submit" className="btn btn-primary">{t("admin.people.search.button")}</button>
          {filtered && (
            <Link href={adsLink({ ...query, q: "", slot: "", format: "", page: 1 })} className="btn btn-ghost">{t("admin.people.reset")}</Link>
          )}
        </div>
      </form>

      <nav className="ads-tabs" aria-label={t("admin.ads.tabs")}>
        {ADS_VIEWS.map((view) => (
          <Link
            key={view}
            href={adsLink(query, { view, page: 1 })}
            className={`ads-tab${view === query.view ? " ads-tab-on" : ""}`}
            aria-current={view === query.view ? "page" : undefined}
          >
            {t(TAB_TITLE[view], { count: formatNumber(data.counts[view]) })}
          </Link>
        ))}
      </nav>

      {data.total > 0 && (
        <p className="pc-meta" role="status">
          {t("admin.ads.range", { from: formatNumber(data.from), to: formatNumber(data.to), total: formatNumber(data.total) })}
        </p>
      )}

      {data.items.length === 0 && (
        <p className="card ad-empty">{t(filtered ? "admin.ads.empty.match" : EMPTY_TEXT[query.view])}</p>
      )}

      <section className="ads-section" aria-label={t(TAB_TITLE[query.view], { count: formatNumber(data.total) })}>
        {data.items.map((ad) =>
          isHistory ? (
            <article key={ad.id} className="card ad-item ads-history">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">
                    <Link href={`/admin/ads/${ad.id}`}>{t("admin.ads.item", { id: ad.id })}</Link> · {ad.title}
                  </h3>
                  <p className="pc-meta">{t("admin.ads.from", { name: ad.advertiser, date: dateText(ad.submittedAt) })}</p>
                </div>
                <div className="ad-badges">
                  <span className={`pc-badge ${ad.status === "REJECTED" ? "pc-badge-danger" : "pc-badge-neutral"}`}>{t(`advertise.my.status.${ad.status}`)}</span>
                  <span className="pc-badge pc-badge-info">{t(`admin.ads.slot.${ad.slot}`)}</span>
                  <span className="pc-badge pc-badge-neutral">{t(`advertise.new.format.${ad.format}`)}</span>
                </div>
              </div>
              {ad.status === "REJECTED" && (
                <div className="ads-facts">
                  {ad.reviewRule && (
                    <p className="pc-meta">{t("advertise.my.rejected", { rule: isPolicyRule(ad.reviewRule) ? t(AD_RULE_TEXT[ad.reviewRule]) : ad.reviewRule })}</p>
                  )}
                  {ad.reviewNote && <p className="pc-meta">{t("advertise.my.reason", { reason: ad.reviewNote })}</p>}
                </div>
              )}
              {ad.status === "ENDED" && (ad.startDate || ad.endDate) && (
                <p className="pc-meta">{t("admin.ads.dates", { start: dateText(ad.startDate), end: dateText(ad.endDate) })}</p>
              )}
              {(ad.impressions > 0 || ad.clicks > 0) && (
                <p className="pc-meta">
                  {t("admin.ads.stats", {
                    impressions: formatNumber(ad.impressions), clicks: formatNumber(ad.clicks),
                    ctr: ad.ctr, week: formatNumber(ad.weekImpressions),
                  })}
                </p>
              )}
              <div className="ad-actionRow">
                <Link href={`/admin/ads/${ad.id}`} className="btn btn-ghost btn-sm">{t("ad.detail.link")}</Link>
              </div>
              <AdManage
                adId={ad.id}
                format={ad.format}
                initial={{ title: ad.title, body: ad.body, url: ad.destinationUrl, email: ad.contactEmail, slot: ad.slot }}
                slots={[...adsConfig.slots]}
                limits={{ titleMax: adsConfig.titleMaxLength, bodyMax: adsConfig.bodyMaxLength }}
              />
            </article>
          ) : (
            <article key={ad.id} className="card ad-item">
              <div className="ad-profileTop">
                <div>
                  <h3 className="pc-title">{t("admin.ads.item", { id: ad.id })}</h3>
                  <p className="pc-meta">{t("admin.ads.from", { name: ad.advertiser, date: dateText(ad.submittedAt) })}</p>
                </div>
                <div className="ad-badges">
                  <span className="pc-badge pc-badge-info">{t(`admin.ads.slot.${ad.slot}`)}</span>
                  <span className={`pc-badge ${ad.paid ? "pc-badge-success" : "pc-badge-neutral"}`}>{t(ad.paid ? "admin.ads.paid" : "admin.ads.unpaid")}</span>
                </div>
              </div>

              <div className="ads-layout">
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

              <div className="ads-side">
              <div className="ad-block ads-facts">
                <p className="pc-meta">
                  {ad.community ? t("admin.ads.where.community", { community: ad.community }) : t("admin.ads.where.any")}
                </p>
                <p className="pc-meta ads-url" title={ad.destinationUrl}>{t("admin.ads.link", { url: ad.destinationUrl })}</p>
                <p className="pc-meta">{t("admin.ads.contact", { email: ad.contactEmail })}</p>
                <p className="pc-meta">{t("admin.ads.price", { price: price(ad), days: adsConfig.periodDays })}</p>
                {(ad.startDate || ad.endDate) && (
                  <p className="pc-meta">{t("admin.ads.dates", { start: dateText(ad.startDate), end: dateText(ad.endDate) })}</p>
                )}
                {query.view !== "queue" && (
                  <p className="pc-meta">
                    {t("admin.ads.stats", {
                      impressions: formatNumber(ad.impressions), clicks: formatNumber(ad.clicks),
                      ctr: ad.ctr, week: formatNumber(ad.weekImpressions),
                    })}
                  </p>
                )}
                {query.view === "queue" && <p className="pc-meta">{t("admin.ads.checkLink")}</p>}
              </div>

              <div className="ads-actions">
              <div className="ad-actionRow">
                <Link href={`/admin/ads/${ad.id}`} className="btn btn-primary btn-sm">
                  {t("ad.detail.link")}
                </Link>
                <a href={ad.destinationUrl} className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer nofollow">
                  {t("admin.ads.open")}
                </a>
              </div>

              {ad.blockedSelf && <div className="notice notice-info">{t("admin.ads.block.self")}</div>}
              <AdDecision adId={ad.id} actions={ad.actions} rules={rules} limits={limits} text={text} />
              <AdManage
                adId={ad.id}
                format={ad.format}
                initial={{ title: ad.title, body: ad.body, url: ad.destinationUrl, email: ad.contactEmail, slot: ad.slot }}
                slots={[...adsConfig.slots]}
                limits={{ titleMax: adsConfig.titleMaxLength, bodyMax: adsConfig.bodyMaxLength }}
              />
              </div>
              </div>
              </div>
            </article>
          ),
        )}
      </section>

      {data.pages > 1 && (
        <nav className="ad-pager" aria-label={t("admin.people.page", { page: formatNumber(data.page), pages: formatNumber(data.pages) })}>
          {data.page > 1 ? (
            <Link href={adsLink(query, { page: data.page - 1 })} className="btn btn-secondary btn-sm">{t("admin.people.prev")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("admin.people.prev")}</span>
          )}
          <span className="pc-meta">{t("admin.people.page", { page: formatNumber(data.page), pages: formatNumber(data.pages) })}</span>
          {data.page < data.pages ? (
            <Link href={adsLink(query, { page: data.page + 1 })} className="btn btn-secondary btn-sm">{t("admin.people.next")}</Link>
          ) : (
            <span className="btn btn-secondary btn-sm" aria-disabled="true">{t("admin.people.next")}</span>
          )}
        </nav>
      )}
    </>
  );
}
