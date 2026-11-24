import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/i18n";
import type { MessageKey } from "@/i18n/messages/en";
import { creatorsConfig } from "@/config/site";
import { formatUsd } from "@/lib/creator-rules";

export const metadata: Metadata = { title: t("creatorProgram.title") };

const STEPS = [1, 2, 3, 4, 5, 6] as const;
const FAQ = [1, 2, 3, 4, 5, 6] as const;

// Public terms and FAQ of the creator program (TODO 12, S9), in the style of /fairness.
// Every number comes from creatorsConfig, so this page can never disagree with the code that pays.
export default function CreatorProgramPage() {
  const params = {
    share: creatorsConfig.sharePercent,
    asker: creatorsConfig.split.askerPercent,
    accepted: creatorsConfig.split.acceptedPercent,
    others: creatorsConfig.split.othersPercent,
    max: creatorsConfig.otherAnswersMax,
    days: creatorsConfig.holdDays,
    min: formatUsd(creatorsConfig.minPayoutMicroUsd),
    change: creatorsConfig.detailsChangeHoldDays,
  };
  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("creatorProgram.title")}</h1>
        <p className="pc-text">{t("creatorProgram.sub")}</p>
      </header>

      <header className="card pg-head">
        <h2 className="sf-h1">{t("creatorProgram.how.title")}</h2>
      </header>
      <ol className="fa-list">
        {STEPS.map((n) => (
          <li key={n} className="card fa-item">
            <span className="tp-rank" aria-hidden="true">{n}</span>
            <div>
              <p>{t(`creatorProgram.how.${n}` as MessageKey, params)}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="card pg-head">
        <h2 className="sf-h1">{t("creatorProgram.privacy.title")}</h2>
        <p className="pc-text">{t("creatorProgram.privacy.body")}</p>
      </section>

      <header className="card pg-head">
        <h2 className="sf-h1">{t("creatorProgram.faq.title")}</h2>
      </header>
      <ul className="fa-list">
        {FAQ.map((n) => (
          <li key={n} className="card fa-item">
            <div>
              <h3>{t(`creatorProgram.faq.${n}.q` as MessageKey)}</h3>
              <p>{t(`creatorProgram.faq.${n}.a` as MessageKey, params)}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="card pg-head">
        <Link href="/creator" className="fa-link">{t("creatorProgram.cta")}</Link>
        <Link href="/settings/creator" className="fa-link">{t("creator.link.desc")}</Link>
      </section>
    </>
  );
}
