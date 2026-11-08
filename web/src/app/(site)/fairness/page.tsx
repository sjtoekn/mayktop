import Link from "next/link";
import { t } from "@/i18n";
import { rankingConfig } from "@/config/site";

const PRINCIPLES = [1, 2, 3, 4, 5] as const;
const RANKING = [1, 2, 3, 4] as const;

export default function FairnessPage() {
  // The numbers shown here come from rankingConfig, so the page can never disagree with the code.
  const params = {
    every: rankingConfig.risingEvery,
    hours: rankingConfig.risingWindowHours,
    seed: rankingConfig.seedHours,
  };
  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("fairness.title")}</h1>
        <p className="pc-text">{t("fairness.sub")}</p>
      </header>

      <ol className="fa-list">
        {PRINCIPLES.map((n) => (
          <li key={n} className="card fa-item">
            <span className="tp-rank" aria-hidden="true">{n}</span>
            <div>
              <h2>{t(`fairness.${n}.title` as const)}</h2>
              <p>{t(`fairness.${n}.body` as const)}</p>
            </div>
          </li>
        ))}
      </ol>

      <header className="card pg-head">
        <h2 className="sf-h1">{t("fairness.rank.title")}</h2>
      </header>
      <ol className="fa-list">
        {RANKING.map((n) => (
          <li key={n} className="card fa-item">
            <span className="tp-rank" aria-hidden="true">{n}</span>
            <div>
              <p>{t(`fairness.rank.${n}` as const, params)}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="card pg-head">
        <p className="pc-text">{t("fairness.status")}</p>
        <Link href="/modlog" className="fa-link">{t("fairness.modlog")}</Link>
      </section>
    </>
  );
}
