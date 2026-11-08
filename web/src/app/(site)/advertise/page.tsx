import type { Metadata } from "next";
import Link from "next/link";
import { adsConfig, siteConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import "./advertise.css";

export const metadata: Metadata = { title: t("advertise.title", { site: siteConfig.name }) };

// The public page for advertisers (ADS_PLAN Session 3). No login needed to read it. Every number comes from `adsConfig`
// (src/config/site.ts), so this page and the code cannot disagree. It makes the same promises as ADS_PLAN section 0:
// flat fee, no tracking of readers, fair rotation, and NO promised number of views.
export default function AdvertisePage() {
  const price = new Intl.NumberFormat(getLocale(), { style: "currency", currency: adsConfig.currency }).format(
    adsConfig.monthlyPriceCents / 100,
  );
  const how = ["advertise.how.1", "advertise.how.2", "advertise.how.3", "advertise.how.4"] as const;
  const rules = ["advertise.rule.1", "advertise.rule.2", "advertise.rule.3", "advertise.rule.4", "advertise.rule.5"] as const;
  const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

  return (
    <div className="adv-wrap">
      <section className="card adv-card">
        <h1 className="adv-h1">{t("advertise.title", { site: siteConfig.name })}</h1>
        <p className="adv-text">{t("advertise.intro")}</p>
        <p className="adv-price">{t("advertise.price", { price, days: adsConfig.periodDays })}</p>
        <div className="adv-actions">
          <Link href="/advertise/my" className="btn btn-ghost btn-lg">
            {t("advertise.my.link")}
          </Link>
          <Link href="/advertise/new" className="btn btn-primary btn-lg">
            {t("advertise.cta")}
          </Link>
        </div>
      </section>

      <section className="card adv-card">
        <h2 className="sf-h2">{t("advertise.how.title")}</h2>
        <ol className="adv-steps">
          {how.map((key, i) => (
            <li key={key} className="pc-rule">
              <span className="pc-rule-n">{i + 1}</span>
              <span>{t(key, { days: adsConfig.periodDays })}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card adv-card">
        <h2 className="sf-h2">{t("advertise.formats.title")}</h2>
        <p className="adv-text">{t("advertise.formats.text", { image: mb(adsConfig.media.imageMaxBytes), video: mb(adsConfig.media.videoMaxBytes) })}</p>
      </section>

      <section className="card adv-card" id="rules">
        <h2 className="sf-h2">{t("advertise.rules.title")}</h2>
        <ul className="adv-steps">
          {rules.map((key) => (
            <li key={key} className="adv-rule">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <section className="card adv-card">
        <h2 className="sf-h2">{t("advertise.fair.title")}</h2>
        <p className="adv-text">{t("advertise.fair.text")}</p>
        <h2 className="sf-h2">{t("advertise.privacy.title")}</h2>
        <p className="adv-text">{t("advertise.privacy.text")}</p>
      </section>
    </div>
  );
}
