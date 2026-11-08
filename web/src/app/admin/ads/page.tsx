import { formatNumber, t } from "@/i18n";
import { adsConfig, staffConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { loadAds, type AdItem, type AdSection } from "@/lib/admin-ads";
import { AD_RULE_TEXT } from "@/lib/ad-review-rules";
import AdMedia from "@/components/AdMedia";
import AdDecision, { type AdDecisionText } from "@/components/admin/AdDecision";
import "@/components/ad-social.css";
import "./ads.css";

function dateText(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date) : "-";
}

const SECTIONS: { key: AdSection; title: "admin.ads.section.queue" | "admin.ads.section.waiting" | "admin.ads.section.active" | "admin.ads.section.paused" }[] = [
  { key: "queue", title: "admin.ads.section.queue" },
  { key: "waiting", title: "admin.ads.section.waiting" },
  { key: "active", title: "admin.ads.section.active" },
  { key: "paused", title: "admin.ads.section.paused" },
];

export default async function AdminAdsPage() {
  const me = await requireAdmin();
  const sections = await loadAds(me.id);

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
  const empty = Object.values(sections).every((list) => list.length === 0);

  return (
    <>
      <section className="ad-head">
        <h1 className="pc-title pc-title-lg">{t("admin.ads.title")}</h1>
        <p className="pc-text">{t("admin.ads.intro")}</p>
      </section>

      {empty && <p className="card ad-empty">{t("admin.ads.empty")}</p>}

      {SECTIONS.map(({ key, title }) => {
        const list = sections[key];
        if (list.length === 0 && key !== "queue") return null;
        return (
          <section key={key} className="ads-section" aria-label={t(title, { count: list.length })}>
            <h2 className="pc-title">{t(title, { count: list.length })}</h2>
            {list.length === 0 && <p className="card ad-empty">{t("admin.ads.empty.queue")}</p>}
            {list.map((ad) => (
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
                  <p className="pc-meta">
                    {ad.community ? t("admin.ads.where.community", { community: ad.community }) : t("admin.ads.where.any")}
                  </p>
                  <p className="pc-meta ads-url">{t("admin.ads.link", { url: ad.destinationUrl })}</p>
                  <p className="pc-meta">{t("admin.ads.contact", { email: ad.contactEmail })}</p>
                  <p className="pc-meta">{t("admin.ads.price", { price: price(ad), days: adsConfig.periodDays })}</p>
                  {(ad.startDate || ad.endDate) && (
                    <p className="pc-meta">{t("admin.ads.dates", { start: dateText(ad.startDate), end: dateText(ad.endDate) })}</p>
                  )}
                  {key !== "queue" && (
                    <p className="pc-meta">
                      {t("admin.ads.stats", {
                        impressions: formatNumber(ad.impressions), clicks: formatNumber(ad.clicks),
                        ctr: ad.ctr, week: formatNumber(ad.weekImpressions),
                      })}
                    </p>
                  )}
                  {key === "queue" && <p className="pc-meta">{t("admin.ads.checkLink")}</p>}
                </div>

                <div className="ad-actionRow">
                  <a href={ad.destinationUrl} className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer nofollow">
                    {t("admin.ads.open")}
                  </a>
                </div>

                {ad.blockedSelf && <div className="notice notice-info">{t("admin.ads.block.self")}</div>}
                <AdDecision adId={ad.id} actions={ad.actions} rules={rules} limits={limits} text={text} />
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}
