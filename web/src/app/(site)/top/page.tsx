import Link from "next/link";
import { t, tn, formatNumber } from "@/i18n";
import { getCommunities } from "@/lib/queries";

export default async function TopPage() {
  const communities = await getCommunities();
  // Most members first; same number of members -> alphabetical (so the order never jumps around).
  const ranked = [...communities].sort((a, b) => b.members - a.members || a.name.localeCompare(b.name));

  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("top.title")}</h1>
        <p className="pc-text">{t("top.sub")}</p>
      </header>

      <ol className="tp-list">
        {ranked.map((c, i) => (
          <li key={c.slug}>
            <Link href={`/c/${c.slug}`} className="card card-link tp-row">
              <b className="tp-rank">{formatNumber(i + 1)}</b>
              <div className="ex-body">
                <h2>{c.name}</h2>
                <p>{c.description}</p>
              </div>
              <small>{tn("community.members", c.members)}</small>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
