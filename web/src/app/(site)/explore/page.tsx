import Link from "next/link";
import Icon from "@/components/shell/Icon";
import { t, tn } from "@/i18n";
import { communityIcon } from "@/data/sample";
import { getCommunities } from "@/lib/queries";

export default async function ExplorePage() {
  const communities = await getCommunities();
  return (
    <>
      <header className="card pg-head">
        <h1 className="sf-h1">{t("explore.title")}</h1>
        <p className="pc-text">{t("explore.sub")}</p>
      </header>

      <div className="ex-grid">
        {communities.map((c, i) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="card card-link ex-card">
            <span className={`pc-avatar pc-a${(i % 5) + 1}`} aria-hidden="true">
              <Icon name={communityIcon[c.slug] ?? "users"} size={24} />
            </span>
            <div className="ex-body">
              <h2>{c.name}</h2>
              <p>{c.description}</p>
              <small>{tn("community.members", c.members)}</small>
            </div>
            <span className="ex-open">{t("explore.open")} <Icon name="chevron" size={16} /></span>
          </Link>
        ))}
      </div>
    </>
  );
}
