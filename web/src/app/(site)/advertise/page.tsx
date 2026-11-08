import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { adsConfig, siteConfig } from "@/config/site";
import { getLocale, t } from "@/i18n";
import "./advertise.css";
import "./advertise-landing.css";

export const metadata: Metadata = { title: t("advertise.title", { site: siteConfig.name }) };

// The public page for advertisers (ADS_PLAN Session 3). No login needed to read it. Every number comes from `adsConfig`
// (src/config/site.ts), so this page and the code cannot disagree. It makes the same promises as ADS_PLAN section 0:
// flat fee, no tracking of readers, fair rotation, and NO promised number of views.
// Layout only (patch-ads-page-design): same texts and same links as before, no new text.
const TextIcon = () => <Icon name="pencil" size={44} />;

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-8 9" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M10 9l5 3-5 3z" />
    </svg>
  );
}

function Megaphone() {
  return (
    <svg className="adl-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" />
    </svg>
  );
}

export default function AdvertisePage() {
  const price = new Intl.NumberFormat(getLocale(), { style: "currency", currency: adsConfig.currency }).format(
    adsConfig.monthlyPriceCents / 100,
  );
  const how = ["advertise.how.1", "advertise.how.2", "advertise.how.3", "advertise.how.4"] as const;
  const rules = ["advertise.rule.1", "advertise.rule.2", "advertise.rule.3", "advertise.rule.4", "advertise.rule.5"] as const;
  const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

  return (
    <div className="adl-wrap">
      <section className="card adl-hero">
        <div className="adl-hero-text">
          <span className="adl-badge" style={{ justifySelf: "start" }}>{t("ad.badge")}</span>
          <h1 className="adl-h1">{t("advertise.title", { site: siteConfig.name })}</h1>
          <p className="adl-intro">{t("advertise.intro")}</p>
          <div className="adl-actions">
            <Link href="/advertise/new" className="btn btn-primary btn-lg">
              {t("advertise.cta")}
            </Link>
            <Link href="/advertise/my" className="btn btn-ghost btn-lg">
              {t("advertise.my.link")}
            </Link>
          </div>
        </div>
        <div className="adl-price-card">
          <Megaphone />
          <span className="adl-price-big">{price}</span>
          <p className="adl-price-text">{t("advertise.price", { price, days: adsConfig.periodDays })}</p>
        </div>
      </section>

      <div className="adl-two">
        <section className="card adl-promise">
          <span className="adl-icon"><Icon name="scale" size={24} /></span>
          <h2 className="sf-h2">{t("advertise.fair.title")}</h2>
          <p>{t("advertise.fair.text")}</p>
        </section>
        <section className="card adl-promise">
          <span className="adl-icon"><Icon name="shield" size={24} /></span>
          <h2 className="sf-h2">{t("advertise.privacy.title")}</h2>
          <p>{t("advertise.privacy.text")}</p>
        </section>
      </div>

      <section className="card adl-card">
        <h2 className="sf-h2">{t("advertise.formats.title")}</h2>
        <div className="adl-formats">
          <div className="adl-format"><TextIcon />{t("advertise.new.format.TEXT")}</div>
          <div className="adl-format"><ImageIcon />{t("advertise.new.format.IMAGE")}</div>
          <div className="adl-format"><VideoIcon />{t("advertise.new.format.VIDEO")}</div>
        </div>
        <p className="adl-text">{t("advertise.formats.text", { image: mb(adsConfig.media.imageUploadMaxBytes), video: mb(adsConfig.media.videoMaxBytes) })}</p>
      </section>

      <section className="card adl-card">
        <h2 className="sf-h2">{t("advertise.how.title")}</h2>
        <ol className="adl-steps">
          {how.map((key, i) => (
            <li key={key} className="adl-step">
              <span className="adl-step-n">{i + 1}</span>
              <span>{t(key, { days: adsConfig.periodDays })}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card adl-card" id="rules">
        <h2 className="sf-h2">{t("advertise.rules.title")}</h2>
        <ul className="adl-rules">
          {rules.map((key) => (
            <li key={key} className="adl-rule">
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card adl-cta">
        <p>{t("advertise.title", { site: siteConfig.name })}</p>
        <Link href="/advertise/new" className="btn btn-primary btn-lg">
          {t("advertise.cta")}
        </Link>
      </section>
    </div>
  );
}
